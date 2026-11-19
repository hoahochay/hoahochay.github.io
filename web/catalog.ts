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
  indicator?: 'phenolphthalein' | 'methyl orange' | 'anthocyanin';
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
  reagent('hcl01', 'HCl', '0,1M', 'hydrochloric acid', { HCl: 0.1 }, { aka: 'hcl loang 0,1m' }),
  reagent('hcl05', 'HCl', '0,5M', 'hydrochloric acid', { HCl: 0.5 }),
  reagent('hcl_dac', 'HCl', 'đặc', 'hydrochloric acid đặc (≈ 37%)', { HCl: 12 }, { aka: 'hcl dac axit clohidric dac 37%' }),
  reagent('hno3', 'HNO₃', '1M', 'nitric acid loãng', { HNO3: 1 }),
  reagent('h2so4', 'H₂SO₄', '0,5M', 'sulfuric acid loãng', { H2SO4: 0.5 }),
  reagent('acetic', 'CH₃COOH', '1M', 'acetic acid', { CH3COOH: 1 }),
  // Giấm ăn: acetic acid khoảng 5% (≈ 0,83 M)
  reagent('ch3cooh_10', 'CH₃COOH', '10%', 'acetic acid', { CH3COOH: 1.67 }, { aka: 'acetic acid 10% axit axetic' }),
  reagent('vinegar', 'CH₃COOH', '5%', 'giấm ăn', { CH3COOH: 0.83 }, { aka: 'vinegar acetic acid giam' }),
  reagent('h2so4_01', 'H₂SO₄', '0,1M', 'sulfuric acid loãng', { H2SO4: 0.1 }),
  reagent('h2so4_2', 'H₂SO₄', '2M', 'sulfuric acid', { H2SO4: 2 }),
  reagent('h2so4_70', 'H₂SO₄', '70%', 'sulfuric acid đặc', { H2SO4: 11.5 }, { aka: 'axit sunfuric dac h2so4 dac sulfuric acid dac' }),
  reagent('naoh', 'NaOH', '1M', 'sodium hydroxide', { NaOH: 1 }),
  reagent('naoh05', 'NaOH', '0,5M', 'sodium hydroxide', { NaOH: 0.5 }),
  reagent('naoh_10', 'NaOH', '10%', 'sodium hydroxide', { NaOH: 2.75 }),
  reagent('naoh_2m', 'NaOH', '2M', 'sodium hydroxide', { NaOH: 2 }),
  reagent('naoh_20', 'NaOH', '20%', 'sodium hydroxide', { NaOH: 6.1 }),
  reagent('nh3', 'NH₃', '1M', 'dung dịch ammonia', { NH3: 1 }),
  reagent('nh3_5', 'NH₃', '5%', 'dung dịch ammonia', { NH3: 2.9 }),
  reagent('ch3coona', 'CH₃COONa', '0,5M', 'sodium acetate', { CH3COONa: 0.5 }, { aka: 'natri axetat sodium acetate' }),
  reagent('na2co3', 'Na₂CO₃', '0,5M', 'sodium carbonate', { Na2CO3: 0.5 }),
  reagent('na2co3_10', 'Na₂CO₃', '10%', 'sodium carbonate', { Na2CO3: 0.94 }),
  reagent('na2co3_2m', 'Na₂CO₃', '2M', 'sodium carbonate', { Na2CO3: 2 }),
  reagent('naf', 'NaF', '0,1M', 'sodium fluoride', { NaF: 0.1 }),
  reagent('nacl', 'NaCl', '0,1M', 'sodium chloride', { NaCl: 0.1 }),
  reagent('saltwater', 'Nước muối', '', 'muối ăn pha nước', { NaCl: 0.15 }, { aka: 'nuoc muoi an sinh li nacl' }),
  reagent('soda_water', 'Nước soda', '', 'soda (sodium carbonate) pha nước', { Na2CO3: 0.1 }, { aka: 'nuoc soda so da na2co3 sodium carbonate tay rua' }),
  reagent('nabr', 'NaBr', '0,1M', 'sodium bromide', { NaBr: 0.1 }),
  reagent('nai', 'NaI', '0,1M', 'sodium iodide', { NaI: 0.1 }),
  reagent('na2s2o3_005', 'Na₂S₂O₃', '0,05M', 'sodium thiosulfate', { Na2S2O3: 0.05 }),
  reagent('na2s2o3_01', 'Na₂S₂O₃', '0,10M', 'sodium thiosulfate', { Na2S2O3: 0.1 }),
  reagent('na2s2o3_03', 'Na₂S₂O₃', '0,30M', 'sodium thiosulfate', { Na2S2O3: 0.3 }),
  reagent('cl2_water', 'Nước Cl₂', '0,05M', 'nước chlorine', { Cl2: 0.05 }, { amber: true, aka: 'nuoc clo chlorine cl2' }),
  reagent('br2_sat', 'Nước Br₂', 'bão hòa', 'nước bromine bão hòa', { Br2: 0.2 }, { amber: true, aka: 'nuoc brom bromine br2 bao hoa' }),
  reagent('br2_water', 'Nước Br₂', '0,02M', 'nước bromine loãng', { Br2: 0.02 }, { amber: true, aka: 'nuoc brom bromine br2' }),
  reagent('starch_sol', 'Hồ tinh bột', '1%', 'thuốc thử iodine', { starch: 0.06 }, { aka: 'ho tinh bot starch' }),
  reagent('cano3', 'Ca(NO₃)₂', '0,5M', 'calcium nitrate', { 'Ca(NO3)2': 0.5 }),
  // Nước vôi trong bão hòa ≈ 0,02M; dùng loại pha loãng để thấy rõ cả hai giai đoạn đục → trong
  // (mô hình dung dịch lý tưởng chưa có hệ số hoạt độ, nên đánh giá thấp độ tan của Ca(HCO₃)₂)
  reagent('limewater', 'Ca(OH)₂', 'loãng', 'nước vôi trong', { 'Ca(OH)2': 0.005 }),
  // Đồ dùng hằng ngày (Bài 9 – xác định pH): mô hình gần đúng theo thành phần chính
  reagent('lemon', 'Nước chanh', '', 'đồ uống, chứa citric acid', { H3Cit: 0.25 }, { aka: 'chanh lemon citric acid nuoc qua', color: [0.97, 0.95, 0.72] }),
  reagent('soda', 'Nước ngọt có gas', '', 'đồ uống, chứa khí carbon dioxide', { H2CO3: 0.1, H3Cit: 0.01 }, { aka: 'nuoc ngot co ga soda carbonic' }),
  reagent('dishsoap', 'Nước rửa bát', '', 'chất tẩy rửa dùng trong gia đình', { NaHCO3: 0.01, Na2CO3: 0.0005 }, { aka: 'nuoc rua bat xa phong chat tay rua', color: [0.75, 0.92, 0.7] }),
  reagent('ethanol', 'C₂H₅OH', '96°', 'ethanol (cồn)', { C2H5OH: 16.4 }, { aka: 'ethanol con ruou ancol etylic' }),
  reagent('phenol_sat', 'C₆H₅OH', 'bão hòa', 'dung dịch phenol bão hòa (trắng đục)', { C6H5OH: 1.2 }, { aka: 'phenol bao hoa c6h5oh axit phenic' }),
  reagent('phenol_5', 'C₆H₅OH', '5%', 'dung dịch phenol', { C6H5OH: 0.53 }, { aka: 'phenol c6h5oh axit phenic' }),
  reagent('ch3cho_5', 'CH₃CHO', '5%', 'acetaldehyde (ethanal)', { CH3CHO: 1.13 }, { aka: 'acetaldehyde ethanal andehit axetic anđehit aldehyde' }),
  reagent('glycerol', 'C₃H₅(OH)₃', '', 'glycerol', { glycerol: 13.7 }, { aka: 'glycerol glixerol glyxerin' }),
  reagent('h2o2', 'H₂O₂', '3%', 'nước oxy già', { H2O2: 0.88 }, { amber: true, aka: 'hydrogen peroxide' }),
  reagent('h2o2_10', 'H₂O₂', '10%', 'hydrogen peroxide', { H2O2: 2.94 }, { amber: true, aka: 'nuoc oxy gia hydrogen peroxide 10' }),
  reagent('agno3', 'AgNO₃', '0,1M', 'silver nitrate', { AgNO3: 0.1 }, { amber: true }),
  reagent('agno3_1', 'AgNO₃', '1%', 'silver nitrate', { AgNO3: 0.059 }, { amber: true }),
  reagent('cuso4', 'CuSO₄', '0,5M', 'copper(II) sulfate', { CuSO4: 0.5 }),
  reagent('cuso4_2', 'CuSO₄', '2%', 'copper(II) sulfate', { CuSO4: 0.13 }),
  reagent('cuso4_5', 'CuSO₄', '5%', 'copper(II) sulfate', { CuSO4: 0.32 }),
  reagent('fecl3', 'FeCl₃', '0,1M', 'iron(III) chloride', { FeCl3: 0.1 }),
  reagent('alcl3', 'AlCl₃', '0,1M', 'aluminium chloride', { AlCl3: 0.1 }),
  reagent('feso4', 'FeSO₄', '0,1M', 'iron(II) sulfate', { FeSO4: 0.1 }),
  reagent('bacl2', 'BaCl₂', '0,1M', 'barium chloride', { BaCl2: 0.1 }),
  reagent('na2so4', 'Na₂SO₄', '0,1M', 'sodium sulfate', { Na2SO4: 0.1 }),
  reagent('pbno3', 'Pb(NO₃)₂', '0,01M', 'lead(II) nitrate', { 'Pb(NO3)2': 0.01 }),
  reagent('ki', 'KI', '0,02M', 'potassium iodide', { KI: 0.02 }),
  reagent('phenol', 'Phenolphthalein', 'chỉ thị', 'phenolphthalein', {}, {
    indicator: 'phenolphthalein', color: [0.97, 0.97, 0.97],
  }),
  reagent('cabbage', 'Dịch bắp cải tím', 'chỉ thị', 'chất chỉ thị tự làm từ bắp cải tím', {}, {
    indicator: 'anthocyanin', color: [0.42, 0.2, 0.62], aka: 'bap cai tim hoa dau biec anthocyanin chat chi thi tu nhien',
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
  { key: 'cu_foil', id: 'Cu', label: 'Lá đồng (cắt nhỏ)', aka: 'copper la dong phoi bao', grams: 0.15, form: 'strip', shape: 'ribbon' },
  { key: 'cu', id: 'Cu', label: 'Dây đồng', aka: 'copper', grams: 1, form: 'strip', shape: 'wire' },
  { key: 'na', id: 'Na', label: 'Sodium (mẩu)', grams: 0.1, form: 'granule', shape: 'chunk', floats: true },
  { key: 'li', id: 'Li', label: 'Lithium (mẩu)', grams: 0.02, form: 'granule', shape: 'chunk', floats: true },
  { key: 'k', id: 'K', label: 'Potassium (mẩu)', grams: 0.05, form: 'granule', shape: 'chunk', floats: true, flame: 0xc58cff },
  { key: 'caco3', id: 'CaCO3', label: 'Đá vôi', aka: 'calcium carbonate da voi vien', grams: 0.5, form: 'granule', shape: 'granule' },
  { key: 'caco3_powder', id: 'CaCO3', label: 'Đá vôi (bột)', aka: 'calcium carbonate da voi bot dap nho', grams: 1, form: 'powder', shape: 'powder' },
  { key: 'fe_powder', id: 'Fe', label: 'Bột sắt', aka: 'iron powder', grams: 0.7, form: 'powder', shape: 'powder' },
  { key: 's_powder', id: 'S', label: 'Bột lưu huỳnh', aka: 'sulfur', grams: 0.4, form: 'powder', shape: 'powder' },
  { key: 'baking_soda', id: 'NaHCO3', label: 'Bột baking soda', aka: 'sodium hydrogencarbonate bot no', grams: 0.2, form: 'powder', shape: 'powder' },
  { key: 'salt', id: 'NaCl', label: 'Muối ăn', aka: 'sodium chloride natri clorua muoi an', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'cuso4_solid', id: 'CuSO4', label: 'Copper(II) sulfate (tinh thể)', aka: 'dong sunfat phen xanh cuso4 ran', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'rice_flour', id: 'starch', label: 'Bột gạo', aka: 'tinh bot bot san sua bot', grams: 0.75, form: 'powder', shape: 'powder' },
  { key: 'vitc', id: 'VitC', label: 'Viên vitamin C sủi', aka: 'vitamin c sui vien sui c sui citric acid', grams: 0.25, form: 'granule', shape: 'chunk' },
  { key: 'kclo3', id: 'KClO3', label: 'Potassium chlorate', aka: 'kali clorat kclo3 dieu che oxygen oxi', grams: 0.5, form: 'powder', shape: 'powder' },
  { key: 'cacl2_solid', id: 'CaCl2', label: 'Calcium chloride khan', aka: 'canxi clorua cacl2 ran khan', grams: 5, form: 'powder', shape: 'powder' },
  { key: 'nh4cl', id: 'NH4Cl', label: 'Phân đạm ammonium chloride', aka: 'nh4cl amoni clorua phan dam', grams: 1, form: 'powder', shape: 'powder' },
  { key: 'kno3', id: 'KNO3', label: 'Phân bón potassium nitrate', aka: 'kno3 kali nitrat phan bon diem tieu', grams: 1, form: 'powder', shape: 'powder' },
  { key: 'kmno4', id: 'KMnO4', label: 'Thuốc tím', aka: 'potassium permanganate kmno4 thuoc tim kali pemanganat', grams: 0.2, form: 'powder', shape: 'powder' },
  { key: 'cao', id: 'CaO', label: 'Vôi sống (cục)', aka: 'calcium oxide cao voi song', grams: 1, form: 'granule', shape: 'chunk' },
  { key: 'na2o', id: 'Na2O', label: 'Sodium oxide', aka: 'natri oxit na2o', grams: 0.1, form: 'powder', shape: 'powder' },
  { key: 'mgo', id: 'MgO', label: 'Magnesium oxide', aka: 'magie oxit mgo', grams: 0.1, form: 'powder', shape: 'powder' },
  { key: 'p2o5', id: 'P2O5', label: 'Diphosphorus pentoxide', aka: 'diphotpho pentaoxit p2o5 p4o10', grams: 0.1, form: 'powder', shape: 'powder' },
  { key: 'cuo', id: 'CuO', label: 'Copper(II) oxide (bột)', aka: 'dong oxit cuo bot den oxide base', grams: 0.08, form: 'powder', shape: 'powder' },
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

const SOLID_FORMULA: Record<string, string> = { Li: 'Li', K: 'K', Mg: 'Mg', Zn: 'Zn', Fe: 'Fe', Cu: 'Cu', Na: 'Na', CaCO3: 'CaCO₃', MnO2: 'MnO₂', S: 'S', NaHCO3: 'NaHCO₃', NaCl: 'NaCl', CuSO4: 'CuSO₄', starch: 'Bột gạo', CuO: 'CuO', CaO: 'CaO', KMnO4: 'KMnO₄', NH4Cl: 'NH₄Cl', KNO3: 'KNO₃', Na2O: 'Na₂O', MgO: 'MgO', P2O5: 'P₂O₅', CaCl2: 'CaCl₂', KClO3: 'KClO₃', VitC: 'Vitamin C sủi' };

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
    ['litmus_sol', 'litmus_sol', 'Giấy quỳ tím', 'Thử dung dịch acid / base', 'quy tim dung dich acid base axit bazo thu mau'],
    ['ph_paper', 'ph_paper', 'Giấy pH', 'Đo pH dung dịch theo bảng màu', 'giay ph thang ph chi thi van nang do ph'],
    ['ph_moist', 'ph_moist', 'Giấy pH ẩm', 'Thử khí: đưa vào miệng ống, đọc pH', 'giay ph am thu khi nh3 ammonia miệng ong mieng ong'],
    ['ice_bath', 'ice_bath', 'Cốc nước đá', 'Ngâm ống nghiệm ở khoảng 0 °C (thả lần nữa để lấy ra)', 'coc nuoc da lanh ngam ong lam lanh nhiet do can bang'],
    ['hot_bath', 'hot_bath', 'Cốc nước nóng', 'Ngâm ống nghiệm ở khoảng 80 °C (thả lần nữa để lấy ra)', 'coc nuoc nong ngam ong cach thuy dun nhiet do can bang'],
    ['no2_tube', 'no2_tube', 'Khí NO₂ (nút kín)', 'Nạp khí nitrogen dioxide vào ống khô rồi đậy nút', 'khi no2 nitrogen dioxide nito dioxit n2o4 nau do can bang ong nut kin'],
    ['spoon_s', 'spoon_s', 'Muôi sắt + lưu huỳnh', 'Đốt lưu huỳnh trên đèn cồn rồi đưa vào bình (vd. bình oxygen)', 'muoi sat dot luu huynh sulfur chay binh oxygen so2'],
    ['magnet', 'magnet', 'Nam châm', 'Thử sắt trong hỗn hợp', 'nam cham hut sat tu tinh'],
    ['dye_paper', 'dye_paper', 'Mẩu giấy màu ẩm', 'Thử tính tẩy màu của khí chlorine', 'giay mau am tay mau chlorine clo cl2'],
    ['xcard', 'xcard', 'Tờ giấy kẻ chữ X', 'Bấm giờ đến khi dung dịch đục che khuất chữ X', 'giay chu x dong ho bam gio toc do phan ung do duc luu huynh thiosulfate'],
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
  AgBr: 'vàng nhạt',
  AgI: 'vàng',
  'S(coll)': 'trắng ngà',
  'Al(OH)3': 'trắng keo',
  'C6H5OH(l)': 'trắng đục',
  C6H2Br3OH: 'trắng',
  Ag2O: 'nâu đen',
  'Ag(mirror)': 'sáng bạc',
  Cu2O: 'đỏ gạch',
  Cu: 'đỏ',
  Ag: 'xám bạc',
};
