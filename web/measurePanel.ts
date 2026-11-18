/**
 * Bảng đo của một dụng cụ đo (xi lanh đo khí, cân điện tử…): số đọc hiện tại, tốc độ thay đổi,
 * đồ thị theo thời gian và bảng số đo mỗi 10 s.
 */
import { isPhone } from './layout';

interface Sample { t: number; v: number }

const fmt = (x: number, d = 1) => x.toFixed(d).replace('.', ',').replace(/^-(0,?0*)$/, '$1');

/** Bước chia trục "đẹp": 1, 2, 5 × 10ⁿ */
function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export interface MeasureOptions {
  title: string;
  /** Tên đại lượng, vd. "Thể tích", "Khối lượng" */
  quantity: string;
  /** Kí hiệu dùng trên trục / bảng, vd. "V", "m" */
  symbol: string;
  unit: string;
  decimals: number;
  /** Khoảng tối thiểu của trục tung (để nhiễu nhỏ không bị phóng to) */
  minSpan: number;
  /** Trục tung luôn bắt đầu từ 0 */
  fromZero: boolean;
  /** Ngưỡng thay đổi coi là đáng ghi ngay */
  jump: number;
  csvName: string;
  /** Nút đặt lại số đo (vd. đẩy pít-tông xi lanh về 0); bỏ trống thì không có nút */
  resetLabel?: string;
  resetTitle?: string;
  /** Nút phụ (vd. "Lấy xuống" của cân) */
  extra?: { label: string; title: string; onClick(): void };
  reset?(): void;
}

export class MeasurePanel {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private samples: Sample[] = [];
  private t0 = 0;
  private dirty = true;

