/**
 * Cơ sở dữ liệu phản ứng chậm (động học).
 *
 * Hằng số tốc độ được hiệu chỉnh để THỜI GIAN phản ứng khớp với thí nghiệm thật ở trường
 * (vd. 0,05 g dải Mg trong 10 mL HCl 1M tan hết trong khoảng 1 phút), không phải số đo
 * động học chính xác. Ea lấy gần với giá trị trong tài liệu.
 */
import { KineticReaction, massAction } from './kinetics';
import type { Mixture } from './mixture';
import { ELECTROLYSIS } from './electro';
import { arrhenius } from './thermo';

/** Lượng phức [CuCl₄]²⁻ còn thiếu so với cân bằng (mol, âm nếu dư), chia cho thời gian hồi phục 1 s */
function cucl4Excess(mix: Mixture): number {
  const cu = mix.get('Cu^2+'), cx = mix.get('CuCl4^2-');
  const K = 0.02 * mix.conc('Cl-') ** 4;
  return ((cu + cx) * K) / (1 + K) - cx;
}

/** Lượng xà phòng còn thiếu so với trạng thái cân bằng muối kết (mol/s, thời gian hồi phục 2 s) */
function soapExcess(mix: Mixture): number {
  const ol = mix.get('oleate'), sp = mix.get('soap');
  // Không có nước: xà phòng khô không phân li
  if (ol + sp <= 0 || mix.volumeL <= 1e-7) return 0;
  const K = (mix.conc('Na+') / 3) ** 6 * Math.exp(-(mix.tempK - 298) / 10);
  return (((ol + sp) * K) / (1 + K) - sp) / 2;
}

