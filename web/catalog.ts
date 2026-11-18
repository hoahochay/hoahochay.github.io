/** Danh mục hóa chất trên kệ và chất rắn trên khay */
import { gramsToMol, makeSolution, RGB, solutionColor, SolidForm } from '../src';
import type { ToolKind } from './probes';

export type LabTool = ToolKind | 'delivery' | 'syringe' | 'balance';

export interface ReagentDef {
  key: string;
  /** Công thức hiển thị trên nhãn */
  formula: string;
  /** Nồng độ hiển thị trên nhãn */
  conc: string;
  name: string;
  solutes: Record<string, number>;
  indicator?: 'phenolphthalein' | 'methyl orange';
  /** Tên khác để ô tìm kiếm hiểu (vd. tên IUPAC của chất ghi tên đời thường) */
  aka?: string;
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
  reagent('hcl', 'HCl', '1M', 'hydrochloric acid', { HCl: 1 }),
  reagent('h2so4', 'H₂SO₄', '0,5M', 'sulfuric acid loãng', { H2SO4: 0.5 }),
  reagent('acetic', 'CH₃COOH', '1M', 'acetic acid', { CH3COOH: 1 }),
  // Giấm ăn: acetic acid khoảng 5% (≈ 0,83 M)
  reagent('vinegar', 'CH₃COOH', '5%', 'giấm ăn', { CH3COOH: 0.83 }, { aka: 'vinegar acetic acid giam' }),
  reagent('naoh', 'NaOH', '1M', 'sodium hydroxide', { NaOH: 1 }),
  reagent('nh3', 'NH₃', '1M', 'dung dịch ammonia', { NH3: 1 }),
  reagent('na2co3', 'Na₂CO₃', '0,5M', 'sodium carbonate', { Na2CO3: 0.5 }),
  reagent('nacl', 'NaCl', '0,1M', 'sodium chloride', { NaCl: 0.1 }),
  reagent('cano3', 'Ca(NO₃)₂', '0,5M', 'calcium nitrate', { 'Ca(NO3)2': 0.5 }),
  // Nước vôi trong bão hòa ≈ 0,02M; dùng loại pha loãng để thấy rõ cả hai giai đoạn đục → trong
  // (mô hình dung dịch lý tưởng chưa có hệ số hoạt độ, nên đánh giá thấp độ tan của Ca(HCO₃)₂)
  reagent('limewater', 'Ca(OH)₂', 'loãng', 'nước vôi trong', { 'Ca(OH)2': 0.005 }),
  reagent('h2o2', 'H₂O₂', '3%', 'nước oxy già', { H2O2: 0.88 }, { amber: true, aka: 'hydrogen peroxide' }),
  reagent('agno3', 'AgNO₃', '0,1M', 'silver nitrate', { AgNO3: 0.1 }, { amber: true }),
  reagent('cuso4', 'CuSO₄', '0,5M', 'copper(II) sulfate', { CuSO4: 0.5 }),
  reagent('fecl3', 'FeCl₃', '0,1M', 'iron(III) chloride', { FeCl3: 0.1 }),
  reagent('feso4', 'FeSO₄', '0,1M', 'iron(II) sulfate', { FeSO4: 0.1 }),
  reagent('bacl2', 'BaCl₂', '0,1M', 'barium chloride', { BaCl2: 0.1 }),
  reagent('na2so4', 'Na₂SO₄', '0,1M', 'sodium sulfate', { Na2SO4: 0.1 }),
  reagent('pbno3', 'Pb(NO₃)₂', '0,01M', 'lead(II) nitrate', { 'Pb(NO3)2': 0.01 }),
  reagent('ki', 'KI', '0,02M', 'potassium iodide', { KI: 0.02 }),
  reagent('phenol', 'Phenolphthalein', 'chỉ thị', 'phenolphthalein', {}, {
    indicator: 'phenolphthalein', color: [0.97, 0.97, 0.97],
  }),
  reagent('mo', 'Methyl orange', 'chỉ thị', 'methyl orange', {}, {
    indicator: 'methyl orange', color: [0.95, 0.45, 0.08],
  }),
];

