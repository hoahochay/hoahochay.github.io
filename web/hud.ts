/** Giao diện HTML phủ lên cảnh 3D */
import { Observation, pretty, RGB, species, toHex } from '../src';
import { activeReactions, LogEntry } from './events';
import { VesselView } from './VesselView';

export const SPEEDS = [0, 1, 5, 20, 60];

export interface HudHandlers {
  onSpeed(s: number): void;
  onStir(): void;
  onHeat(): void;
  onEmpty(): void;
  onFocus(): void;
  onInvert(): void;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const swatch = (c: RGB) => `<span class="sw" style="background:${toHex(c)}"></span>`;

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtConc(c: number): string {
  if (c >= 0.1) return c.toFixed(2) + ' M';
  if (c >= 1e-3) return (c * 1000).toFixed(1) + ' mM';
  return c.toExponential(1) + ' M';
}

export class Hud {
  private lastPanel = 0;

  constructor(private readonly h: HudHandlers) {
    const speed = $('#speed');
    SPEEDS.forEach((s) => {
      const b = document.createElement('button');
      b.textContent = s === 0 ? '⏸' : `${s}×`;
      b.dataset.speed = String(s);
      if (s === 1) b.classList.add('on');
      b.onclick = () => {
        this.setSpeed(s);
        h.onSpeed(s);
      };
      speed.appendChild(b);
    });
    $('#btn-stir').onclick = () => h.onStir();
    $('#btn-heat').onclick = () => h.onHeat();
    $('#btn-empty').onclick = () => h.onEmpty();
    $('#btn-focus').onclick = () => h.onFocus();
    $('#btn-invert').onclick = () => h.onInvert();
  }

  setSpeed(s: number): void {
    document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.speed) === s));
  }

  setHeating(on: boolean): void {
    $('#btn-heat span').textContent = on ? 'Tắt đèn' : 'Đun';
  }

  setInverted(on: boolean): void {
    $('#btn-invert span').textContent = on ? 'Lật ngửa' : 'Úp ống';
  }

  /** Dòng nhắc nổi giữa màn hình (null: ẩn) */
  hint(text: string | null): void {
    const el = $('#hint');
    el.classList.toggle('hidden', !text);
    if (text) el.textContent = text;
  }

  setTime(t: number): void {
    $('#clock').textContent = fmtTime(t);
  }

  tooltip(text: string | null, x = 0, y = 0): void {
    const tip = $('#tip');
    tip.style.display = text ? 'block' : 'none';
    if (text) {
      tip.innerHTML = text;
      tip.style.left = `${x + 14}px`;
      tip.style.top = `${y + 14}px`;
    }
  }

  log(e: LogEntry): void {
    const list = $('#log');
    const li = document.createElement('li');
    li.className = e.kind ?? 'phenomenon';
    li.innerHTML =
      `<span class="t">${fmtTime(e.t)}</span><span class="v">${e.vessel}</span>` +
      `<span class="m">${e.color ? swatch(e.color) : ''}${e.text}` +
      (e.equation ? `<br><span class="eq">${e.equation}</span>` : '') + '</span>';
    list.prepend(li);
    while (list.children.length > 60) list.lastChild?.remove();
  }

  clearLog(): void {
    $('#log').innerHTML = '';
  }

  /** Cập nhật bảng thông tin (giới hạn ~6 lần/giây) */
  panel(view: VesselView | null, o: Observation | null, now: number): void {
    if (now - this.lastPanel < 0.16) return;
    this.lastPanel = now;
    const el = $('#info');
    if (!view || !o) {
      el.innerHTML = '<div class="muted">Bấm vào một ống nghiệm hoặc cốc để chọn.</div>';
      return;
    }
    const empty = o.volumeML < 0.005 && o.solids.length === 0;
    const dissolved = Object.entries(o.dissolved)
      .filter(([id]) => id !== 'H+' && id !== 'OH-' && !species(id).indicator && o.dissolved[id] > 1e-5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, c]) => `<span class="chip">${pretty(id)} <b>${fmtConc(c)}</b></span>`)
      .join('');
    const solids = o.solids
      .filter((s) => s.grams > 1e-5)
      .map((s) => `<span class="chip">${swatch(s.color)}${s.formula} <b>${s.grams >= 0.1 ? s.grams.toFixed(2) + ' g' : (s.grams * 1000).toFixed(1) + ' mg'}</b></span>`)
      .join('');
    const gases = Object.entries(o.gasTotalMol)
      .map(([id, n]) => {
        const rate = o.gasRateML[id] ?? 0;
        const totalML = n * 24465;
        return `<span class="chip">${pretty(id)} <b>${rate > 0.005 ? rate.toFixed(2) + ' mL/s' : 'đã dừng'}</b> · tổng ${totalML.toFixed(1)} mL</span>`;
      })
      .join('');
    const head = Object.entries(o.headspace)
      .filter(([, x]) => x > 0.005)
      .sort((a, b) => b[1] - a[1])
      .map(([id, x]) => `<span class="chip">${pretty(id)} <b>${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%</b></span>`)
      .join('');
    const rx = activeReactions(view);
    el.innerHTML = `
      <div class="title">${view.name}</div>
      ${empty ? '<div class="muted">Đang trống. Kéo hóa chất từ kho bên trái vào đây.</div>' : `
      <div class="meters">
        <div class="meter"><div class="k">Nhiệt độ</div><div class="val">${o.tempC.toFixed(1)}<small> °C</small></div></div>
        <div class="meter"><div class="k">pH</div><div class="val">${o.volumeML > 0.005 ? o.pH.toFixed(2) : '–'}</div></div>
        <div class="meter"><div class="k">Thể tích</div><div class="val">${o.volumeML.toFixed(o.volumeML < 10 ? 2 : 1)}<small> mL</small></div></div>
      </div>
      <div class="row"><span class="k">Màu</span>${swatch(o.appearance)} ${toHex(o.appearance)}${o.turbidity > 0.05 ? ` · đục ${(o.turbidity * 100).toFixed(0)}%` : ''}${o.boiling ? ' · <b>đang sôi</b>' : ''}</div>
      ${dissolved ? `<div class="sec">Chất tan</div><div class="chips">${dissolved}</div>` : ''}
      ${solids ? `<div class="sec">Chất rắn</div><div class="chips">${solids}</div>` : ''}
      ${gases ? `<div class="sec">Khí thoát ra</div><div class="chips">${gases}</div>` : ''}
      ${head ? `<div class="sec">Khí ở miệng ống</div><div class="chips">${head}<span class="chip muted">còn lại: không khí</span></div>` : ''}
      ${rx.length ? `<div class="sec">Phản ứng đang xảy ra</div>${rx.map((r) => `<div class="eq">${r}</div>`).join('')}` : ''}
      `}`;
  }
}