export const REACTIONS: KineticReaction[] = [
  // ── Kim loại + acid ──────────────────────────────────────────────────
  {
    id: 'mg_acid', name: 'Magnesium tác dụng với acid',
    equation: 'Mg + 2H⁺ → Mg²⁺ + H₂↑',
    reactants: { Mg: 1, 'H+': 2 }, products: { 'Mg^2+': 1, H2: 1 },
    rate: massAction({ k25: 2.8e-5, Ea: 40000, orders: { 'H+': 1 }, surface: 'Mg' }),
  },
  // Acid yếu (acetic acid) còn tấn công trực tiếp bề mặt kim loại bằng phân tử chưa phân li,
  // nên Mg vẫn sủi bọt rõ dù [H⁺] nhỏ; vẫn chậm hơn nhiều so với acid mạnh cùng nồng độ
  {
    id: 'mg_acetic', name: 'Magnesium tác dụng với acetic acid',
    equation: 'Mg + 2CH₃COOH → (CH₃COO)₂Mg + H₂↑',
    reactants: { Mg: 1, CH3COOH: 2 }, products: { 'Mg^2+': 1, 'CH3COO-': 2, H2: 1 },
    rate: massAction({ k25: 3e-6, Ea: 40000, orders: { CH3COOH: 1 }, surface: 'Mg' }),
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
  // Nhôm + lưu huỳnh (SGK Hóa 12 Bài 19): cần đun nóng để khơi mào, sau đó tự cháy, tỏa rất nhiều nhiệt
  {
    id: 'al_s', name: 'Nhôm tác dụng với lưu huỳnh',
    equation: '2Al + 3S →(t°) Al₂S₃',
    reactants: { Al: 2, S: 3 }, products: { Al2S3: 1 },
    rate: massAction({ k25: 7e-19, Ea: 150000, surface: 'Al' }),
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

  // ── Polyalcohol có nhóm –OH liền kề hòa tan Cu(OH)₂ tạo dung dịch xanh lam đậm (SGK Hóa 11 Bài 20) ──
  {
    id: 'cuoh2_glycerol', name: 'Glycerol hòa tan copper(II) hydroxide',
    equation: '2C₃H₅(OH)₃ + Cu(OH)₂ → [C₃H₅(OH)₂O]₂Cu + 2H₂O',
    reactants: { 'Cu(OH)2': 1, glycerol: 2 }, products: { 'Cu(glycerol)': 1, H2O: 2 },
    rate: massAction({ k25: 3e-6, Ea: 30000, orders: { glycerol: 1 }, surface: 'Cu(OH)2' }),
  },

  // ── Phenol + nước bromine: thế 3 nguyên tử H ở vòng, kết tủa trắng (SGK Hóa 11 Bài 21) ──
  {
    id: 'phenol_br2', name: 'Phenol tác dụng với nước bromine',
    equation: 'C₆H₅OH + 3Br₂ → C₆H₂Br₃OH↓ + 3HBr',
    reactants: { C6H5OH: 1, Br2: 3 }, products: { C6H2Br3OH: 1, 'H+': 3, 'Br-': 3 },
    rate: massAction({ k25: 50, Ea: 20000, orders: { C6H5OH: 1, Br2: 1 } }),
  },

  // ── Sulfuric acid đặc hút nước của đường mía, để lại carbon (than hóa) – SGK Hóa 11 Bài 8.
  // Chỉ acid rất đặc (nhiều HSO₄⁻) mới hút nước được: tốc độ ∝ [HSO₄⁻]²; phản ứng tỏa nhiều nhiệt nên tự tăng tốc.
  {
    id: 'sugar_charring', name: 'Sulfuric acid đặc làm than hóa đường mía',
    equation: 'C₁₂H₂₂O₁₁ →(H₂SO₄ đặc) 12C + 11H₂O',
    reactants: { C12H22O11: 1 }, products: { C: 12 }, productForm: 'powder',
    rate: massAction({ k25: 1.5e-10, Ea: 60000, orders: { 'HSO4-': 2 }, surface: 'C12H22O11' }),
  },
  // Carbon nóng bị sulfuric acid đặc oxi hóa: sinh khí CO₂ và SO₂ (mùi hắc) làm khối than phồng lên
  {
    id: 'carbon_h2so4', name: 'Carbon tác dụng với sulfuric acid đặc, nóng',
    equation: 'C + 2H₂SO₄ (đặc) →(t°) CO₂↑ + 2SO₂↑ + 2H₂O',
    reactants: { C: 1, 'HSO4-': 2, 'H+': 2 }, products: { H2CO3: 1, SO2: 2 },
    rate: massAction({ k25: 1e-13, Ea: 90000, orders: { 'HSO4-': 2 }, surface: 'C' }),
  },

  // ── Hydrocarbon không no (SGK Hóa 11 Bài 16) ──
  // Điều chế ethylene: tách nước ethanol bằng H₂SO₄ đặc khi đun nóng (thực tế ở khoảng 170 °C)
  {
    id: 'ethanol_dehydration', name: 'Điều chế ethylene từ ethanol',
    equation: 'C₂H₅OH →(H₂SO₄ đặc, t°) CH₂=CH₂ + H₂O',
    reactants: { C2H5OH: 1 }, products: { C2H4: 1 },
    rate: massAction({ k25: 8e-10, Ea: 150000, orders: { C2H5OH: 1, 'HSO4-': 1 } }),
  },
  // Điều chế acetylene: đất đèn tác dụng với nước
  {
    id: 'cac2_water', name: 'Calcium carbide tác dụng với nước',
    equation: 'CaC₂ + 2H₂O → C₂H₂↑ + Ca(OH)₂',
    reactants: { CaC2: 1, H2O: 2 }, products: { C2H2: 1, 'Ca^2+': 1, 'OH-': 2 },
    rate: massAction({ k25: 8e-5, Ea: 30000, surface: 'CaC2' }),
  },
  {
    id: 'ethylene_br2', name: 'Ethylene làm mất màu nước bromine',
    equation: 'CH₂=CH₂ + Br₂ → BrCH₂–CH₂Br',
    reactants: { C2H4: 1, Br2: 1 }, products: { C2H4Br2: 1 },
    rate: massAction({ k25: 3e4, Ea: 20000, orders: { C2H4: 1, Br2: 1 } }),
  },
  {
    id: 'acetylene_br2', name: 'Acetylene làm mất màu nước bromine',
    equation: 'CH≡CH + 2Br₂ → Br₂CH–CHBr₂',
    reactants: { C2H2: 1, Br2: 2 }, products: { C2H2Br4: 1 },
    rate: massAction({ k25: 1e4, Ea: 20000, orders: { C2H2: 1, Br2: 1 } }),
  },
  {
    id: 'ethylene_kmno4', name: 'Ethylene làm mất màu dung dịch KMnO₄',
    equation: '3CH₂=CH₂ + 2KMnO₄ + 4H₂O → 3HO–CH₂–CH₂–OH + 2MnO₂↓ + 2KOH',
    reactants: { C2H4: 3, 'MnO4-': 2 }, products: { C2H6O2: 3, MnO2: 2, 'OH-': 2 },
    rate: massAction({ k25: 3e3, Ea: 30000, orders: { C2H4: 1, 'MnO4-': 1 } }),
  },
  {
    id: 'acetylene_kmno4', name: 'Acetylene làm mất màu dung dịch KMnO₄',
    equation: '3CH≡CH + 8KMnO₄ → 3K₂C₂O₄ + 8MnO₂↓ + 2KOH + 2H₂O',
    reactants: { C2H2: 3, 'MnO4-': 8 }, products: { 'C2O4^2-': 3, MnO2: 8, 'OH-': 2 },
    rate: massAction({ k25: 1e3, Ea: 30000, orders: { C2H2: 1, 'MnO4-': 1 } }),
  },

  // ── Bromine hóa hexane (SGK Hóa 11 Bài 15): thế H bằng Br, xảy ra trong lớp hexane.
  // Ở nhiệt độ phòng, trong bóng râm gần như không phản ứng; ngâm nước ấm khoảng 50 °C thì màu bromine nhạt dần.
  {
    id: 'hexane_br2', name: 'Bromine hóa hexane',
    equation: 'C₆H₁₄ + Br₂ →(t°) C₆H₁₃Br + HBr',
    reactants: { C6H14: 1, 'Br2(org)': 1 }, products: { C6H13Br: 1, 'H+': 1, 'Br-': 1 },
    rate: (ctx) => ctx.mix.get('C6H14') > 0 ? arrhenius(4e-4, 110000, ctx.T) * ctx.mix.get('Br2(org)') : 0,
  },

  // ── Toluene bị KMnO₄ (môi trường acid) oxi hóa nhóm methyl thành benzoic acid khi đun nóng (SGK Hóa 11 Bài 17).
  // Benzene không phản ứng. Phản ứng xảy ra ở mặt phân cách hai lớp: tốc độ ∝ [MnO₄⁻] khi có lớp toluene.
  {
    id: 'toluene_kmno4', name: 'Toluene tác dụng với dung dịch KMnO₄',
    equation: '5C₆H₅CH₃ + 6KMnO₄ + 9H₂SO₄ →(t°) 5C₆H₅COOH + 3K₂SO₄ + 6MnSO₄ + 14H₂O',
    reactants: { C6H5CH3: 5, 'MnO4-': 6, 'H+': 18 }, products: { C6H5COOH: 5, 'Mn^2+': 6 },
    rate: (ctx) => ctx.mix.get('C6H5CH3') > 0 && ctx.mix.conc('H+') > 0.05
      ? arrhenius(2e-5, 90000, ctx.T) * ctx.mix.get('MnO4-') : 0,
  },

  // ── Sulfuric acid đặc, nóng oxi hóa copper, giải phóng SO₂ (SGK Hóa 11 Bài 8) ──
  // Chỉ phân tử / ion HSO₄⁻ trong acid đặc mới oxi hóa được Cu: tốc độ ∝ [H⁺]²[HSO₄⁻] nên acid loãng gần như không phản ứng
  {
    id: 'cu_h2so4_dac', name: 'Copper tác dụng với sulfuric acid đặc, nóng',
    equation: 'Cu + 2H₂SO₄ (đặc) → CuSO₄ + SO₂↑ + 2H₂O',
    reactants: { Cu: 1, 'H+': 3, 'HSO4-': 1 }, products: { 'Cu^2+': 1, SO2: 1 },
    rate: massAction({ k25: 1e-12, Ea: 90000, orders: { 'H+': 2, 'HSO4-': 1 }, surface: 'Cu' }),
  },

  // ── Thuốc thử Tollens: Ag₂O (hoặc Ag⁺) tan trong ammonia tạo phức [Ag(NH₃)₂]⁺ ──
  {
    id: 'ag2o_nh3', name: 'Silver(I) oxide tan trong dung dịch ammonia',
    equation: 'Ag₂O + 4NH₃ + H₂O → 2[Ag(NH₃)₂]⁺ + 2OH⁻',
    reactants: { Ag2O: 1, NH3: 4 }, products: { 'Ag(NH3)2+': 2, 'OH-': 2 },
    rate: massAction({ k25: 2e-3, Ea: 20000, orders: { NH3: 1 }, surface: 'Ag2O' }),
  },
  {
    id: 'ag_nh3', name: 'Ion silver tạo phức với ammonia',
    equation: 'Ag⁺ + 2NH₃ → [Ag(NH₃)₂]⁺',
    reactants: { 'Ag+': 1, NH3: 2 }, products: { 'Ag(NH3)2+': 1 },
    rate: massAction({ k25: 1e4, Ea: 10000, orders: { 'Ag+': 1, NH3: 1 } }),
  },
  // ── Phản ứng tráng bạc (SGK Hóa 11 Bài 23): chậm ở nhiệt độ phòng, nhanh trong nước nóng 70 – 80 °C ──
  {
    id: 'tollens', name: 'Aldehyde khử thuốc thử Tollens (tráng bạc)',
    equation: 'CH₃CHO + 2[Ag(NH₃)₂]⁺ + 3OH⁻ → CH₃COO⁻ + 2Ag↓ + 4NH₃ + 2H₂O',
    reactants: { CH3CHO: 1, 'Ag(NH3)2+': 2, 'OH-': 3 }, products: { 'CH3COO-': 1, 'Ag(mirror)': 2, NH3: 4 },
    rate: massAction({ k25: 5e-3, Ea: 60000, orders: { CH3CHO: 1, 'Ag(NH3)2+': 1 } }),
    productForm: 'strip',
  },
  // ── Aldehyde khử copper(II) hydroxide trong môi trường kiềm khi đun nóng: Cu₂O đỏ gạch ──
  {
    id: 'aldehyde_cuoh2', name: 'Aldehyde khử copper(II) hydroxide',
    equation: 'CH₃CHO + 2Cu(OH)₂ + OH⁻ → CH₃COO⁻ + Cu₂O↓ + 3H₂O',
    reactants: { CH3CHO: 1, 'Cu(OH)2': 2, 'OH-': 1 }, products: { 'CH3COO-': 1, Cu2O: 1 },
    rate: massAction({ k25: 1.5e-10, Ea: 80000, orders: { CH3CHO: 1 }, surface: 'Cu(OH)2' }),
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


  // ════ Lớp 12 · Chương 2: carbohydrate ═══════════════════════════════════
  // Glucose, saccharose có nhiều nhóm –OH liền kề: hòa tan Cu(OH)₂ thành dung dịch xanh lam (như glycerol)
  {
    id: 'cuoh2_glucose', name: 'Glucose hòa tan copper(II) hydroxide',
    equation: '2C₆H₁₂O₆ + Cu(OH)₂ → (C₆H₁₁O₆)₂Cu + 2H₂O',
    reactants: { 'Cu(OH)2': 1, glucose: 1 }, products: { 'Cu(glucose)': 1, H2O: 2 },
    rate: massAction({ k25: 3e-6, Ea: 30000, orders: { glucose: 1 }, surface: 'Cu(OH)2' }),
  },
  {
    id: 'cuoh2_saccharose', name: 'Saccharose hòa tan copper(II) hydroxide',
    equation: '2C₁₂H₂₂O₁₁ + Cu(OH)₂ → (C₁₂H₂₁O₁₁)₂Cu + 2H₂O',
    reactants: { 'Cu(OH)2': 1, saccharose: 1 }, products: { 'Cu(saccharose)': 1, H2O: 2 },
    rate: massAction({ k25: 3e-6, Ea: 30000, orders: { saccharose: 1 }, surface: 'Cu(OH)2' }),
  },
  // Nhóm –CHO của glucose khử Cu(II) thành Cu₂O đỏ gạch khi đun nóng trong môi trường kiềm
  {
    id: 'glucose_cu_heat', name: 'Glucose khử copper(II) hydroxide khi đun nóng',
    equation: 'C₅H₁₁O₅CHO + 2Cu(OH)₂ + NaOH →(t°) C₅H₁₁O₅COONa + Cu₂O↓ + 3H₂O',
    reactants: { 'Cu(glucose)': 2, 'OH-': 1, H2O: 1 }, products: { Cu2O: 1, gluconate: 1, glucose: 1 },
    rate: massAction({ k25: 9e-5, Ea: 80000, orders: { 'Cu(glucose)': 1, 'OH-': 1 } }),
  },
  {
    id: 'glucose_cuoh2', name: 'Glucose khử copper(II) hydroxide khi đun nóng',
    equation: 'C₅H₁₁O₅CHO + 2Cu(OH)₂ + NaOH →(t°) C₅H₁₁O₅COONa + Cu₂O↓ + 3H₂O',
    reactants: { glucose: 1, 'Cu(OH)2': 2, 'OH-': 1 }, products: { gluconate: 1, Cu2O: 1, H2O: 3 },
    rate: massAction({ k25: 1.5e-10, Ea: 80000, orders: { glucose: 1 }, surface: 'Cu(OH)2' }),
  },
  {
    id: 'glucose_tollens', name: 'Glucose khử thuốc thử Tollens (tráng bạc)',
    equation: 'C₅H₁₁O₅CHO + 2[Ag(NH₃)₂]OH →(t°) C₅H₁₁O₅COONH₄ + 2Ag↓ + 3NH₃ + H₂O',
    reactants: { glucose: 1, 'Ag(NH3)2+': 2, 'OH-': 3 }, products: { gluconate: 1, 'Ag(mirror)': 2, NH3: 4, H2O: 2 },
    rate: massAction({ k25: 5e-3, Ea: 60000, orders: { glucose: 1, 'Ag(NH3)2+': 1 } }),
    productForm: 'strip',
  },
  {
    id: 'glucose_br2', name: 'Glucose làm mất màu nước bromine',
    equation: 'C₅H₁₁O₅CHO + Br₂ + H₂O → C₅H₁₁O₅COOH + 2HBr',
    reactants: { glucose: 1, Br2: 1, H2O: 1 }, products: { gluconate: 1, 'H+': 3, 'Br-': 2 },
    rate: massAction({ k25: 1, Ea: 50000, orders: { glucose: 1, Br2: 1 } }),
  },
  // Thủy phân tinh bột (mắt xích C₆H₁₀O₅) có acid xúc tác: chậm ở nhiệt độ thường, nhanh trong nước nóng
  {
    id: 'starch_hydrolysis', name: 'Thủy phân tinh bột trong môi trường acid',
    equation: '(C₆H₁₀O₅)ₙ + nH₂O →(H⁺, t°) nC₆H₁₂O₆',
    reactants: { amylose: 1, H2O: 1 }, products: { glucose: 1 },
    rate: massAction({ k25: 3.3e-4, Ea: 80000, orders: { amylose: 1, 'H+': 1 } }),
  },

  // ════ Lớp 12 · Chương 3: amine, protein ═════════════════════════════════
  // Ammonia, methylamine dư hòa tan Cu(OH)₂ tạo phức xanh lam đậm
  {
    id: 'cuoh2_nh3', name: 'Copper(II) hydroxide tan trong dung dịch ammonia',
    equation: 'Cu(OH)₂ + 4NH₃ → [Cu(NH₃)₄](OH)₂',
    reactants: { 'Cu(OH)2': 1, NH3: 4 }, products: { 'Cu(NH3)4^2+': 1, 'OH-': 2 },
    rate: massAction({ k25: 2e-3, Ea: 20000, orders: { NH3: 1 }, surface: 'Cu(OH)2' }),
  },
  {
    id: 'cuoh2_methylamine', name: 'Copper(II) hydroxide tan trong dung dịch methylamine',
    equation: 'Cu(OH)₂ + 4CH₃NH₂ → [Cu(CH₃NH₂)₄](OH)₂',
    reactants: { 'Cu(OH)2': 1, CH3NH2: 4 }, products: { 'Cu(CH3NH2)4^2+': 1, 'OH-': 2 },
    rate: massAction({ k25: 2e-3, Ea: 20000, orders: { CH3NH2: 1 }, surface: 'Cu(OH)2' }),
  },
  // [Cu(H₂O)₆]²⁺ + 4Cl⁻ ⇌ [CuCl₄]²⁻ + 6H₂O: chỉ chuyển sang màu vàng khi nồng độ Cl⁻ rất lớn (HCl đặc).
  // Cân bằng nhanh: lượng phức tiến dần về giá trị cân bằng (β hiệu dụng 0,02 M⁻⁴) với thời gian hồi phục 1 s
  {
    id: 'cucl4_form', name: 'Ion Cu²⁺ tạo phức với ion chloride',
    equation: '[Cu(H₂O)₆]²⁺ + 4Cl⁻ → [CuCl₄]²⁻ + 6H₂O',
    reactants: { 'Cu^2+': 1, 'Cl-': 4 }, products: { 'CuCl4^2-': 1 },
    rate: (ctx) => Math.max(0, cucl4Excess(ctx.mix)),
  },
  {
    id: 'cucl4_back', name: 'Phức [CuCl₄]²⁻ bị nước thế phối tử',
    equation: '[CuCl₄]²⁻ + 6H₂O → [Cu(H₂O)₆]²⁺ + 4Cl⁻',
    reactants: { 'CuCl4^2-': 1 }, products: { 'Cu^2+': 1, 'Cl-': 4 },
    rate: (ctx) => Math.max(0, -cucl4Excess(ctx.mix)),
  },
  {
    id: 'aniline_br2', name: 'Aniline tác dụng với nước bromine',
    equation: 'C₆H₅NH₂ + 3Br₂ → C₆H₂Br₃NH₂↓ + 3HBr',
    reactants: { C6H5NH2: 1, Br2: 3 }, products: { C6H2Br3NH2: 1, 'H+': 3, 'Br-': 3 },
    rate: massAction({ k25: 50, Ea: 20000, orders: { C6H5NH2: 1, Br2: 1 } }),
  },
  // HBr sinh ra chuyển một phần aniline thành ion anilinium; phản ứng thế vẫn tiếp tục (qua cân bằng với aniline)
  {
    id: 'anilinium_br2', name: 'Aniline tác dụng với nước bromine',
    equation: 'C₆H₅NH₂ + 3Br₂ → C₆H₂Br₃NH₂↓ + 3HBr',
    reactants: { 'C6H5NH3+': 1, Br2: 3 }, products: { C6H2Br3NH2: 1, 'H+': 4, 'Br-': 3 },
    rate: massAction({ k25: 50, Ea: 20000, orders: { 'C6H5NH3+': 1, Br2: 1 } }),
  },
  // Phản ứng màu biuret: Cu(OH)₂ trong kiềm tạo phức màu tím với các liên kết peptide
  {
    id: 'biuret', name: 'Phản ứng màu biuret của peptide',
    equation: 'peptide + Cu(OH)₂ (OH⁻) → phức chất màu tím',
    reactants: { 'Cu(OH)2': 1, protein: 4 }, products: { 'Cu(protein)': 1, H2O: 2 },
    rate: massAction({ k25: 3e-6, Ea: 30000, orders: { protein: 1 }, surface: 'Cu(OH)2' }),
  },
  // Protein đông tụ khi đun nóng: gần như không xảy ra ở nhiệt độ thường, rất nhanh từ khoảng 70 °C
  {
    id: 'protein_coag', name: 'Protein đông tụ khi đun nóng',
    equation: 'protein (tan) →(t°) protein đông tụ',
    reactants: { protein: 1 }, products: { 'protein(coag)': 1 },
    rate: massAction({ k25: 6e-9, Ea: 300000, orders: { protein: 1 } }),
  },
  {
    id: 'xanthoprotein', name: 'Protein tác dụng với nitric acid đặc',
    equation: 'protein + HNO₃ đặc → kết tủa màu vàng',
    reactants: { protein: 1, 'H+': 1, 'NO3-': 1 }, products: { xanthoprotein: 1, H2O: 1 },
    rate: massAction({ k25: 0.02, Ea: 40000, orders: { protein: 1, 'H+': 1, 'NO3-': 1 } }),
  },

  // ════ Lớp 12 · Chương 8: chuẩn độ muối Fe(II) bằng thuốc tím trong môi trường acid ═══
  {
    id: 'fe2_mno4', name: 'Muối iron(II) khử thuốc tím trong môi trường acid',
    equation: '10FeSO₄ + 2KMnO₄ + 8H₂SO₄ → 5Fe₂(SO₄)₃ + K₂SO₄ + 2MnSO₄ + 8H₂O',
    reactants: { 'Fe^2+': 5, 'MnO4-': 1, 'H+': 8 }, products: { 'Fe^3+': 5, 'Mn^2+': 1, H2O: 4 },
    rate: massAction({ k25: 1e4, Ea: 30000, orders: { 'Fe^2+': 1, 'MnO4-': 1 } }),
  },

  // ════ Lớp 12 · Bài 22: ăn mòn điện hóa ═══════════════════════════════════
  // Sắt trong nước tiếp xúc không khí bị gỉ rất chậm (vài ngày mới thấy rõ); O₂ lấy từ không khí.
  // Khi sắt tiếp xúc kẽm (kim loại hoạt động mạnh hơn), kẽm là anode bị ăn mòn, sắt được bảo vệ.
  {
    id: 'fe_rust', name: 'Sắt bị ăn mòn (gỉ) trong nước',
    equation: '4Fe + 3O₂ + 2nH₂O → 2Fe₂O₃·nH₂O',
    reactants: { Fe: 1 }, products: { FeOOH: 1 },
    rate: (ctx) => ctx.V > 0 ? arrhenius(5e-11, 40000, ctx.T) * ctx.surface('Fe') * (ctx.surface('Zn') > 0 ? 0.01 : 1) : 0,
  },
  {
    id: 'zn_corrosion', name: 'Kẽm bị ăn mòn trong nước',
    equation: '2Zn + O₂ + 2H₂O → 2Zn(OH)₂',
    reactants: { Zn: 1 }, products: { 'Zn(OH)2': 1 },
    rate: (ctx) => ctx.V > 0 ? arrhenius(6e-12, 40000, ctx.T) * ctx.surface('Zn') * (ctx.surface('Fe') > 0 ? 8 : 1) : 0,
  },

  // ════ Lớp 12 · Chương 1: ester, chất béo ══════════════════════════════════
  // Thủy phân ester trong acid: thuận nghịch (đến cân bằng chỉ khoảng 1/3 ester bị thủy phân)
  {
    id: 'ester_acid', name: 'Thủy phân ethyl acetate trong môi trường acid',
    equation: 'CH₃COOC₂H₅ + H₂O ⇌(H⁺, t°) CH₃COOH + C₂H₅OH',
    reactants: { CH3COOC2H5: 1, H2O: 1 }, products: { CH3COOH: 1, C2H5OH: 1 },
    rate: (ctx) => arrhenius(4.5e-5, 60000, ctx.T) * ctx.conc('H+') * ctx.mix.get('CH3COOC2H5'),
  },
  {
    id: 'ester_acid_back', name: 'Phản ứng ester hóa',
    equation: 'CH₃COOH + C₂H₅OH ⇌(H⁺, t°) CH₃COOC₂H₅ + H₂O',
    reactants: { CH3COOH: 1, C2H5OH: 1 }, products: { CH3COOC2H5: 1, H2O: 1 },
    rate: (ctx) => (arrhenius(4.5e-5, 60000, ctx.T) / 0.77) * ctx.conc('H+') * ctx.conc('CH3COOH') * ctx.conc('C2H5OH') * ctx.V,
  },
  // Thủy phân ester trong kiềm (phản ứng xà phòng hóa): một chiều
  {
    id: 'ester_base', name: 'Thủy phân ethyl acetate trong môi trường kiềm',
    equation: 'CH₃COOC₂H₅ + NaOH →(t°) CH₃COONa + C₂H₅OH',
    reactants: { CH3COOC2H5: 1, 'OH-': 1 }, products: { 'CH3COO-': 1, C2H5OH: 1 },
    rate: (ctx) => arrhenius(1.1e-4, 50000, ctx.T) * ctx.conc('OH-') * ctx.mix.get('CH3COOC2H5'),
  },
  {
    id: 'saponification', name: 'Xà phòng hóa chất béo',
    equation: '(C₁₇H₃₃COO)₃C₃H₅ + 3NaOH →(t°) 3C₁₇H₃₃COONa + C₃H₅(OH)₃',
    reactants: { triolein: 1, 'OH-': 3 }, products: { oleate: 3, glycerol: 1 },
    rate: (ctx) => arrhenius(3.8e-6, 60000, ctx.T) * ctx.conc('OH-') * ctx.mix.get('triolein'),
  },
  // Muối kết xà phòng: nồng độ Na⁺ lớn (dung dịch NaCl bão hòa) và nhiệt độ thấp làm xà phòng tách ra
  {
    id: 'soap_salting_out', name: 'Xà phòng tách ra khỏi dung dịch (muối kết)',
    equation: 'C₁₇H₃₃COO⁻ + Na⁺ → C₁₇H₃₃COONa',
    reactants: { oleate: 1, 'Na+': 1 }, products: { soap: 1 },
    rate: (ctx) => Math.max(0, soapExcess(ctx.mix)),
  },
  {
    id: 'soap_dissolve', name: 'Xà phòng tan vào dung dịch',
    equation: 'C₁₇H₃₃COONa → C₁₇H₃₃COO⁻ + Na⁺',
    reactants: { soap: 1 }, products: { oleate: 1, 'Na+': 1 },
    rate: (ctx) => Math.max(0, -soapExcess(ctx.mix)),
  },

  // ════ Lớp 12 · Bài 6: cellulose ═══════════════════════════════════════════
  // Trong H₂SO₄ 70% nóng, bông tan dần và bị thủy phân thành glucose; acid loãng, nguội: gần như không
  {
    id: 'cellulose_hydrolysis', name: 'Thủy phân cellulose trong môi trường acid',
    equation: '(C₆H₁₀O₅)ₙ + nH₂O →(H⁺, t°) nC₆H₁₂O₆',
    reactants: { cellulose: 1, H2O: 1 }, products: { glucose: 1 },
    rate: (ctx) => arrhenius(2e-9, 80000, ctx.T) * ctx.surface('cellulose') * ctx.conc('H+') ** 3,
  },
  // Nitrate hóa: cần hỗn hợp HNO₃ đặc và H₂SO₄ đặc
  {
    id: 'cellulose_nitration', name: 'Cellulose tác dụng với nitric acid',
    equation: '[C₆H₇O₂(OH)₃]ₙ + 3nHNO₃ →(H₂SO₄ đặc, t°) [C₆H₇O₂(ONO₂)₃]ₙ + 3nH₂O',
    reactants: { cellulose: 1, 'H+': 3, 'NO3-': 3 }, products: { cellulose_nitrate: 1, H2O: 3 },
    rate: (ctx) => arrhenius(2e-7, 60000, ctx.T) * ctx.surface('cellulose') * ctx.conc('H+') ** 2 * ctx.conc('NO3-'),
  },
  {
    id: 'cellulose_schweizer', name: 'Cellulose tan trong nước Schweizer',
    equation: '(C₆H₁₀O₅)ₙ tan trong dung dịch [Cu(NH₃)₄](OH)₂',
    reactants: { cellulose: 1 }, products: { 'cellulose(sw)': 1 },
    rate: (ctx) => 2e-4 * ctx.surface('cellulose') * Math.min(1, ctx.conc('Cu(NH3)4^2+') / 0.2),
  },

  // ════ Lớp 12 · Chương 5: điện phân ═══════════════════════════════════════
  ...ELECTROLYSIS,
  // Chlorine sinh ra ở anode gặp OH⁻ sinh ra ở cathode (không có màng ngăn): tạo nước Javel
  {
    id: 'cl2_naoh', name: 'Chlorine tác dụng với dung dịch kiềm',
    equation: 'Cl₂ + 2NaOH → NaCl + NaClO + H₂O',
    reactants: { Cl2: 1, 'OH-': 2 }, products: { 'Cl-': 1, 'ClO-': 1, H2O: 1 },
    rate: massAction({ k25: 50, Ea: 20000, orders: { Cl2: 1, 'OH-': 1 } }),
  },
  {
    id: 'petal_bleach', name: 'Cánh hoa bị tẩy màu',
    equation: 'NaClO (Cl₂, HClO) oxi hóa chất màu của cánh hoa',
    reactants: { petal: 1 }, products: { 'petal(bleached)': 1 },
    rate: ({ mix }) => 3 * (mix.conc('ClO-') + mix.conc('Cl2')) * mix.get('petal'),
  },
];
