/**
 * Thí nghiệm tự làm, chia sẻ bằng link: các thao tác được ghi lại thành các bước kịch bản
 * (giống thí nghiệm mẫu), nén rồi đặt ngay trong link (#/chia-se/<dữ liệu>).
 * Không cần máy chủ hay cơ sở dữ liệu: người nhận mở link, app tự chạy lại các thao tác.
 *
 * Dữ liệu trong link do người khác tạo nên được kiểm tra chặt khi đọc (hóa chất, số dụng cụ,
 * giới hạn lượng, số bước), tiêu đề chỉ được hiển thị dạng chữ thường (không phải HTML).
 */
import { CHEMICALS } from './catalog';
import type { ToolKind } from './probes';
import { FLASK, PlayScript, Step, SYRINGE } from './recipes';

/** Phiên bản định dạng / engine; đổi khi cách mô phỏng thay đổi đáng kể */
export const SHARE_VERSION = 1;
export const TITLE_MAX = 60;
const MAX_STEPS = 300;
const MAX_WAIT_S = 3600;

export interface SharedExperiment {
  version: number;
  title: string;
  steps: Step[];
}

// ── Ghi lại thao tác ──────────────────────────────────────────────────────

/** Ghi các thao tác của người dùng, chèn bước chờ theo thời gian mô phỏng giữa hai thao tác */
export class Recorder {
  private list: Step[] = [];
  private lastT = 0;
  active = false;

  start(simTime: number): void {
    this.list = [];
    this.lastT = simTime;
    this.active = true;
  }

  push(step: Step, simTime: number): void {
    if (!this.active || this.list.length >= MAX_STEPS) return;
    this.addWait(simTime);
    this.list.push(step);
  }

  /** Dừng ghi; trả về các bước (kèm khoảng chờ cuối để người xem thấy kết quả) */
  stop(simTime: number): Step[] {
    this.active = false;
    if (this.list.length) this.addWait(Math.max(simTime, this.lastT + 3));
    return this.list;
  }

  /** Các bước đã ghi (chỉ đọc) */
  steps(): readonly Step[] {
    return this.list;
  }

  private addWait(t: number): void {
    const gap = t - this.lastT;
    this.lastT = t;
    if (gap < 0.8) return;
    const seconds = Math.min(MAX_WAIT_S, Math.round(gap * 10) / 10);
    const speed = waitSpeed(seconds);
    this.list.push({ kind: 'wait', seconds, ...(speed > 1 ? { speed } : {}) });
  }
}

/** Khoảng chờ dài thì tua nhanh để người xem không phải đợi quá ~12 giây */
export const waitSpeed = (seconds: number): number => (seconds > 15 ? Math.min(60, Math.ceil(seconds / 12)) : 1);

/** Kịch bản để trình phát chạy lại một thí nghiệm được chia sẻ */
export function sharedScript(e: SharedExperiment, data: string): PlayScript {
  return { id: 'chia-se', title: e.title || 'Thí nghiệm tự làm', steps: e.steps, shared: { data } };
}

// ── Mã hóa gọn ────────────────────────────────────────────────────────────

type Packed = (string | number | null)[];

function pack(s: Step): Packed | null {
  switch (s.kind) {
    case 'add': return ['a', s.chem, s.amount, s.vessel];
    case 'wait': return ['w', s.seconds, s.speed ?? 1];
    case 'heat': return ['h', s.vessel, s.on ? 1 : 0];
    case 'stir': return ['s', s.vessel];
    case 'probe': return ['p', s.tool, s.vessel];
    case 'burn': return ['b', s.chem];
    case 'connect': return ['c', s.src, s.dst];
    case 'invert': return ['i', s.vessel];
    case 'weigh': return s.off ? ['x', s.vessel] : ['g', s.vessel];
    case 'pour': return ['o', s.src, s.dst];
    case 'empty': return ['e', s.vessel];
    case 'predict': return ['q'];
    default: return null; // lời thuyết minh, focus: không cần cho thí nghiệm tự làm
  }
}

const TOOLS: ToolKind[] = ['glowing', 'burning', 'litmus', 'magnet'];

class Bad extends Error {}

