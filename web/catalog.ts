/** Danh mục hóa chất trên kệ và chất rắn trên khay */
import { gramsToMol, makeSolution, RGB, solutionColor, SolidForm } from '../src';
import type { ToolKind } from './probes';

export interface ReagentDef {
  key: string;
  /** Công thức hiển thị trên nhãn */
  formula: string;
  /** Nồng độ hiển thị trên nhãn */
  conc: string;
  name: string;
  solutes: Record<string, number>;
  indicator?: 'phenolphthalein' | 'methyl orange';
  /** Lọ thủy tinh màu nâu (hóa chất nhạy sáng) */
  amber?: boolean;
  /** Màu dung dịch trong lọ */
  color: RGB;
}

function reagent(
  key: string, formula: string, conc: string, name: string,
  solutes: Record<string, number>, extra: Partial<ReagentDef> = {},
): ReagentDef {
  const color = extra.color ?? solutionColor(makeSolution(solutes, 0.01), 2.5);
  return { key, formula, conc, name, solutes, ...extra, color };
}

export const REAGENTS: ReagentDef[] = [
  reagent('water', 'H₂O', 'nước cất', 'nước cất', {}),
  reagent('hcl', 'HCl', '1M', 'axit clohiđric', { HCl: 1 }),
  reagent('h2so4', 'H₂SO₄', '0,5M', 'axit sunfuric loãng', { H2SO4: 0.5 }),
  reagent('acetic', 'CH₃COOH', '1M', 'axit axetic', { CH3COOH: 1 }),
  reagent('naoh', 'NaOH', '1M', 'natri hiđroxit', { NaOH: 1 }),
  reagent('nh3', 'NH₃', '1M', 'dung dịch amoniac', { NH3: 1 }),
  reagent('na2co3', 'Na₂CO₃', '0,5M', 'natri cacbonat', { Na2CO3: 0.5 }),
  reagent('nacl', 'NaCl', '0,1M', 'natri clorua', { NaCl: 0.1 }),
  reagent('h2o2', 'H₂O₂', '3%', 'nước oxi già', { H2O2: 0.88 }, { amber: true }),
  reagent('agno3', 'AgNO₃', '0,1M', 'bạc nitrat', { AgNO3: 0.1 }, { amber: true }),
  reagent('cuso4', 'CuSO₄', '0,5M', 'đồng(II) sunfat', { CuSO4: 0.5 }),
  reagent('fecl3', 'FeCl₃', '0,1M', 'sắt(III) clorua', { FeCl3: 0.1 }),
  reagent('feso4', 'FeSO₄', '0,1M', 'sắt(II) sunfat', { FeSO4: 0.1 }),
  reagent('bacl2', 'BaCl₂', '0,1M', 'bari clorua', { BaCl2: 0.1 }),
  reagent('pbno3', 'Pb(NO₃)₂', '0,01M', 'chì(II) nitrat', { 'Pb(NO3)2': 0.01 }),
  reagent('ki', 'KI', '0,02M', 'kali iođua', { KI: 0.02 }),
  reagent('phenol', 'Phenolphtalein', 'chỉ thị', 'phenolphtalein', {}, {
    indicator: 'phenolphthalein', color: [0.97, 0.97, 0.97],
  }),
  reagent('mo', 'Metyl da cam', 'chỉ thị', 'metyl da cam', {}, {
    indicator: 'methyl orange', color: [0.95, 0.45, 0.08],
  }),
];

export type SolidShape = 'ribbon' | 'nail' | 'wire' | 'granule' | 'chunk' | 'powder';

export interface SolidItem {
  key: string;
  /** id chất trong engine */
  id: string;
  label: string;
  /** Khối lượng mặc định, g */
  grams: number;
  form: SolidForm;
  shape: SolidShape;
  /** Nổi trên mặt nước (Na) */
  floats?: boolean;
}