export type SolidShape = 'ribbon' | 'nail' | 'wire' | 'granule' | 'chunk' | 'powder';

export interface SolidItem {
  key: string;
  /** id chất trong engine */
  id: string;
  label: string;
  /** Tên khác để ô tìm kiếm hiểu */
  aka?: string;
  /** Khối lượng mặc định, g */
  grams: number;
  form: SolidForm;
  shape: SolidShape;
  /** Nổi trên mặt nước (Na) */
  floats?: boolean;
  /** Màu ngọn lửa khi phản ứng mạnh tỏa nhiệt bốc cháy (K) */
  flame?: number;
}

export const SOLID_ITEMS: SolidItem[] = [
  { key: 'mg_strip', id: 'Mg', label: 'Magnesium (dải)', grams: 0.05, form: 'strip', shape: 'ribbon' },
  { key: 'mg_powder', id: 'Mg', label: 'Magnesium (bột)', grams: 0.05, form: 'powder', shape: 'powder' },
  { key: 'zn', id: 'Zn', label: 'Kẽm viên', aka: 'zinc', grams: 0.5, form: 'granule', shape: 'granule' },
  { key: 'fe', id: 'Fe', label: 'Đinh sắt', aka: 'iron', grams: 2, form: 'strip', shape: 'nail' },
  { key: 'cu', id: 'Cu', label: 'Dây đồng', aka: 'copper', grams: 1, form: 'strip', shape: 'wire' },
  { key: 'na', id: 'Na', label: 'Sodium (mẩu)', grams: 0.1, form: 'granule', shape: 'chunk', floats: true },
  { key: 'li', id: 'Li', label: 'Lithium (mẩu)', grams: 0.02, form: 'granule', shape: 'chunk', floats: true },
  { key: 'k', id: 'K', label: 'Potassium (mẩu)', grams: 0.05, form: 'granule', shape: 'chunk', floats: true, flame: 0xc58cff },
  { key: 'caco3', id: 'CaCO3', label: 'Đá vôi', aka: 'calcium carbonate', grams: 0.5, form: 'granule', shape: 'granule' },
  { key: 'fe_powder', id: 'Fe', label: 'Bột sắt', aka: 'iron powder', grams: 0.7, form: 'powder', shape: 'powder' },
  { key: 's_powder', id: 'S', label: 'Bột lưu huỳnh', aka: 'sulfur', grams: 0.4, form: 'powder', shape: 'powder' },
  { key: 'baking_soda', id: 'NaHCO3', label: 'Bột baking soda', aka: 'sodium hydrogencarbonate bot no', grams: 0.2, form: 'powder', shape: 'powder' },
  { key: 'salt', id: 'NaCl', label: 'Muối ăn', aka: 'sodium chloride natri clorua muoi an', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'cuso4_solid', id: 'CuSO4', label: 'Copper(II) sulfate (tinh thể)', aka: 'dong sunfat phen xanh cuso4 ran', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'rice_flour', id: 'starch', label: 'Bột gạo', aka: 'tinh bot bot san sua bot', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'mno2', id: 'MnO2', label: 'Manganese dioxide (bột)', grams: 0.1, form: 'powder', shape: 'powder' },
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
  tool?: LabTool;
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

/** Tên cũ (phiên âm tiếng Việt) để ô tìm kiếm vẫn hiểu khi người dùng gõ "natri", "axit"… */
const LEGACY: Record<string, string> = {
  acid: 'axit', base: 'bazo', hydroxide: 'hidroxit', hydrogen: 'hidro', oxygen: 'oxi', sodium: 'natri',
  potassium: 'kali', lithium: 'liti', magnesium: 'magie', zinc: 'kem', iron: 'sat', copper: 'dong',
  silver: 'bac', calcium: 'canxi', barium: 'bari', lead: 'chi', manganese: 'mangan', chloride: 'clorua',
  sulfate: 'sunfat', sulfuric: 'sunfuric', hydrochloric: 'clohidric', nitrate: 'nitrat', iodide: 'iodua',
  carbonate: 'cacbonat', carbon: 'cacbon', dioxide: 'dioxit', oxide: 'oxit', acetic: 'axetic',
  ammonia: 'amoniac', ammonium: 'amoni', peroxide: 'peoxit oxi gia', phenolphthalein: 'phenolphtalein',
  'methyl orange': 'metyl da cam',
};
function searchText(s: string): string {
  const n = normalize(s);
  return n + ' ' + Object.entries(LEGACY).filter(([k]) => n.includes(k)).map(([, v]) => v).join(' ');
}

const SOLID_FORMULA: Record<string, string> = { Li: 'Li', K: 'K', Mg: 'Mg', Zn: 'Zn', Fe: 'Fe', Cu: 'Cu', Na: 'Na', CaCO3: 'CaCO₃', MnO2: 'MnO₂', S: 'S', NaHCO3: 'NaHCO₃', NaCl: 'NaCl', CuSO4: 'CuSO₄', starch: 'Bột gạo' };

export const CHEMICALS: ChemEntry[] = [
  ...REAGENTS.map((r): ChemEntry => {
    const ind = !!r.indicator;
    const title = r.name.charAt(0).toUpperCase() + r.name.slice(1);
    return {
      key: r.key, kind: ind ? 'indicator' : 'solution', title, formula: r.formula, sub: r.conc,
      unit: ind ? 'giọt' : 'mL', defaultAmount: ind ? 2 : 2, step: ind ? 1 : 0.5, max: ind ? 20 : 100,
      reagent: r, search: searchText(`${title} ${r.aka ?? ''} ${r.formula} ${r.conc} ${ind ? 'chi thi' : 'dung dich'}`),
    };
  }),
  ...SOLID_ITEMS.map((i): ChemEntry => ({
    key: i.key, kind: 'solid', title: i.label, formula: SOLID_FORMULA[i.id] ?? i.id, sub: 'chất rắn',
    unit: 'g', defaultAmount: i.grams, step: 0.05, max: 10,
    solid: i, search: searchText(`${i.label} ${i.aka ?? ''} ${SOLID_FORMULA[i.id] ?? i.id} ${i.id} chat ran kim loai`),
  })),
  ...([
    ['splint_glow', 'glowing', 'Que đóm còn tàn đỏ', 'Thử khí O₂', 'oxygen o2'],
    ['splint_burn', 'burning', 'Que đóm đang cháy', 'Thử khí H₂, CO₂', 'hydrogen h2 co2 carbon dioxide chay'],
    ['litmus', 'litmus', 'Giấy quỳ tím ẩm', 'Thử khí acid / base', 'quy tim nh3 ammonia co2 acid base'],
    ['magnet', 'magnet', 'Nam châm', 'Thử sắt trong hỗn hợp', 'nam cham hut sat tu tinh'],
    ['delivery', 'delivery', 'Ống dẫn khí', 'Dẫn khí sang ống khác', 'ong dan khi thu khi suc khi nut cao su'],
    ['balance', 'balance', 'Cân điện tử', 'Cân dụng cụ, chính xác 0,01 g', 'can dien tu khoi luong bao toan khoi luong tru bi dung cu do'],
    ['syringe', 'syringe', 'Xi lanh đo khí', 'Đo thể tích khí theo thời gian', 'xi lanh gas syringe do the tich khi toc do phan ung do thi dung cu do'],
  ] as const).map(([key, tool, title, sub, kw]): ChemEntry => ({
    key, kind: 'tool', title, formula: title, sub, unit: '', defaultAmount: 1, step: 1, max: 1, tool,
    search: searchText(`${title} ${sub} ${kw} dung cu thu khi`),
  })),
];

/** Tên màu kết tủa / chất rắn theo SGK */
export const SOLID_COLOR_NAME: Record<string, string> = {
  AgCl: 'trắng',
  FeS: 'đen',
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
