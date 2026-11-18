/**
 * Kho hóa chất: tìm kiếm, nhập lượng, rồi kéo thả vào dụng cụ.
 * Trên màn hình cảm ứng (hoặc khi thích bấm hơn kéo): chạm một mục để chọn, rồi chạm vào dụng cụ.
 */
import { ChemEntry, normalize } from './catalog';

export interface DropTarget {
  /** Dụng cụ nằm dưới điểm (clientX, clientY), hoặc null */
  hitTest(x: number, y: number): unknown | null;
  hover(target: unknown | null): void;
  drop(entry: ChemEntry, amount: number, target: unknown): void;
  /** Mục đang được chọn để chạm-rồi-đặt thay đổi (null: bỏ chọn) */
  armChanged(entry: ChemEntry | null, amount: number): void;
}

const GROUPS: { kind: ChemEntry['kind']; title: string }[] = [
  { kind: 'solution', title: 'Dung dịch' },
  { kind: 'solid', title: 'Chất rắn' },
  { kind: 'indicator', title: 'Chất chỉ thị' },
  { kind: 'tool', title: 'Dụng cụ' },
];

const DRAG_THRESHOLD = 5;
/** Cảm ứng: giữ ngón tay trên một hóa chất chừng này (ms) thì nhấc lên để kéo */
const LONG_PRESS_MS = 300;

