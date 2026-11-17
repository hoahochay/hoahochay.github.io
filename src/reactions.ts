/**
 * Cơ sở dữ liệu phản ứng chậm (động học).
 *
 * Hằng số tốc độ được hiệu chỉnh để THỜI GIAN phản ứng khớp với thí nghiệm thật ở trường
 * (vd. 0,05 g dải Mg trong 10 mL HCl 1M tan hết trong khoảng 1 phút), không phải số đo
 * động học chính xác. Ea lấy gần với giá trị trong tài liệu.
 */
import { KineticReaction, massAction } from './kinetics';

export const REACTIONS: KineticReaction[] = [
  // ── Kim loại + acid ──────────────────────────────────────────────────
  {
    id: 'mg_acid', name: 'Magnesium tác dụng với acid',
    equation: 'Mg + 2H⁺ → Mg²⁺ + H₂↑',
    reactants: { Mg: 1, 'H+': 2 }, products: { 'Mg^2+': 1, H2: 1 },
    rate: massAction({ k25: 2.8e-5, Ea: 40000, orders: { 'H+': 1 }, surface: 'Mg' }),
  },
  {
    id: 'zn_acid', name: 'Zinc tác dụng với acid',
    equation: 'Zn + 2H⁺ → Zn²⁺ + H₂↑',
    reactants: { Zn: 1, 'H+': 2 }, products: { 'Zn^2+': 1, H2: 1 },
    rate: massAction({ k25: 1.2e-5, Ea: 45000, orders: { 'H+': 1 }, surface: 'Zn' }),
  },
  {
    id: 'fe_acid', name: 'Iron tác dụng với acid',
    equation: 'Fe + 2H⁺ → Fe²⁺ + H₂↑',
    reactants: { Fe: 1, 'H+': 2 }, products: { 'Fe^2+': 1, H2: 1 },
    rate: massAction({ k25: 4e-7, Ea: 50000, orders: { 'H+': 1 }, surface: 'Fe' }),
  },

  // ── Kim loại mạnh đẩy kim loại yếu ra khỏi dung dịch muối ───────────
  {
    id: 'fe_cu', name: 'Iron đẩy copper',
    equation: 'Fe + Cu²⁺ → Fe²⁺ + Cu↓',
    reactants: { Fe: 1, 'Cu^2+': 1 }, products: { 'Fe^2+': 1, Cu: 1 },
    rate: massAction({ k25: 5e-7, Ea: 30000, orders: { 'Cu^2+': 1 }, surface: 'Fe' }),
    productForm: 'granule',
  },
  {
    id: 'zn_cu', name: 'Zinc đẩy copper',
    equation: 'Zn + Cu²⁺ → Zn²⁺ + Cu↓',
    reactants: { Zn: 1, 'Cu^2+': 1 }, products: { 'Zn^2+': 1, Cu: 1 },
    rate: massAction({ k25: 1.5e-6, Ea: 30000, orders: { 'Cu^2+': 1 }, surface: 'Zn' }),
    productForm: 'granule',
  },
  {
    id: 'cu_ag', name: 'Copper đẩy silver ("cây silver")',
    equation: 'Cu + 2Ag⁺ → Cu²⁺ + 2Ag↓',
    reactants: { Cu: 1, 'Ag+': 2 }, products: { 'Cu^2+': 1, Ag: 2 },
    rate: massAction({ k25: 1e-6, Ea: 30000, orders: { 'Ag+': 1 }, surface: 'Cu' }),
    productForm: 'powder',
  },

  // ── Kim loại kiềm + nước ─────────────────────────────────────────────
  {
    id: 'na_water', name: 'Sodium tác dụng với nước',
    equation: '2Na + 2H₂O → 2NaOH + H₂↑',
    reactants: { Na: 1, H2O: 1 }, products: { 'Na+': 1, 'OH-': 1, H2: 0.5 },
    rate: massAction({ k25: 7.7e-4, Ea: 20000, surface: 'Na' }),
  },
  // Cùng nhóm IA: tính kim loại tăng từ Li → Na → K, phản ứng với nước mạnh dần
  {
    id: 'li_water', name: 'Lithium tác dụng với nước',
    equation: '2Li + 2H₂O → 2LiOH + H₂↑',
    reactants: { Li: 1, H2O: 1 }, products: { 'Li+': 1, 'OH-': 1, H2: 0.5 },
    rate: massAction({ k25: 1.2e-4, Ea: 30000, surface: 'Li' }),
  },
  {
    id: 'k_water', name: 'Potassium tác dụng với nước',
    equation: '2K + 2H₂O → 2KOH + H₂↑',
    reactants: { K: 1, H2O: 1 }, products: { 'K+': 1, 'OH-': 1, H2: 0.5 },
    rate: massAction({ k25: 4e-3, Ea: 15000, surface: 'K' }),
  },

  // ── Phân hủy H2O2 (xúc tác MnO2) ─────────────────────────────────────
  {
    id: 'h2o2_uncat', name: 'H₂O₂ tự phân hủy (rất chậm)',
    equation: '2H₂O₂ → 2H₂O + O₂↑',
    reactants: { H2O2: 1 }, products: { H2O: 1, O2: 0.5 },
    rate: massAction({ k25: 2e-8, Ea: 75000, orders: { H2O2: 1 } }),
  },
  {
    id: 'h2o2_mno2', name: 'H₂O₂ phân hủy, xúc tác MnO₂',
    equation: '2H₂O₂ —MnO₂→ 2H₂O + O₂↑',
    reactants: { H2O2: 1 }, products: { H2O: 1, O2: 0.5 },
    rate: massAction({ k25: 7e-6, Ea: 50000, orders: { H2O2: 1 }, surface: 'MnO2' }),
  },

];
