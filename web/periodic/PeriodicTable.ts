/** Giao diện bảng tuần hoàn: lưới 18 cột, tô màu theo tính chất, thẻ chi tiết nối với phòng thí nghiệm */
import { normalize } from '../catalog';
import { CATEGORY_INFO, Category, COMMON, Element, ELEMENTS, groupName, STATE_NAME } from './elements';
import { chemicalsFor, recipesFor } from './labLinks';
import { CATEGORIES, categoryOf, TOPICS } from '../recipes';

export interface TableLinks {
  openChemical(key: string): void;
  playRecipe(id: string): void;
  /** Mở / đóng thẻ nguyên tố (để cập nhật đường dẫn) */
  elementChanged?(symbol: string | null): void;
}

type ColorMode = 'category' | 'en' | 'melt' | 'state' | 'year';
type Filter = 'all' | 'first20' | 'common' | 'lab';

const MODES: { id: ColorMode; label: string }[] = [
  { id: 'category', label: 'Loại nguyên tố' },
  { id: 'en', label: 'Độ âm điện' },
  { id: 'melt', label: 'Nhiệt độ nóng chảy' },
  { id: 'state', label: 'Trạng thái (25 °C)' },
  { id: 'year', label: 'Năm phát hiện' },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'first20', label: '20 nguyên tố đầu' },
  { id: 'common', label: 'Thường gặp trong SGK' },
  { id: 'lab', label: 'Có thí nghiệm' },
];

const STATE_COLOR: Record<string, string> = { s: '#c9d3df', l: '#7fb2f0', g: '#f3b4c6', '': '#eceef1' };
const MISSING = '#eceef1';