export class ChemPanel {
  private readonly amounts = new Map<string, number>();
  private readonly list: HTMLElement;
  private readonly search: HTMLInputElement;
  /** Mục đang chọn (chạm-rồi-đặt) */
  private armedKey: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly entries: ChemEntry[],
    private readonly thumbs: Map<string, string>,
    private readonly target: DropTarget,
  ) {
    for (const e of entries) this.amounts.set(e.key, e.defaultAmount);
    root.innerHTML = `
      <div class="chem-body">
        <input class="chem-search" type="search" placeholder="Tìm chất: acid, NaOH, đồng…" autocomplete="off" />
        <div class="chem-hint">Nhập lượng rồi <b>kéo thả</b> vào ống nghiệm, cốc hoặc bình nón, hoặc <b>chạm chọn</b> rồi chạm vào dụng cụ.</div>
        <div class="chem-list"></div>
      </div>`;
    this.list = root.querySelector('.chem-list')!;
    this.search = root.querySelector('.chem-search')!;
    this.search.addEventListener('input', () => this.render());
    this.render();
  }

  /** Đưa mọi lượng về mặc định, xóa ô tìm kiếm, bỏ chọn */
  reset(): void {
    for (const e of this.entries) this.amounts.set(e.key, e.defaultAmount);
    this.search.value = '';
    this.arm(null);
    this.render();
  }

  /** Mở kho tại một hóa chất: xóa ô tìm kiếm, cuộn tới và nhấp nháy để học sinh dễ thấy */
  reveal(key: string): void {
    this.search.value = '';
    this.render();
    const el = this.list.querySelector<HTMLElement>(`.chem[data-key="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  /** Mục đang chọn và lượng của nó, hoặc null */
  get armed(): { entry: ChemEntry; amount: number } | null {
    const entry = this.armedKey ? this.entries.find((e) => e.key === this.armedKey) : undefined;
    return entry ? { entry, amount: this.amounts.get(entry.key)! } : null;
  }

  arm(key: string | null): void {
    this.armedKey = key;
    this.list.querySelectorAll<HTMLElement>('.chem').forEach((el) => el.classList.toggle('armed', el.dataset.key === key));
    const a = this.armed;
    this.target.armChanged(a?.entry ?? null, a?.amount ?? 0);
  }

  private render(): void {
    const q = normalize(this.search.value.trim());
    const terms = q.split(/\s+/).filter(Boolean);
    const match = (e: ChemEntry) => terms.every((t) => e.search.includes(t));
    let html = '';
    for (const g of GROUPS) {
      const items = this.entries.filter((e) => e.kind === g.kind && match(e));
      if (!items.length) continue;
      html += `<div class="chem-group">${g.title}</div>`;
      for (const e of items) {
        html += `
          <div class="chem${e.key === this.armedKey ? ' armed' : ''}" data-key="${e.key}" title="Kéo vào dụng cụ, hoặc bấm chọn rồi bấm vào dụng cụ">
            <img src="${this.thumbs.get(e.key) ?? ''}" alt="" draggable="false" />
            <div class="meta">
              ${e.kind === 'tool'
                ? `<div class="f">${e.title}</div><div class="n">${e.sub}</div>`
                : `<div class="f">${e.formula} <small>${e.sub}</small></div><div class="n">${e.title}</div>`}
            </div>
            ${e.kind === 'tool' ? '<span></span>' : `<label class="amt">
              <input type="number" min="${e.step}" max="${e.max}" step="${e.step}" value="${this.amounts.get(e.key)}" />
              <span>${e.unit}</span>
            </label>`}
          </div>`;
      }
    }
    this.list.innerHTML = html || '<div class="chem-empty">Không tìm thấy chất nào.</div>';
    this.list.querySelectorAll<HTMLElement>('.chem').forEach((el) => this.bind(el));
  }

  private bind(el: HTMLElement): void {
    const entry = this.entries.find((e) => e.key === el.dataset.key)!;
    const input = el.querySelector('input');
    input?.addEventListener('input', () => {
      const v = Number(input.value);
      if (v > 0) this.amounts.set(entry.key, Math.min(entry.max, v));
      if (this.armedKey === entry.key) this.arm(entry.key);
    });
    input?.addEventListener('pointerdown', (ev) => ev.stopPropagation());

    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      // Chuột: chặn bôi đen chữ. Cảm ứng: để trình duyệt còn cuộn được danh sách (vuốt dọc)
      if (ev.pointerType === 'mouse') ev.preventDefault();
      const start = { x: ev.clientX, y: ev.clientY };
      const touch = ev.pointerType !== 'mouse';
      let ghost: HTMLElement | null = null;
      let over: unknown | null = null;
      // Cảm ứng: vuốt dọc là cuộn danh sách; kéo ngang hoặc giữ ngón tay một chút thì nhấc hóa chất lên
      let scrolling = false;
      const lift = () => {
        ghost = this.makeGhost(entry);
        ghost.style.transform = `translate(${start.x - 28}px, ${start.y - 28}px)`;
        el.classList.add('dragging');
        if (touch) {
          this.touchDragging = true;
          document.body.classList.add('chem-dragging');
          navigator.vibrate?.(12);
        }
      };
      const press = touch ? window.setTimeout(() => { if (!ghost && !scrolling) lift(); }, LONG_PRESS_MS) : 0;

      const move = (e: PointerEvent) => {
        if (scrolling) return;
        if (!ghost) {
          const dx = e.clientX - start.x, dy = e.clientY - start.y;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          if (touch && Math.abs(dy) > Math.abs(dx)) {
            scrolling = true;
            clearTimeout(press);
            return;
          }
          clearTimeout(press);
          lift();
        }
        const g = ghost!;
        g.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
        // Chỉ nhận thả khi con trỏ đang ở trên vùng cảnh 3D (không phải trên bảng)
        const onPanel = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('.card');
        const t = onPanel ? null : this.target.hitTest(e.clientX, e.clientY);
        if (t !== over) {
          over = t;
          this.target.hover(t);
          g.classList.toggle('ok', !!t);
        }
      };
      const up = (e: PointerEvent) => {
        clearTimeout(press);
        this.touchDragging = false;
        document.body.classList.remove('chem-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        ghost?.remove();
        this.target.hover(null);
        if (ghost && over) {
          this.arm(null);
          this.target.drop(entry, this.amounts.get(entry.key)!, over);
        } else if (!ghost && !scrolling && e.type === 'pointerup') {
          // Chạm / bấm không kéo: chọn mục này (bấm lần nữa để bỏ chọn)
          this.arm(this.armedKey === entry.key ? null : entry.key);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    // Đang kéo bằng ngón tay: không để trình duyệt cuộn danh sách hay mở menu nhấn giữ
    el.addEventListener('touchmove', (e) => { if (this.touchDragging) e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Đang kéo một hóa chất bằng cảm ứng */
  private touchDragging = false;

  private makeGhost(entry: ChemEntry): HTMLElement {
    const g = document.createElement('div');
    g.className = 'chem-ghost';
    g.innerHTML = `<img src="${this.thumbs.get(entry.key) ?? ''}" alt="" />
      <span>${entry.kind === 'tool' ? entry.title : `${this.amounts.get(entry.key)} ${entry.unit} ${entry.formula}`}</span>`;
    document.body.appendChild(g);
    return g;
  }

}