  constructor(private readonly o: MeasureOptions) {
    this.root = document.createElement('div');
    // Điện thoại: thu gọn sẵn (chỉ hiện số đọc) để không che cảnh 3D; bấm "–" để mở đồ thị
    this.root.className = 'measure card hidden' + (isPhone() ? ' mini' : '');
    this.root.innerHTML = `
      <div class="g-head">
        <b>${o.title}</b>
        <span class="g-src muted"></span>
        <button class="g-min" title="Thu gọn / mở rộng">–</button>
      </div>
      <div class="g-now"><div><span class="k">${o.quantity}</span><b class="g-v">–</b></div>
        <div><span class="k">Thời gian</span><b class="g-t">0 s</b></div>
        <div><span class="k">Tốc độ</span><b class="g-r">–</b></div></div>
      <canvas width="620" height="300"></canvas>
      <details class="g-table"><summary>Bảng số đo (mỗi 10 s)</summary><table></table></details>
      <div class="g-actions">
        ${o.resetLabel ? `<button class="g-reset" title="${o.resetTitle ?? ''}">${o.resetLabel}</button>` : ''}
        ${o.extra ? `<button class="g-extra" title="${o.extra.title}">${o.extra.label}</button>` : ''}
        <button class="g-csv" title="Tải bảng số đo về máy (CSV)">⬇ CSV</button>
      </div>`;
    let dock = document.getElementById('measures');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'measures';
      document.body.appendChild(dock);
    }
    dock.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    const reset = this.root.querySelector<HTMLButtonElement>('.g-reset');
    if (reset) reset.onclick = () => this.o.reset?.();
    if (o.extra) this.root.querySelector<HTMLButtonElement>('.g-extra')!.onclick = () => o.extra!.onClick();
    this.root.querySelector<HTMLButtonElement>('.g-min')!.onclick = () => this.root.classList.toggle('mini');
    this.root.querySelector<HTMLButtonElement>('.g-csv')!.onclick = () => this.downloadCsv();
  }

  /** Bắt đầu một lần đo mới; `note` hiện cạnh tiêu đề (vd. "nối với bình nón") */
  start(simTime: number, value: number, note: string): void {
    this.t0 = simTime;
    this.samples = [{ t: 0, v: value }];
    this.dirty = true;
    this.root.querySelector('.g-src')!.textContent = note;
    this.show(true);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
    const any = document.querySelectorAll('.measure:not(.hidden)').length;
    document.body.classList.toggle('has-graph', any > 0);
    document.body.classList.toggle('has-graph2', any > 1);
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** Ghi số đọc; gọi mỗi khung hình */
  record(simTime: number, value: number): void {
    if (!this.visible) return;
    const t = simTime - this.t0;
    const last = this.samples[this.samples.length - 1];
    if (t - last.t >= 0.5 || (t > last.t && Math.abs(value - last.v) > this.o.jump)) {
      this.samples.push({ t, v: value });
      if (this.samples.length > 4000) this.samples = this.samples.filter((_, i) => i % 2 === 0);
      this.dirty = true;
    }
    if (this.dirty) this.draw(t, value);
  }

  /** Giá trị tại thời điểm t (nội suy tuyến tính) */
  private at(t: number): number {
    const s = this.samples;
    if (t <= 0) return s[0].v;
    for (let i = 1; i < s.length; i++) {
      if (s[i].t >= t) {
        const a = s[i - 1], b = s[i];
        return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-9, b.t - a.t);
      }
    }
    return s[s.length - 1].v;
  }

  private rate(t: number): number {
    const w = Math.min(5, t);
    return w > 0.5 ? (this.at(t) - this.at(t - w)) / w : 0;
  }

  private readings(): Sample[] {
    const last = this.samples[this.samples.length - 1].t;
    const out: Sample[] = [];
    for (let t = 0; t <= last + 1e-6; t += 10) out.push({ t, v: this.at(t) });
    return out;
  }

  private draw(t: number, v: number): void {
    this.dirty = false;
    const q = (sel: string) => this.root.querySelector(sel)!;
    const o = this.o;
    q('.g-v').textContent = `${fmt(v, o.decimals)} ${o.unit}`;
    q('.g-t').textContent = `${Math.floor(t)} s`;
    q('.g-r').textContent = `${fmt(this.rate(t), o.decimals + 1)} ${o.unit}/s`;
    if (this.root.classList.contains('mini')) return;

    const ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    const L = 86, R = 16, T = 16, B = 46;
    const tMax = Math.max(60, Math.ceil(t / 30) * 30);
    const vals = this.samples.map((s) => s.v).concat(v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (o.fromZero) lo = Math.min(0, lo);
    if (hi - lo < o.minSpan) {
      const mid = o.fromZero ? lo + o.minSpan / 2 : (hi + lo) / 2;
      lo = mid - o.minSpan / 2;
      hi = mid + o.minSpan / 2;
    }
    const vStep = niceStep((hi - lo) / 5);
    const vMin = Math.floor(lo / vStep) * vStep;
    const vMax = Math.ceil((hi + (hi - lo) * 0.05) / vStep) * vStep;
    const X = (x: number) => L + (x / tMax) * (W - L - R);
    const Y = (y: number) => H - B - ((y - vMin) / (vMax - vMin)) * (H - T - B);
    const css = getComputedStyle(document.body);
    const ink = css.getPropertyValue('--ink').trim() || '#1d2430';
    const muted = css.getPropertyValue('--muted').trim() || '#6b7280';
    const accent = css.getPropertyValue('--accent').trim() || '#2f6fed';

    ctx.clearRect(0, 0, W, H);
    ctx.font = '22px system-ui, sans-serif';
    ctx.lineWidth = 1;
    // Lưới và nhãn trục
    const tStep = tMax <= 60 ? 10 : tMax <= 180 ? 30 : tMax <= 600 ? 60 : 120;
    ctx.strokeStyle = 'rgba(128,128,128,0.18)';
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = 0; x <= tMax + 1e-6; x += tStep) {
      ctx.beginPath(); ctx.moveTo(X(x), T); ctx.lineTo(X(x), H - B); ctx.stroke();
      ctx.fillText(String(x), X(x), H - B + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yd = Math.max(0, -Math.floor(Math.log10(vStep) + 1e-9));
    for (let y = vMin; y <= vMax + vStep * 1e-6; y += vStep) {
      ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(W - R, Y(y)); ctx.stroke();
      ctx.fillText(fmt(y, yd), L - 8, Y(y));
    }
    ctx.strokeStyle = muted;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('thời gian (s)', W - R, H - 2);
    ctx.save();
    ctx.translate(18, T);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${o.symbol} (${o.unit})`, 0, -4);
    ctx.restore();

    // Đường đo
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.samples.forEach((s, i) => (i ? ctx.lineTo(X(s.t), Y(s.v)) : ctx.moveTo(X(s.t), Y(s.v))));
    ctx.lineTo(X(t), Y(v));
    ctx.stroke();
    // Các điểm đo mỗi 10 s
    ctx.fillStyle = accent;
    for (const r of this.readings()) {
      ctx.beginPath(); ctx.arc(X(r.t), Y(r.v), 4.5, 0, Math.PI * 2); ctx.fill();
    }

    const rows = this.readings();
    q('.g-table table').innerHTML = `<tr><th>t (s)</th><th>${o.symbol} (${o.unit})</th><th>Δ${o.symbol} (${o.unit})</th></tr>` +
      rows.map((r, i) => `<tr><td>${r.t}</td><td>${fmt(r.v, o.decimals)}</td><td>${i ? fmt(r.v - rows[i - 1].v, o.decimals) : '–'}</td></tr>`).join('');
  }

  private downloadCsv(): void {
    const rows = this.readings();
    const o = this.o;
    const csv = `t (s),${o.symbol} (${o.unit})\n` + rows.map((r) => `${r.t},${r.v.toFixed(o.decimals + 1)}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = o.csvName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
