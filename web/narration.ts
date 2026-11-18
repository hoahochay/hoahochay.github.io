/**
 * Lời thuyết minh hiển thị cho từng bước của thí nghiệm mẫu.
 * Là hàm thuần (không phụ thuộc cảnh 3D) để script tạo giọng đọc (scripts/tts-plan.ts) dùng chung.
 */
import { CHEMICALS } from './catalog';
import type { ToolKind } from './probes';
import { BEAKER, FLASK, Step, SYRINGE } from './recipes';

const PROBE_NAME: Record<ToolKind, string> = {
  glowing: 'que đóm còn tàn đỏ',
  burning: 'que đóm đang cháy',
  litmus: 'mẩu giấy quỳ tím ẩm',
  magnet: 'nam châm',
};

/** Tên dụng cụ theo số thứ tự dùng trong kịch bản (khớp với tên trong cảnh 3D) */
export function vesselName(i: number): string {
  if (i === SYRINGE) return 'Xi lanh đo khí';
  if (i === BEAKER) return 'Cốc 100 mL';
  if (i === FLASK) return 'Bình nón 100 mL';
  return `Ống nghiệm ${i + 1}`;
}

const fmt = (x: number) => String(+x.toFixed(2)).replace('.', ',');

/** "2 mL HCl 1M", "0,05 g Mg" */
export function chemLabel(key: string, amount: number): string {
  const c = CHEMICALS.find((x) => x.key === key);
  if (!c) throw new Error(`Không có hóa chất "${key}"`);
  return `${fmt(amount)} ${c.unit} ${c.formula}${c.kind === 'solution' && c.key !== 'water' ? ' ' + c.sub : ''}`;
}

export function describeStep(s: Step): string {
  const vn = (i: number) => vesselName(i).toLowerCase();
  switch (s.kind) {
    case 'say': return s.text;
    case 'add': return s.text ?? `Cho ${chemLabel(s.chem, s.amount)} vào ${vn(s.vessel)}.`;
    case 'wait': return s.text ?? 'Quan sát…';
    case 'heat': return s.text ?? (s.on ? 'Đun nóng bằng đèn cồn.' : 'Tắt đèn cồn.');
    case 'stir': return s.text ?? 'Lắc nhẹ cho dung dịch trộn đều.';
    case 'connect': return s.text ?? (s.dst === null
      ? 'Tháo ống dẫn khí.'
      : `Lắp ống dẫn khí từ ${vn(s.src)} sang ${vn(s.dst)}.`);
    case 'invert': return s.text ?? `Úp ngược ${vn(s.vessel)}.`;
    case 'probe': return s.text ?? (s.tool === 'magnet'
      ? `Đưa nam châm lại gần đáy ${vn(s.vessel)}.`
      : `Đưa ${PROBE_NAME[s.tool]} vào miệng ${vn(s.vessel)}.`);
    case 'burn': {
      const c = CHEMICALS.find((x) => x.key === s.chem);
      return s.text ?? `Dùng kẹp sắt giữ ${c?.formula ?? s.chem} đốt trên ngọn lửa đèn cồn.`;
    }
    case 'weigh': return s.text ?? (s.vessel === null ? 'Lấy dụng cụ khỏi cân.' : `Đặt ${vn(s.vessel)} lên cân điện tử.`);
    case 'pour': return s.text ?? `Đổ ${vn(s.src)} vào ${vn(s.dst)}.`;
    case 'focus': return '';
  }
}
