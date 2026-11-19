/**
 * Pin điện và điện phân (SGK Hóa 12 Chương 5).
 *
 * - Pin đơn giản: hai thanh kim loại khác nhau cắm trong dung dịch chất điện li (nước chanh, dung dịch muối).
 *   Vôn kế đo được hiệu điện thế giữa hai kim loại. Kim loại hoạt động mạnh hơn là cực âm (anode).
 *   Hiệu điện thế thực tế đo trong dung dịch acid loãng nhỏ hơn hiệu thế điện cực chuẩn (kim loại không ở
 *   trong dung dịch muối 1 M của chính nó, nhôm có lớp oxide bảo vệ…), nên dùng bảng thế điện cực đo thực
 *   tế trong dung dịch điện li loãng (dãy điện hóa thực nghiệm), lấy đồng làm mốc.
 * - Điện phân với điện cực trơ (than chì): dòng điện I (A) cho I/F mol electron mỗi giây.
 *   Cathode: ion kim loại sau H trong dãy điện hóa (Cu²⁺, Ag⁺) bị khử trước; nếu không có thì nước bị khử.
 *   Anode: ion Cl⁻ bị oxi hóa trước; nếu không có thì nước bị oxi hóa (SO₄²⁻, NO₃⁻ không bị điện phân).
 */
import type { KineticReaction } from './kinetics';
import { Mixture } from './mixture';

/** Hằng số Faraday, C/mol */
export const FARADAY = 96485;

/** Thế điện cực chuẩn E° (V) của cặp Mⁿ⁺/M */
export const E_STANDARD: Record<string, number> = {
  Mg: -2.356, Al: -1.676, Zn: -0.762, Fe: -0.44, Sn: -0.137, Pb: -0.126, Cu: 0.34, Ag: 0.799,
};

/** Thế điện cực đo trong dung dịch điện li loãng (nước chanh, nước muối), so với đồng, V */
const E_PRACTICAL: Record<string, number> = {
  Mg: -1.55, Zn: -0.95, Al: -0.6, Fe: -0.5, Sn: -0.3, Pb: -0.3, Cu: 0, Ag: 0.1,
};

const METAL_NAME: Record<string, string> = {
  Mg: 'magnesium', Al: 'nhôm', Zn: 'kẽm', Fe: 'sắt', Sn: 'thiếc', Pb: 'chì', Cu: 'đồng', Ag: 'bạc',
};

export interface CellReading {
  /** Số chỉ vôn kế, V */
  volts: number;
  /** Kim loại làm cực âm (anode) và cực dương (cathode) */
  anode: string;
  cathode: string;
  anodeName: string;
  cathodeName: string;
}

/**
 * Số chỉ của vôn kế nối với hai thanh kim loại trong dụng cụ.
 * null: không có dung dịch điện li hoặc không có hai thanh kim loại.
 * Nếu chỉ có một loại kim loại (hai thanh cùng loại) thì volts = 0.
 */
export function cellReading(mix: Mixture): CellReading | null {
  if (mix.volumeL < 1e-6) return null;
  const metals = Object.keys(E_PRACTICAL).filter((m) => mix.get(m) > 1e-5 && mix.surface(m) > 0);
  if (metals.length === 0) return null;
  // Dung dịch phải dẫn điện: có ion
  let ions = 0;
  for (const [id, n] of mix.moles) if (/[+-]$/.test(id) && !/^(H\+|OH-)$/.test(id)) ions += n;
  ions += mix.get('H3Cit') * 0.05 + mix.get('H2Cit-') + mix.get('H+');
  const conductive = ions / mix.volumeL > 1e-3;
  metals.sort((a, b) => E_PRACTICAL[a] - E_PRACTICAL[b]);
  const anode = metals[0], cathode = metals[metals.length - 1];
  const volts = conductive ? E_PRACTICAL[cathode] - E_PRACTICAL[anode] : 0;
  return { volts, anode, cathode, anodeName: METAL_NAME[anode], cathodeName: METAL_NAME[cathode] };
}

/** Phần dòng điện dùng để khử ion kim loại ở cathode (còn lại khử nước) */
function cathodeShare(mix: Mixture, ion: string): number {
  const c = mix.conc(ion);
  return c / (c + 0.002);
}

/** Phần dòng điện dùng để oxi hóa Cl⁻ ở anode */
function chlorideShare(mix: Mixture): number {
  const c = mix.conc('Cl-');
  return c / (c + 0.01);
}

const electrons = (mix: Mixture) => (mix.current > 0 && mix.volumeL > 1e-6 ? mix.current / FARADAY : 0);

/** Các quá trình ở điện cực khi điện phân (tốc độ theo dòng điện, không theo nhiệt độ) */
export const ELECTROLYSIS: KineticReaction[] = [
  {
    id: 'elec_cathode_ag', name: 'Cathode: khử ion Ag⁺',
    equation: 'Ag⁺ + 1e → Ag',
    reactants: { 'Ag+': 1 }, products: { Ag: 1 },
    rate: ({ mix }) => electrons(mix) * cathodeShare(mix, 'Ag+'),
    productForm: 'strip',
  },
  {
    id: 'elec_cathode_cu', name: 'Cathode: khử ion Cu²⁺',
    equation: 'Cu²⁺ + 2e → Cu',
    reactants: { 'Cu^2+': 1 }, products: { Cu: 1 },
    rate: ({ mix }) => (electrons(mix) / 2) * (1 - cathodeShare(mix, 'Ag+')) * cathodeShare(mix, 'Cu^2+'),
    productForm: 'strip',
  },
  {
    id: 'elec_cathode_h2o', name: 'Cathode: khử nước',
    equation: '2H₂O + 2e → H₂↑ + 2OH⁻',
    reactants: { H2O: 2 }, products: { H2: 1, 'OH-': 2 },
    rate: ({ mix }) => (electrons(mix) / 2) * (1 - cathodeShare(mix, 'Ag+')) * (1 - cathodeShare(mix, 'Cu^2+')),
  },
  {
    id: 'elec_anode_cl', name: 'Anode: oxi hóa ion Cl⁻',
    equation: '2Cl⁻ → Cl₂ + 2e',
    reactants: { 'Cl-': 2 }, products: { Cl2: 1 },
    rate: ({ mix }) => (electrons(mix) / 2) * chlorideShare(mix),
  },
  {
    id: 'elec_anode_h2o', name: 'Anode: oxi hóa nước',
    equation: '2H₂O → O₂↑ + 4H⁺ + 4e',
    reactants: { H2O: 2 }, products: { O2: 1, 'H+': 4 },
    rate: ({ mix }) => (electrons(mix) / 4) * (1 - chlorideShare(mix)),
  },
];
