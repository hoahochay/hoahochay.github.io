/** Kho hóa chất: tìm kiếm, nhập lượng, kéo-thả vào dụng cụ */
import { ChemEntry, normalize } from './catalog';

export interface DropTarget {
  /** Dụng cụ nằm dưới điểm (clientX, clientY), hoặc null */
  hitTest(x: number, y: number): unknown | null;
  hover(target: unknown | null): void;
  drop(entry: ChemEntry, amount: number, target: unknown): void;
}

const GROUPS: { kind: ChemEntry['kind']; title: string }[] = [
  { kind: 'solution', title: 'Dung dịch' },
  { kind: 'solid', title: 'Chất rắn' },
  { kind: 'indicator', title: 'Chất chỉ thị' },
];

const DRAG_THRESHOLD = 5;

export class ChemPanel {
  private readonly amounts = new Map<string, number>();
  private readonly list: HTMLElement;
  private readonly search: HTMLInputElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly entries: ChemEntry[],
    private readonly thumbs: Map<string, string>,
    private readonly target: DropTarget,
  ) {
    for (const e of entries) this.amounts.set(e.key, e.defaultAmount);
    root.innerHTML = `
      <div class="chem-head">
        <div class="chem-title">Kho hóa chất</div>
        <button class="chem-toggle" title="Thu gọn">‹</button>
      </div>
      <div class="chem-body">
        <input class="chem-search" type="search" placeholder="Tìm chất: axit, NaOH, đồng…" autocomplete="off" />
        <div class="chem-hint">Nhập lượng rồi <b>kéo thả</b> vào ống nghiệm hoặc cốc.</div>
        <div class="chem-list"></div>
      </div>`;
    this.list = root.querySelector('.chem-list')!;
    this.search = root.querySelector('.chem-search')!;
    this.search.addEventListener('input', () => this.render());
    root.querySelector<HTMLButtonElement>('.chem-toggle')!.onclick = () => {
      const collapsed = root.classList.toggle('collapsed');
      root.querySelector('.chem-toggle')!.textContent = collapsed ? '›' : '‹';
    };
    this.render();
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
          <div class="chem" data-key="${e.key}" title="Kéo vào ống nghiệm hoặc cốc">
            <img src="${this.thumbs.get(e.key) ?? ''}" alt="" draggable="false" />
            <div class="meta">
              <div class="f">${e.formula} <small>${e.sub}</small></div>
              <div class="n">${e.title}</div>
            </div>
            <label class="amt">
              <input type="number" min="${e.step}" max="${e.max}" step="${e.step}" value="${this.amounts.get(e.key)}" />
              <span>${e.unit}</span>
            </label>
          </div>`;
      }
    }
    this.list.innerHTML = html || '<div class="chem-empty">Không tìm thấy chất nào.</div>';
    this.list.querySelectorAll<HTMLElement>('.chem').forEach((el) => this.bind(el));
  }

  private bind(el: HTMLElement): void {
    const entry = this.entries.find((e) => e.key === el.dataset.key)!;
    const input = el.querySelector('input')!;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (v > 0) this.amounts.set(entry.key, Math.min(entry.max, v));
    });
    input.addEventListener('pointerdown', (ev) => ev.stopPropagation());

    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const start = { x: ev.clientX, y: ev.clientY };
      let ghost: HTMLElement | null = null;
      let over: unknown | null = null;

      const move = (e: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
          ghost = this.makeGhost(entry);
          el.classList.add('dragging');
        }
        ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
        // Chỉ nhận thả khi con trỏ đang ở trên vùng cảnh 3D (không phải trên bảng)
        const onPanel = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('.card');
        const t = onPanel ? null : this.target.hitTest(e.clientX, e.clientY);
        if (t !== over) {
          over = t;
          this.target.hover(t);
          ghost.classList.toggle('ok', !!t);
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        ghost?.remove();
        this.target.hover(null);
        if (ghost && over) this.target.drop(entry, this.amounts.get(entry.key)!, over);
        else if (!ghost) this.flashHint();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  private makeGhost(entry: ChemEntry): HTMLElement {
    const g = document.createElement('div');
    g.className = 'chem-ghost';
    g.innerHTML = `<img src="${this.thumbs.get(entry.key) ?? ''}" alt="" />
      <span>${this.amounts.get(entry.key)} ${entry.unit} ${entry.formula}</span>`;
    document.body.appendChild(g);
    return g;
  }

  private flashHint(): void {
    const h = this.root.querySelector<HTMLElement>('.chem-hint')!;
    h.classList.remove('flash');
    void h.offsetWidth;
    h.classList.add('flash');
  }
}
