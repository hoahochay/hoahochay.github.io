/**
 * Các cân bằng nhanh: hệ acid–base (Ka) và chất ít tan (Ksp).
 * Hằng số ở 25°C; sự phụ thuộc nhiệt độ được tính tự động theo van 't Hoff
 * từ ΔfH° của các chất (xem equilibrium.ts).
 */

export interface AcidBaseFamily {
  id: string;
  /** Các dạng, từ dạng nhiều proton nhất đến ít nhất */
  forms: string[];
  /** pKa nối tiếp: forms[i] ⇌ forms[i+1] + H+ */
  pKa: number[];
}

export const FAMILIES: AcidBaseFamily[] = [
  { id: 'acetate', forms: ['CH3COOH', 'CH3COO-'], pKa: [4.756] },
  { id: 'carbonate', forms: ['H2CO3', 'HCO3-', 'CO3^2-'], pKa: [6.35, 10.33] },
  { id: 'ammonium', forms: ['NH4+', 'NH3'], pKa: [9.25] },
  { id: 'sulfate', forms: ['HSO4-', 'SO4^2-'], pKa: [1.99] },
  { id: 'citrate', forms: ['H3Cit', 'H2Cit-', 'HCit^2-', 'Cit^3-'], pKa: [3.13, 4.76, 6.40] },
  // Thủy phân ion kim loại: [M(H2O)]n+ ⇌ [M(OH)](n-1)+ + H+
  { id: 'iron3', forms: ['Fe^3+', 'FeOH^2+'], pKa: [2.2] },
  // pKa HIỆU DỤNG: tài liệu cho pKa ≈ 7,5–8 cho Cu²⁺ → CuOH⁺, nhưng trong dung dịch đặc
  // Cu²⁺ thủy phân chủ yếu qua dimer Cu₂(OH)₂²⁺ và engine chưa tính hệ số hoạt độ.
  // Giá trị 6,0 được hiệu chỉnh để CuSO₄ 0,1M có pH ≈ 4 như số đo thực tế.
  { id: 'copper2', forms: ['Cu^2+', 'CuOH+'], pKa: [6.0] },
];

/** id chất → { chỉ số hệ, vị trí dạng } */
export const FAMILY_INDEX = new Map<string, { family: number; form: number }>();
FAMILIES.forEach((f, i) => f.forms.forEach((id, k) => FAMILY_INDEX.set(id, { family: i, form: k })));

export interface SolidDef {
  id: string;
  /** Các ion khi tan, theo hệ số (OH- và H+ được phép) */
  ions: Record<string, number>;
  /** Tích số tan ở 25°C */
  Ksp: number;
  /**
   * Tốc độ hòa tan (mol/s/cm²) = (k + kH·[H+]) · S · (1 − Q/Ksp).
   * Kết tủa hình thành tức thời; hòa tan thì cần thời gian. Hydroxide mới kết tủa tan rất nhanh trong acid.
   */
  dissolution: { k: number; kH?: number; Ea: number };
}