function unpack(p: unknown): Step {
  if (!Array.isArray(p) || typeof p[0] !== 'string') throw new Bad('bước không hợp lệ');
  const num = (x: unknown, lo: number, hi: number): number => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi) throw new Bad('số không hợp lệ');
    return x;
  };
  const vessel = (x: unknown): number => {
    const v = num(x, 0, FLASK);
    if (!Number.isInteger(v)) throw new Bad('dụng cụ không hợp lệ');
    return v;
  };
  const chem = (x: unknown) => {
    const c = CHEMICALS.find((e) => e.key === x);
    if (!c) throw new Bad('hóa chất không có trong kho');
    return c;
  };
  switch (p[0]) {
    case 'a': {
      const c = chem(p[1]);
      if (c.kind === 'tool') throw new Bad('dụng cụ đo không cho vào như hóa chất');
      return { kind: 'add', chem: c.key, amount: num(p[2], 0.001, c.max), vessel: vessel(p[3]) };
    }
    case 'w': {
      const speed = num(p[2], 1, 60);
      return { kind: 'wait', seconds: num(p[1], 0, MAX_WAIT_S), ...(speed > 1 ? { speed: Math.round(speed) } : {}) };
    }
    case 'h': return { kind: 'heat', vessel: vessel(p[1]), on: p[2] === 1 };
    case 's': return { kind: 'stir', vessel: vessel(p[1]) };
    case 'p': {
      if (!TOOLS.includes(p[1] as ToolKind)) throw new Bad('dụng cụ thử không hợp lệ');
      return { kind: 'probe', tool: p[1] as ToolKind, vessel: vessel(p[2]) };
    }
    case 'b': {
      const c = chem(p[1]);
      if (!c.solid) throw new Bad('chỉ đốt được chất rắn');
      return { kind: 'burn', chem: c.key };
    }
    case 'c': return { kind: 'connect', src: vessel(p[1]), dst: p[2] === null ? null : p[2] === SYRINGE ? SYRINGE : vessel(p[2]) };
    case 'i': return { kind: 'invert', vessel: vessel(p[1]) };
    case 'g': return { kind: 'weigh', vessel: p[1] === null ? null : vessel(p[1]) };
    case 'x': return { kind: 'weigh', vessel: vessel(p[1]), off: true };
    case 'o': return { kind: 'pour', src: vessel(p[1]), dst: vessel(p[2]) };
    case 'e': return { kind: 'empty', vessel: vessel(p[1]) };
    case 'q': return { kind: 'predict' };
    default: throw new Bad('loại bước không biết');
  }
}

/** Làm sạch tiêu đề: một dòng, không kí tự điều khiển, tối đa TITLE_MAX kí tự */
export function cleanTitle(t: string): string {
  // eslint-disable-next-line no-control-regex
  return [...t.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim()]
    .slice(0, TITLE_MAX).join('');
}

// ── Nén + base64url ───────────────────────────────────────────────────────

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Bad('link hỏng');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Mã hóa thí nghiệm thành chuỗi đặt trong link */
export async function encodeShare(e: SharedExperiment): Promise<string> {
  const packed = e.steps.map(pack).filter((x): x is Packed => x !== null);
  const json = JSON.stringify({ v: e.version, t: cleanTitle(e.title), s: packed });
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

/** Đọc thí nghiệm từ link; ném lỗi (có thông báo tiếng Việt) nếu link hỏng hoặc không hợp lệ */
export async function decodeShare(data: string): Promise<SharedExperiment> {
  // Link chép qua tin nhắn có thể bị chèn khoảng trắng / xuống dòng
  data = data.replace(/(%20|%0A|%0D|\s)+/gi, '');
  if (data.length > 20000) throw new Bad('link quá dài');
  let obj: unknown;
  try {
    const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
    if (bytes.length > 200000) throw new Bad('dữ liệu quá lớn');
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    throw err instanceof Bad ? err : new Bad('link hỏng hoặc bị cắt mất một phần');
  }
  const o = obj as { v?: unknown; t?: unknown; s?: unknown };
  if (typeof o !== 'object' || o === null || typeof o.v !== 'number' || !Array.isArray(o.s)) throw new Bad('link không hợp lệ');
  if (o.s.length > MAX_STEPS) throw new Bad('quá nhiều bước');
  return {
    version: o.v,
    title: cleanTitle(typeof o.t === 'string' ? o.t : ''),
    steps: o.s.map(unpack),
  };
}

export { Bad as ShareError };