/** Thang màu liên tục (nội suy giữa các mốc) */
function ramp(stops: string[], t: number): string {
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const EN_RAMP = ['#fff6d5', '#ffd27a', '#f59a5b', '#d9576b', '#8e3b8f'];
const MELT_RAMP = ['#3b6fd8', '#8fb8f2', '#f3f0e6', '#f5a25d', '#c73a2c'];
const YEAR_RAMP = ['#f2e8c9', '#9fd3b8', '#4f9fd0', '#4b4fa6'];

const SCALES: Partial<Record<ColorMode, { min: number; max: number; ramp: string[]; get: (e: Element) => number | null; unit: string; trend: string }>> = {
  en: {
    min: 0.7, max: 4, ramp: EN_RAMP, get: (e) => e.electronegativity, unit: '',
    trend: 'Trong một chu kỳ, độ âm điện tăng từ trái sang phải; trong một nhóm A, giảm dần từ trên xuống. Fluorine có độ âm điện lớn nhất.',
  },
  melt: {
    min: -270, max: 3500, ramp: MELT_RAMP, get: (e) => e.meltC, unit: ' °C',
    trend: 'Các kim loại chuyển tiếp ở giữa bảng có nhiệt độ nóng chảy cao nhất (vonfram 3422 °C). Khí hiếm và halogen đầu nhóm nóng chảy ở nhiệt độ rất thấp.',
  },
  year: {
    min: 1650, max: 2010, ramp: YEAR_RAMP, get: (e) => (e.year === 0 ? null : e.year), unit: '',
    trend: 'Ô viền đậm: được biết từ thời cổ đại (C, S, Fe, Cu, Ag, Sn, Au, Hg, Pb…). Các nguyên tố cuối bảng được tổng hợp nhân tạo sau năm 1940.',
  },
};

function textColor(bg: string): string {
  const m = bg.startsWith('#') ? hex(bg) : bg.match(/\d+/g)!.map(Number);
  const lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  return lum < 0.55 ? '#fff' : '#1d2430';
}

const fmtNum = (x: number, d = 2) => String(+x.toFixed(d)).replace('.', ',');

export class PeriodicTable {
  private mode: ColorMode = 'category';
  private filter: Filter = 'all';
  private query = '';
  private current: Element | null = null;
  private highlightCat: Category | null = null;
  private readonly grid: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly card: HTMLElement;
  private readonly cells = new Map<number, HTMLElement>();
  private readonly labSet: Set<string>;

  constructor(private readonly root: HTMLElement, private readonly links: TableLinks) {
    this.labSet = new Set(ELEMENTS.filter((e) => recipesFor(e.symbol).length > 0).map((e) => e.symbol));
    root.innerHTML = `
      <div class="pt-wrap">
        <header class="pt-head">
          <h1>Bảng tuần hoàn các nguyên tố hóa học</h1>
          <input class="pt-search" type="search" placeholder="Tìm: Na, sodium, sodium, 11…" autocomplete="off" />
        </header>
        <div class="pt-controls">
          <div class="seg pt-modes">${MODES.map((m) => `<button data-mode="${m.id}">${m.label}</button>`).join('')}</div>
          <div class="seg pt-filters">${FILTERS.map((f) => `<button data-filter="${f.id}">${f.label}</button>`).join('')}</div>
        </div>
        <div class="pt-grid"></div>
        <div class="pt-legend"></div>
      </div>
      <aside class="pt-card card hidden"></aside>`;
    this.grid = root.querySelector('.pt-grid')!;
    this.legend = root.querySelector('.pt-legend')!;
    this.card = root.querySelector('.pt-card')!;
    this.buildGrid();

    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = () => {
      this.mode = b.dataset.mode as ColorMode;
      this.paint();
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => (b.onclick = () => {
      this.filter = b.dataset.filter as Filter;
      this.paint();
    }));
    const search = root.querySelector<HTMLInputElement>('.pt-search')!;
    search.oninput = () => {
      this.query = normalize(search.value.trim());
      this.paint();
    };
    search.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      const hit = ELEMENTS.find((x) => this.matches(x));
      if (hit) this.open(hit);
    };
    window.addEventListener('keydown', (e) => {
      if (root.classList.contains('hidden') || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') this.close();
      if (!this.current) return;
      if (e.key === 'ArrowRight') this.open(ELEMENTS[this.current.z % 118]);
      if (e.key === 'ArrowLeft') this.open(ELEMENTS[(this.current.z + 116) % 118]);
    });
    this.paint();
  }

  private buildGrid(): void {
    let html = '<div class="pt-corner"></div>';
    for (let g = 1; g <= 18; g++) {
      html += `<div class="pt-gh" style="grid-column:${g + 1};grid-row:1"><b>${groupName(g)}</b><span>${g}</span></div>`;
    }
    for (let p = 1; p <= 7; p++) html += `<div class="pt-ph" style="grid-column:1;grid-row:${p + 1}">${p}</div>`;
    html += `<div class="pt-fh" style="grid-column:1 / span 3;grid-row:10">Họ Lantan</div>`;
    html += `<div class="pt-fh" style="grid-column:1 / span 3;grid-row:11">Họ Actini</div>`;
    html += `<div class="pt-ref" style="grid-column:4;grid-row:7">57–71</div>`;
    html += `<div class="pt-ref" style="grid-column:4;grid-row:8">89–103</div>`;
    for (const e of ELEMENTS) {
      html += `
        <button class="pt-cell" data-z="${e.z}" style="grid-column:${e.col + 1};grid-row:${e.row + 1}" title="${e.display}${e.display !== e.iupac ? ` (${e.iupac})` : e.name !== e.iupac ? ` (${e.name})` : ''}">
          <span class="z">${e.z}</span>
          <span class="sym">${e.symbol}</span>
          <span class="nm">${e.display}</span>
          <span class="val"></span>
        </button>`;
    }
    this.grid.innerHTML = html;
    this.grid.querySelectorAll<HTMLElement>('.pt-cell').forEach((c) => {
      const e = ELEMENTS[Number(c.dataset.z) - 1];
      this.cells.set(e.z, c);
      c.onclick = () => this.open(e);
    });
  }

  private matches(e: Element): boolean {
    if (this.filter === 'first20' && e.z > 20) return false;
    if (this.filter === 'common' && !COMMON.has(e.symbol)) return false;
    if (this.filter === 'lab' && !this.labSet.has(e.symbol)) return false;
    if (this.highlightCat && e.category !== this.highlightCat) return false;
    if (!this.query) return true;
    if (/^\d+$/.test(this.query)) return String(e.z) === this.query;
    if (e.symbol.toLowerCase() === this.query) return true;
    return normalize(`${e.name} ${e.iupac}`).includes(this.query);
  }

  private colorOf(e: Element): string {
    if (this.mode === 'category') return CATEGORY_INFO[e.category].color;
    if (this.mode === 'state') return STATE_COLOR[e.state];
    const s = SCALES[this.mode]!;
    const v = s.get(e);
    if (v === null) return this.mode === 'year' && e.year === 0 ? '#f2e8c9' : MISSING;
    return ramp(s.ramp, (v - s.min) / (s.max - s.min));
  }

  private valueText(e: Element): string {
    switch (this.mode) {
      case 'en': return e.electronegativity !== null ? fmtNum(e.electronegativity) : '';
      case 'melt': return e.meltC !== null ? `${Math.round(e.meltC)}°` : '';
      case 'year': return e.year === 0 ? 'cổ đại' : e.year !== null ? String(e.year) : '';
      case 'state': return STATE_NAME[e.state];
      default: return e.mass ? (e.massIsotope ? `[${e.mass}]` : fmtNum(e.mass, 2)) : '';
    }
  }

  private paint(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === this.mode));
    this.root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === this.filter));
    for (const e of ELEMENTS) {
      const c = this.cells.get(e.z)!;
      const bg = this.colorOf(e);
      c.style.background = bg;
      c.style.color = textColor(bg);
      c.classList.toggle('dim', !this.matches(e));
      c.classList.toggle('ancient', this.mode === 'year' && e.year === 0);
      c.classList.toggle('sel', this.current === e);
      c.querySelector('.val')!.textContent = this.valueText(e);
    }
    this.renderLegend();
  }

  private renderLegend(): void {
    if (this.mode === 'category') {
      this.legend.innerHTML = `<div class="pt-swatches">${(Object.keys(CATEGORY_INFO) as Category[]).map((k) => `
        <button class="pt-sw ${this.highlightCat === k ? 'on' : ''}" data-cat="${k}">
          <i style="background:${CATEGORY_INFO[k].color}"></i>${CATEGORY_INFO[k].name}
        </button>`).join('')}</div>
        <div class="pt-note">Bấm một loại để làm nổi bật. Đường bậc thang giữa Bo và Atatin chia kim loại (bên trái) và phi kim (bên phải).</div>`;
      this.legend.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.cat as Category;
        this.highlightCat = this.highlightCat === k ? null : k;
        this.paint();
      }));
      return;
    }
    if (this.mode === 'state') {
      this.legend.innerHTML = `<div class="pt-swatches">${(['s', 'l', 'g', ''] as const).map((k) => `
        <span class="pt-sw"><i style="background:${STATE_COLOR[k]}"></i>${STATE_NAME[k]}</span>`).join('')}</div>
        <div class="pt-note">Ở 25 °C chỉ có 2 nguyên tố ở thể lỏng: bromine (Br) và thủy ngân (Hg). Có 11 nguyên tố ở thể khí, đều là phi kim.</div>`;
      return;
    }
    const s = SCALES[this.mode]!;
    const grad = s.ramp.join(', ');
    this.legend.innerHTML = `
      <div class="pt-scale">
        <span>${this.mode === 'year' ? s.min : fmtNum(s.min)}${s.unit}</span>
        <div class="bar" style="background:linear-gradient(90deg, ${grad})"></div>
        <span>${this.mode === 'year' ? s.max : fmtNum(s.max)}${s.unit}</span>
        <span class="pt-sw"><i style="background:${MISSING}"></i>Không có số liệu</span>
      </div>
      <div class="pt-note">${s.trend}</div>`;
  }

  // ── Thẻ chi tiết ──────────────────────────────────────────────────────
  /** Mở thẻ nguyên tố theo kí hiệu (không phân biệt hoa thường); false nếu không có */
  openSymbol(symbol: string): boolean {
    const e = ELEMENTS.find((x) => x.symbol.toLowerCase() === symbol.toLowerCase());
    if (e) this.open(e);
    return !!e;
  }

  open(e: Element): void {
    this.current = e;
    this.links.elementChanged?.(e.symbol);
    this.paint();
    const color = CATEGORY_INFO[e.category].color;
    const predicted = e.z >= 104;
    const chems = chemicalsFor(e.symbol);
    const recipes = recipesFor(e.symbol);
    const row = (k: string, v: string) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');
    this.card.innerHTML = `
      <div class="pc-top">
        <button class="pc-nav" data-d="-1" title="Nguyên tố trước (←)">‹</button>
        <button class="pc-nav" data-d="1" title="Nguyên tố sau (→)">›</button>
        <button class="pc-close" title="Đóng (Esc)">×</button>
      </div>
      <div class="pc-head">
        <div class="pc-tile" style="background:${color};color:${textColor(color)}">
          <span class="z">${e.z}</span><span class="sym">${e.symbol}</span>
          <span class="m">${e.massIsotope ? `[${e.mass}]` : fmtNum(e.mass, 3)}</span>
        </div>
        <div>
          <div class="pc-name">${e.display}</div>
          ${e.display !== e.iupac ? `<div class="pc-iupac">Tên IUPAC: ${e.iupac}</div>` : e.name.toLowerCase() !== e.iupac.toLowerCase() ? `<div class="pc-iupac">Tên tiếng Việt cũ: ${e.name}</div>` : ''}
          <div class="pc-tags">
            <span>${CATEGORY_INFO[e.category].name}${predicted ? ' (dự đoán)' : ''}</span>
            ${e.synthetic ? '<span>Nhân tạo</span>' : ''}
          </div>
        </div>
      </div>
      <div class="pc-bohr">${bohrSvg(e)}<div class="pc-shells">Số electron từng lớp: <b>${e.shells.join(', ')}</b><br>Lớp ngoài cùng có <b>${e.shells[e.shells.length - 1]}</b> electron</div></div>
      <table class="pc-props">
        ${row('Vị trí', `Ô ${e.z}, chu kỳ ${e.period}, nhóm ${groupName(e.group)}${e.group ? ` (nhóm ${e.group})` : ''}`)}
        ${row('Cấu hình electron', `<span class="cfg">${e.config}</span>${predicted ? ' <i>(dự đoán)</i>' : ''}`)}
        ${row('Khối lượng nguyên tử', e.massIsotope ? `${e.mass} (số khối đồng vị bền nhất)` : fmtNum(e.mass, 4))}
        ${row('Độ âm điện', e.electronegativity !== null ? fmtNum(e.electronegativity) : '')}
        ${row('Số oxi hóa thường gặp', e.oxidation)}
        ${row('Trạng thái ở 25 °C', e.state ? STATE_NAME[e.state] : '')}
        ${row('Nhiệt độ nóng chảy', e.meltC !== null ? `${fmtNum(e.meltC, 1)} °C` : '')}
        ${row('Năm phát hiện', e.year === 0 ? 'Từ thời cổ đại' : e.year !== null ? String(e.year) : '')}
      </table>
      ${e.about ? `<p class="pc-about">${e.about}</p>` : ''}
      ${recipes.length ? `
        <div class="sec">Thí nghiệm mẫu có ${e.display.toLowerCase()}</div>
        <div class="pc-recipes">${recipes.map((r) => `
          <button class="pc-recipe" data-recipe="${r.id}"><span>▶</span><b>${r.title}</b><small>${CATEGORIES[categoryOf(r)]} · ${TOPICS[r.topic].title}</small></button>`).join('')}
        </div>` : ''}
      ${chems.length ? `
        <div class="sec">Hóa chất có trong kho</div>
        <div class="pc-chems">${chems.map((c) => `
          <button class="pc-chem" data-chem="${c.key}" title="Mở trong kho hóa chất">${c.kind === 'solid' ? c.title : `${c.formula} <small>${c.sub}</small>`}</button>`).join('')}
        </div>
        <div class="pc-hint">Bấm vào hóa chất để mở phòng thí nghiệm, rồi kéo thả vào ống nghiệm.</div>` : ''}
      ${!recipes.length && !chems.length ? '<div class="pc-hint">Phòng thí nghiệm chưa có hóa chất chứa nguyên tố này.</div>' : ''}`;
    this.card.classList.remove('hidden');
    this.root.querySelector('.pt-wrap')!.classList.add('with-card');
    this.card.scrollTop = 0;
    this.card.querySelector<HTMLButtonElement>('.pc-close')!.onclick = () => this.close();
    this.card.querySelectorAll<HTMLButtonElement>('.pc-nav').forEach((b) => (b.onclick = () => {
      this.open(ELEMENTS[(e.z - 1 + Number(b.dataset.d) + 118) % 118]);
    }));
    this.card.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach((b) => (b.onclick = () => this.links.playRecipe(b.dataset.recipe!)));
    this.card.querySelectorAll<HTMLButtonElement>('[data-chem]').forEach((b) => (b.onclick = () => this.links.openChemical(b.dataset.chem!)));
  }

  close(): void {
    if (this.current) this.links.elementChanged?.(null);
    this.current = null;
    this.card.classList.add('hidden');
    this.root.querySelector('.pt-wrap')!.classList.remove('with-card');
    this.paint();
  }
}

/** Sơ đồ nguyên tử dạng Bohr: hạt nhân và các lớp electron */
function bohrSvg(e: Element): string {
  const n = e.shells.length;
  const R = 74;
  const r0 = 15;
  const step = (R - r0) / n;
  let s = `<svg viewBox="-80 -80 160 160" class="bohr" role="img" aria-label="Sơ đồ các lớp electron của ${e.display}">`;
  s += `<circle r="${r0}" class="nuc"/><text class="nuc-t" y="4">+${e.z}</text>`;
  e.shells.forEach((count, i) => {
    const r = r0 + step * (i + 1);
    s += `<circle r="${r.toFixed(1)}" class="orb${i === n - 1 ? ' outer' : ''}"/>`;
    const shown = Math.min(count, 32);
    for (let k = 0; k < shown; k++) {
      const a = (k / shown) * Math.PI * 2 - Math.PI / 2 + i * 0.35;
      s += `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${n > 5 ? 1.8 : 2.6}" class="el${i === n - 1 ? ' outer' : ''}"/>`;
    }
  });
  return s + '</svg>';
}
