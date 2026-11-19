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
    id: 'zn_acid', name: 'Kẽm tác dụng với acid',
    equation: 'Zn + 2H⁺ → Zn²⁺ + H₂↑',
    reactants: { Zn: 1, 'H+': 2 }, products: { 'Zn^2+': 1, H2: 1 },
    rate: massAction({ k25: 1.2e-5, Ea: 45000, orders: { 'H+': 1 }, surface: 'Zn' }),
  },
  {
    id: 'fe_acid', name: 'Sắt tác dụng với acid',
    equation: 'Fe + 2H⁺ → Fe²⁺ + H₂↑',
    reactants: { Fe: 1, 'H+': 2 }, products: { 'Fe^2+': 1, H2: 1 },
    rate: massAction({ k25: 4e-7, Ea: 50000, orders: { 'H+': 1 }, surface: 'Fe' }),
  },

  // ── Kim loại mạnh đẩy kim loại yếu ra khỏi dung dịch muối ───────────
  {
    id: 'fe_cu', name: 'Sắt đẩy đồng',
    equation: 'Fe + Cu²⁺ → Fe²⁺ + Cu↓',
    reactants: { Fe: 1, 'Cu^2+': 1 }, products: { 'Fe^2+': 1, Cu: 1 },
    rate: massAction({ k25: 5e-7, Ea: 30000, orders: { 'Cu^2+': 1 }, surface: 'Fe' }),
    productForm: 'granule',
  },
  {
    id: 'zn_cu', name: 'Kẽm đẩy đồng',
    equation: 'Zn + Cu²⁺ → Zn²⁺ + Cu↓',
    reactants: { Zn: 1, 'Cu^2+': 1 }, products: { 'Zn^2+': 1, Cu: 1 },
    rate: massAction({ k25: 1.5e-6, Ea: 30000, orders: { 'Cu^2+': 1 }, surface: 'Zn' }),
    productForm: 'granule',
  },
  {
    id: 'cu_ag', name: 'Đồng đẩy bạc ("cây bạc")',
    equation: 'Cu + 2Ag⁺ → Cu²⁺ + 2Ag↓',
    reactants: { Cu: 1, 'Ag+': 2 }, products: { 'Cu^2+': 1, Ag: 2 },
    rate: massAction({ k25: 1e-6, Ea: 30000, orders: { 'Ag+': 1 }, surface: 'Cu' }),
    productForm: 'powder',
  },

  // ── Phản ứng giữa hai chất rắn khi đun nóng ─────────────────────────
  // Ở nhiệt độ phòng không xảy ra; đun đáy ống khoảng 30 s (≈ 250–300 °C) thì phản ứng tự bùng lên
  // nhờ nhiệt tỏa ra (ΔH ≈ −100 kJ/mol), hỗn hợp nóng đỏ. Ea lớn để ngưỡng bắt đầu rõ ràng.
  {
    id: 'fe_s', name: 'Sắt tác dụng với lưu huỳnh',
    equation: 'Fe + S → FeS',
    reactants: { Fe: 1, S: 1 }, products: { FeS: 1 },
    rate: massAction({ k25: 7e-19, Ea: 150000, surface: 'Fe' }),
    productForm: 'powder',
  },

  // ── Nhiệt phân chất rắn ──────────────────────────────────────────────
  // KClO₃ khan: không xúc tác phải đun rất nóng (nóng chảy ≈ 356 °C, phân hủy rõ trên ≈ 400 °C);
  // có MnO₂ xúc tác thì phân hủy nhanh ở ≈ 200–250 °C. Phản ứng tỏa nhiệt nhẹ (ΔH ≈ −39 kJ/mol).
  {
    id: 'kclo3_heat', name: 'Nhiệt phân potassium chlorate',
    equation: '2KClO₃ —t°→ 2KCl + 3O₂↑',
    reactants: { KClO3: 1 }, products: { KCl: 1, O2: 1.5 },
    rate: massAction({ k25: 1e-28, Ea: 200000, surface: 'KClO3' }),
    productForm: 'powder',
  },
  {
    id: 'kclo3_mno2', name: 'Nhiệt phân potassium chlorate, xúc tác MnO₂',
    equation: '2KClO₃ —MnO₂, t°→ 2KCl + 3O₂↑',
    reactants: { KClO3: 1 }, products: { KCl: 1, O2: 1.5 },
    rate: massAction({ k25: 5e-15, Ea: 120000, surface: 'MnO2' }),
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

  // ── Halogen mạnh đẩy halogen yếu ra khỏi dung dịch muối halide ──────
  // Xảy ra gần như tức thì khi trộn: Cl₂ > Br₂ > I₂ (tính oxi hóa giảm dần)
  {
    id: 'cl2_br', name: 'Chlorine đẩy bromine',
    equation: 'Cl₂ + 2Br⁻ → 2Cl⁻ + Br₂',
    reactants: { Cl2: 1, 'Br-': 2 }, products: { 'Cl-': 2, Br2: 1 },
    rate: massAction({ k25: 2e4, Ea: 20000, orders: { Cl2: 1, 'Br-': 1 } }),
  },
  {
    id: 'cl2_i', name: 'Chlorine đẩy iodine',
    equation: 'Cl₂ + 2I⁻ → 2Cl⁻ + I₂',
    reactants: { Cl2: 1, 'I-': 2 }, products: { 'Cl-': 2, I2: 1 },
    rate: massAction({ k25: 5e4, Ea: 20000, orders: { Cl2: 1, 'I-': 1 } }),
  },
  {
    id: 'br2_i', name: 'Bromine đẩy iodine',
    equation: 'Br₂ + 2I⁻ → 2Br⁻ + I₂',
    reactants: { Br2: 1, 'I-': 2 }, products: { 'Br-': 2, I2: 1 },
    rate: massAction({ k25: 2e4, Ea: 20000, orders: { Br2: 1, 'I-': 1 } }),
  },
  // Hồ tinh bột bắt iodine tạo phức màu xanh tím (tinh bột không bị tiêu hao đáng kể)
  {
    id: 'i2_starch', name: 'Iodine làm hồ tinh bột hóa xanh',
    equation: 'I₂ + hồ tinh bột → phức màu xanh tím',
    reactants: { I2: 1 }, products: { 'I2-starch': 1 },
    rate: massAction({ k25: 2e3, Ea: 10000, orders: { I2: 1, amylose: 1 } }),
  },

  // ── Điều chế chlorine: thuốc tím + hydrochloric acid đặc (SGK Hóa 10 Bài 21) ──
  // Cần acid đặc: tốc độ tăng rất mạnh theo nồng độ H⁺ và Cl⁻, với HCl loãng gần như không xảy ra
  {
    id: 'kmno4_hcl', name: 'Thuốc tím tác dụng với hydrochloric acid đặc',
    equation: '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂↑ + 8H₂O',
    reactants: { 'MnO4-': 1, 'H+': 8, 'Cl-': 5 }, products: { 'Mn^2+': 1, Cl2: 2.5, H2O: 4 },
    rate: massAction({ k25: 5e-5, Ea: 40000, orders: { 'MnO4-': 1, 'H+': 2, 'Cl-': 1 } }),
  },

  // ── Thiosulfate + acid: lưu huỳnh hạt mịn làm dung dịch đục dần (SGK Hóa 10 Bài 19) ──
  // Tốc độ tỉ lệ nồng độ thiosulfate: nồng độ gấp đôi thì thời gian đục che khuất chữ X giảm một nửa
  {
    id: 'thiosulfate_acid', name: 'Sodium thiosulfate tác dụng với acid',
    equation: 'Na₂S₂O₃ + H₂SO₄ → Na₂SO₄ + S↓ + SO₂ + H₂O',
    reactants: { 'S2O3^2-': 1, 'H+': 2 }, products: { 'S(coll)': 1, SO2: 1, H2O: 1 },
    rate: massAction({ k25: 4.4e-3, Ea: 50000, orders: { 'S2O3^2-': 1, 'H+': 1 } }),
  },

  // ── Magnesium + nước ─────────────────────────────────────────────────
  // Nước nguội: rất chậm (vài phút mới thấy phenolphthalein hồng nhạt); nước nóng: nhanh hơn hàng trăm lần.
  // Mg(OH)₂ ít tan nên dung dịch chỉ có tính base yếu (pH ≈ 10).
  {
    id: 'mg_water', name: 'Magnesium tác dụng với nước',
    equation: 'Mg + 2H₂O → Mg(OH)₂ + H₂↑',
    reactants: { Mg: 1, H2O: 2 }, products: { 'Mg^2+': 1, 'OH-': 2, H2: 1 },
    rate: massAction({ k25: 1e-11, Ea: 100000, surface: 'Mg' }),
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