export const SOLID_ITEMS: SolidItem[] = [
  { key: 'mg_strip', id: 'Mg', label: 'Magie (dải)', grams: 0.05, form: 'strip', shape: 'ribbon' },
  { key: 'mg_powder', id: 'Mg', label: 'Magie (bột)', grams: 0.05, form: 'powder', shape: 'powder' },
  { key: 'zn', id: 'Zn', label: 'Kẽm (viên)', grams: 0.5, form: 'granule', shape: 'granule' },
  { key: 'fe', id: 'Fe', label: 'Đinh sắt', grams: 2, form: 'strip', shape: 'nail' },
  { key: 'cu', id: 'Cu', label: 'Dây đồng', grams: 1, form: 'strip', shape: 'wire' },
  { key: 'na', id: 'Na', label: 'Natri (mẩu)', grams: 0.1, form: 'granule', shape: 'chunk', floats: true },
  { key: 'caco3', id: 'CaCO3', label: 'Đá vôi', grams: 0.5, form: 'granule', shape: 'granule' },
  { key: 'mno2', id: 'MnO2', label: 'Mangan đioxit (bột)', grams: 0.1, form: 'powder', shape: 'powder' },
];

export function solidMol(item: SolidItem, grams: number): number {
  return gramsToMol(item.id, grams);
}

/** Một mục trong kho hóa chất (ô tìm kiếm) */
export interface ChemEntry {
  key: string;
  kind: 'solution' | 'indicator' | 'solid' | 'tool';
  title: string;
  formula: string;
  sub: string;
  unit: string;
  defaultAmount: number;
  step: number;
  max: number;
  reagent?: ReagentDef;
  solid?: SolidItem;
  tool?: ToolKind;
  /** Chuỗi đã chuẩn hóa để tìm kiếm */
  search: string;
}

const SUBS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

/** Bỏ dấu tiếng Việt, chỉ số dưới → số thường, chữ thường */
export function normalize(s: string): string {
  return s
    .replace(/[₀-₉]/g, (c) => SUBS[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

const SOLID_FORMULA: Record<string, string> = { Mg: 'Mg', Zn: 'Zn', Fe: 'Fe', Cu: 'Cu', Na: 'Na', CaCO3: 'CaCO₃', MnO2: 'MnO₂' };

export const CHEMICALS: ChemEntry[] = [
  ...REAGENTS.map((r): ChemEntry => {
    const ind = !!r.indicator;
    const title = r.name.charAt(0).toUpperCase() + r.name.slice(1);
    return {
      key: r.key, kind: ind ? 'indicator' : 'solution', title, formula: r.formula, sub: r.conc,
      unit: ind ? 'giọt' : 'mL', defaultAmount: ind ? 2 : 2, step: ind ? 1 : 0.5, max: ind ? 20 : 100,
      reagent: r, search: normalize(`${title} ${r.formula} ${r.conc} ${ind ? 'chi thi' : 'dung dich'}`),
    };
  }),
  ...SOLID_ITEMS.map((i): ChemEntry => ({
    key: i.key, kind: 'solid', title: i.label, formula: SOLID_FORMULA[i.id] ?? i.id, sub: 'chất rắn',
    unit: 'g', defaultAmount: i.grams, step: 0.05, max: 10,
    solid: i, search: normalize(`${i.label} ${SOLID_FORMULA[i.id] ?? i.id} ${i.id} chat ran kim loai`),
  })),
  ...([
    ['splint_glow', 'glowing', 'Que đóm còn tàn đỏ', 'Thử khí O₂', 'oxi o2'],
    ['splint_burn', 'burning', 'Que đóm đang cháy', 'Thử khí H₂, CO₂', 'hidro h2 co2 cacbonic chay'],
    ['litmus', 'litmus', 'Giấy quỳ tím ẩm', 'Thử khí axit / bazơ', 'quy tim nh3 amoniac co2 axit bazo'],
  ] as const).map(([key, tool, title, sub, kw]): ChemEntry => ({
    key, kind: 'tool', title, formula: title, sub, unit: '', defaultAmount: 1, step: 1, max: 1, tool,
    search: normalize(`${title} ${sub} ${kw} dung cu thu khi`),
  })),
];

/** Tên màu kết tủa / chất rắn theo SGK */
export const SOLID_COLOR_NAME: Record<string, string> = {
  AgCl: 'trắng',
  'Cu(OH)2': 'xanh lơ',
  'Fe(OH)2': 'trắng xanh',
  'Fe(OH)3': 'nâu đỏ',
  'Mg(OH)2': 'trắng',
  CaCO3: 'trắng',
  BaSO4: 'trắng',
  PbI2: 'vàng',
  Cu: 'đỏ',
  Ag: 'xám bạc',
};