export const SOLIDS: SolidDef[] = [
  { id: 'AgCl', ions: { 'Ag+': 1, 'Cl-': 1 }, Ksp: 1.77e-10, dissolution: { k: 1e-6, Ea: 40000 } },
  { id: 'Cu(OH)2', ions: { 'Cu^2+': 1, 'OH-': 2 }, Ksp: 2.2e-20, dissolution: { k: 1e-6, kH: 1e-4, Ea: 40000 } },
  { id: 'Fe(OH)2', ions: { 'Fe^2+': 1, 'OH-': 2 }, Ksp: 4.87e-17, dissolution: { k: 1e-6, kH: 1e-4, Ea: 40000 } },
  // Fe(OH)3 mới kết tủa (vô định hình) tan nhiều hơn dạng tinh thể
  { id: 'Fe(OH)3', ions: { 'Fe^3+': 1, 'OH-': 3 }, Ksp: 4e-38, dissolution: { k: 1e-7, kH: 3e-5, Ea: 45000 } },
  { id: 'Mg(OH)2', ions: { 'Mg^2+': 1, 'OH-': 2 }, Ksp: 5.61e-12, dissolution: { k: 1e-6, kH: 1e-4, Ea: 40000 } },
  // KCl: dễ tan (≈ 34 g/100 g nước)
  { id: 'KCl', ions: { 'K+': 1, 'Cl-': 1 }, Ksp: 20, dissolution: { k: 1e-6, Ea: 20000 } },
  // CaCl₂ khan: rất dễ tan (≈ 74 g/100 g nước), tan tỏa nhiều nhiệt
  { id: 'CaCl2', ions: { 'Ca^2+': 1, 'Cl-': 2 }, Ksp: 1e3, dissolution: { k: 2e-6, Ea: 20000 } },
  // Ca(OH)₂ ít tan (≈ 1,7 g/L): vôi tôi dư lắng xuống thành vẩn trắng
  { id: 'Ca(OH)2', ions: { 'Ca^2+': 1, 'OH-': 2 }, Ksp: 5.5e-6, dissolution: { k: 3e-6, kH: 1e-4, Ea: 30000 } },
  // Vôi sống: CaO + H₂O → Ca(OH)₂, tỏa nhiều nhiệt. Luôn "tan" (Ca(OH)₂ dư kết tủa lại ngay)
  { id: 'CaO', ions: { 'Ca^2+': 1, 'OH-': 2 }, Ksp: 1e6, dissolution: { k: 2e-4, Ea: 30000 } },
  { id: 'CaCO3', ions: { 'Ca^2+': 1, 'CO3^2-': 1 }, Ksp: 3.36e-9, dissolution: { k: 1e-7, kH: 6e-5, Ea: 35000 } },
  { id: 'BaSO4', ions: { 'Ba^2+': 1, 'SO4^2-': 1 }, Ksp: 1.08e-10, dissolution: { k: 1e-7, Ea: 40000 } },
  // Muối dễ tan (độ tan ≈ 1,1 M): chỉ dùng khi cho bột rắn vào, hòa tan nhanh
  { id: 'NaHCO3', ions: { 'Na+': 1, 'HCO3-': 1 }, Ksp: 1.2, dissolution: { k: 1e-5, Ea: 20000 } },
  // Độ tan muối ăn ≈ 36 g/100 g nước (6,1 M); CuSO₄·5H₂O ≈ 1,3 M. Tan trong khoảng chục giây khi khuấy
  { id: 'NaCl', ions: { 'Na+': 1, 'Cl-': 1 }, Ksp: 37, dissolution: { k: 1e-6, Ea: 20000 } },
  { id: 'CuSO4', ions: { 'Cu^2+': 1, 'SO4^2-': 1 }, Ksp: 1.7, dissolution: { k: 4e-7, Ea: 20000 } },
  // Viên sủi: luôn tan hết (acid và HCO₃⁻ phản ứng ngay nên không bão hòa). Tan trong khoảng
  // một phút ở nhiệt độ phòng, nhanh hơn vài lần trong nước nóng (Ea lớn hơn muối thường)
  { id: 'VitC', ions: { H3Cit: 1, 'Na+': 3, 'HCO3-': 3 }, Ksp: 1e6, dissolution: { k: 3e-5, Ea: 30000 } },
  // Oxide base: CuO + 2H⁺ → Cu²⁺ + H₂O. Không tan trong nước, tan dần trong acid (vài chục giây khi lắc)
  { id: 'CuO', ions: { 'Cu^2+': 1, 'OH-': 2 }, Ksp: 2e-21, dissolution: { k: 1e-9, kH: 6e-7, Ea: 50000 } },
  { id: 'PbI2', ions: { 'Pb^2+': 1, 'I-': 2 }, Ksp: 9.8e-9, dissolution: { k: 1e-6, Ea: 40000 } },
];

export const SOLID_INDEX = new Map(SOLIDS.map((s) => [s.id, s]));
