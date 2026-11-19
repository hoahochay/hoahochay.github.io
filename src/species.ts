export type Phase = 'aq' | 's' | 'l' | 'g';
/** Màu hoặc hệ số theo 3 kênh R, G, B */
export type RGB = [number, number, number];

/** Chất chỉ thị: màu phụ thuộc pH, nồng độ rất nhỏ nên bỏ qua trong cân bằng điện tích */
export interface IndicatorDef {
  pKa: number;
  /** Hệ số hấp thụ mol (L/mol/cm) của dạng acid theo R, G, B */
  acidEps: RGB;
  /** Hệ số hấp thụ mol của dạng base */
  baseEps: RGB;
  /**
   * Độ dốc vùng chuyển màu (hệ số Hill). Phenolphthalein chuyển màu qua 2 nấc proton
   * nên dốc hơn: không màu hoàn toàn ở pH 7, bắt đầu hồng từ pH ≈ 8,2.
   */
  hill?: number;
}

export interface SpeciesDef {
  id: string;
  name: string;
  phase: Phase;
  charge: number;
  /** Số nguyên tử H, dùng để bảo toàn H (tính lượng nước sinh ra / mất đi) */
  hCount: number;
  /** Enthalpy tạo thành chuẩn ΔfH°, kJ/mol (25°C) */
  dHf: number;
  /** g/mol */
  molarMass: number;
  /** Chất tan có màu: hệ số hấp thụ mol ε (L/mol/cm) theo R, G, B */
  epsilon?: RGB;
  /** Tên hiển thị thay cho công thức (chất không có công thức gọn, vd. viên vitamin C sủi) */
  label?: string;
  /** Chất rắn: màu nhìn thấy (0..1) */
  color?: RGB;
  indicator?: IndicatorDef;
  /** Chất rắn không tan, lơ lửng: thời gian lắng đặc trưng (s), thay cho giá trị mặc định theo hình dạng */
  settleTime?: number;
}

const list: SpeciesDef[] = [];
function sp(
  id: string, name: string, phase: Phase, charge: number, hCount: number,
  dHf: number, molarMass: number, extra: Partial<SpeciesDef> = {},
) {
  list.push({ id, name, phase, charge, hCount, dHf, molarMass, ...extra });
}

const WHITE: RGB = [0.95, 0.95, 0.95];

// ── Nước, H+, OH- ────────────────────────────────────────────────────────
sp('H2O', 'nước', 'l', 0, 2, -285.83, 18.015);
sp('H+', 'ion hydrogen', 'aq', 1, 1, 0, 1.008);
sp('OH-', 'ion hydroxide', 'aq', -1, 1, -229.99, 17.007);

// ── Ion không tham gia acid–base ─────────────────────────────────────────
sp('Na+', 'ion sodium', 'aq', 1, 0, -240.12, 22.99);
sp('Li+', 'ion lithium', 'aq', 1, 0, -278.49, 6.94);
sp('K+', 'ion potassium', 'aq', 1, 0, -252.38, 39.1);
sp('Cl-', 'ion chloride', 'aq', -1, 0, -167.16, 35.45);
sp('I-', 'ion iodide', 'aq', -1, 0, -55.19, 126.9);
sp('NO3-', 'ion nitrate', 'aq', -1, 0, -205.0, 62.0);
sp('Ag+', 'ion bạc', 'aq', 1, 0, 105.58, 107.87);
sp('Fe^2+', 'ion sắt(II)', 'aq', 2, 0, -89.1, 55.85, { epsilon: [1.2, 0.2, 0.8] });
sp('Mg^2+', 'ion magnesium', 'aq', 2, 0, -466.85, 24.305);
sp('Zn^2+', 'ion kẽm', 'aq', 2, 0, -153.89, 65.38);
sp('Ca^2+', 'ion calcium', 'aq', 2, 0, -542.83, 40.08);
sp('Ba^2+', 'ion barium', 'aq', 2, 0, -537.64, 137.33);
sp('Pb^2+', 'ion chì(II)', 'aq', 2, 0, -1.7, 207.2);

// ── Các hệ acid–base (xem systems.ts) ────────────────────────────────────
sp('Cu^2+', 'ion đồng(II)', 'aq', 2, 0, 64.77, 63.55, { epsilon: [12, 3, 0.3] });
// ΔfH của CuOH+ là giá trị ước lượng (ΔH thủy phân ≈ +40 kJ/mol)
sp('CuOH+', 'ion CuOH+', 'aq', 1, 1, -181.0, 80.55, { epsilon: [12, 3, 0.3] });
sp('Fe^3+', 'ion sắt(III)', 'aq', 3, 0, -48.5, 55.85, { epsilon: [0.4, 2.5, 20] });
sp('FeOH^2+', 'ion FeOH2+', 'aq', 2, 1, -290.8, 72.85, { epsilon: [0.5, 6, 40] });
sp('HSO4-', 'ion hydrogensulfate', 'aq', -1, 1, -887.34, 97.07);
sp('SO4^2-', 'ion sulfate', 'aq', -2, 0, -909.27, 96.06);
sp('CH3COOH', 'acetic acid', 'aq', 0, 4, -485.76, 60.05);
sp('CH3COO-', 'ion acetate', 'aq', -1, 3, -486.01, 59.04);
// Citric acid C₆H₈O₇ (H₃Cit), acid 3 nấc: thành phần acid của viên sủi
sp('H3Cit', 'citric acid', 'aq', 0, 8, -1515.1, 192.12);
sp('H2Cit-', 'ion dihydrogencitrate', 'aq', -1, 7, -1511.3, 191.11);
sp('HCit^2-', 'ion hydrogencitrate', 'aq', -2, 6, -1509.6, 190.11);
sp('Cit^3-', 'ion citrate', 'aq', -3, 5, -1508.7, 189.10);
sp('H2CO3', 'carbonic acid (CO2 tan)', 'aq', 0, 2, -699.65, 62.03);
sp('HCO3-', 'ion hydrogencarbonate', 'aq', -1, 1, -691.99, 61.02);
sp('CO3^2-', 'ion carbonate', 'aq', -2, 0, -677.14, 60.01);
sp('NH4+', 'ion ammonium', 'aq', 1, 4, -132.51, 18.04);
sp('NH3', 'ammonia', 'aq', 0, 3, -80.29, 17.03);

// ── Phân tử tan trung hòa ────────────────────────────────────────────────
sp('H2O2', 'hydrogen peroxide', 'aq', 0, 2, -191.17, 34.01);

// ── Chất chỉ thị ─────────────────────────────────────────────────────────
sp('phenolphthalein', 'phenolphthalein', 'aq', 0, 0, 0, 318.3, {
  indicator: { pKa: 9.4, acidEps: [0, 0, 0], baseEps: [200, 30000, 600], hill: 2 },
});
sp('methyl orange', 'methyl orange', 'aq', 0, 0, 0, 327.3, {
  indicator: { pKa: 3.47, acidEps: [300, 25000, 12000], baseEps: [0, 3000, 25000] },
});

// ── Kim loại & chất rắn ──────────────────────────────────────────────────
sp('Na', 'sodium', 's', 0, 0, 0, 22.99, { color: [0.82, 0.82, 0.8] });
sp('Li', 'lithium', 's', 0, 0, 0, 6.94, { color: [0.75, 0.75, 0.76] });
sp('K', 'potassium', 's', 0, 0, 0, 39.1, { color: [0.8, 0.8, 0.82] });
sp('Mg', 'magnesium', 's', 0, 0, 0, 24.305, { color: [0.78, 0.78, 0.78] });
sp('Zn', 'kẽm', 's', 0, 0, 0, 65.38, { color: [0.62, 0.64, 0.67] });
sp('Fe', 'sắt', 's', 0, 0, 0, 55.85, { color: [0.4, 0.4, 0.42] });
sp('Cu', 'đồng', 's', 0, 0, 0, 63.55, { color: [0.72, 0.42, 0.2] });
sp('Ag', 'bạc', 's', 0, 0, 0, 107.87, { color: [0.75, 0.75, 0.78] });
// Muối tan được ở dạng rắn (bột baking soda): tan dần khi gặp nước, xem SOLIDS
sp('NaHCO3', 'sodium hydrogencarbonate', 's', 0, 1, -950.8, 84.01, { color: WHITE });
// Muối ăn, copper(II) sulfate (tinh thể ngậm nước CuSO₄·5H₂O như ở phòng thí nghiệm trường:
// khối lượng mol và ΔfH° hiệu dụng theo tinh thể ngậm nước, để hòa tan thu nhiệt nhẹ như thực tế)
sp('NaCl', 'sodium chloride', 's', 0, 0, -411.2, 58.44, { color: WHITE });
sp('CuSO4', 'copper(II) sulfate', 's', 0, 0, -856.0, 249.69, { color: [0.2, 0.45, 0.9] });
// Bột gạo (tinh bột): không tan trong nước lạnh, khuấy lên thì lơ lửng làm đục rồi lắng rất chậm
sp('starch', 'tinh bột', 's', 0, 10, -960, 162.14, { color: [0.97, 0.96, 0.92], settleTime: 400 });
// Viên vitamin C sủi: mô hình gọn gồm citric acid + sodium hydrogencarbonate theo tỉ lệ 1 : 3
// (C₆H₈O₇·3NaHCO₃, 444,15 g/mol). Tan trong nước thì acid gặp HCO₃⁻ sinh khí CO₂ (sủi bọt);
// tan nhanh hơn trong nước nóng. Bỏ qua vitamin C, đường, hương liệu (không tạo khí).
sp('VitC', 'viên vitamin C sủi', 's', 0, 11, -4396.2, 444.15, { color: [0.98, 0.93, 0.62], label: 'Vitamin C sủi' });
sp('S', 'lưu huỳnh', 's', 0, 0, 0, 32.06, { color: [0.96, 0.84, 0.18] });
sp('FeS', 'iron(II) sulfide', 's', 0, 0, -100.0, 87.91, { color: [0.13, 0.12, 0.11] });
sp('CuO', 'copper(II) oxide', 's', 0, 0, -157.3, 79.55, { color: [0.08, 0.08, 0.09] });
sp('MnO2', 'manganese dioxide', 's', 0, 0, -520.03, 86.94, { color: [0.1, 0.1, 0.1] });

// Kết tủa (Ksp xem systems.ts)
sp('AgCl', 'silver chloride', 's', 0, 0, -127.07, 143.32, { color: WHITE });
sp('Cu(OH)2', 'copper(II) hydroxide', 's', 0, 2, -449.8, 97.56, { color: [0.35, 0.6, 0.88] });
sp('Fe(OH)2', 'iron(II) hydroxide', 's', 0, 2, -569.0, 89.86, { color: [0.6, 0.72, 0.62] });
sp('Fe(OH)3', 'iron(III) hydroxide', 's', 0, 3, -823.0, 106.87, { color: [0.6, 0.28, 0.1] });
sp('KClO3', 'potassium chlorate', 's', 0, 0, -397.73, 122.55, { color: [0.98, 0.98, 0.97] });
sp('KCl', 'potassium chloride', 's', 0, 0, -436.5, 74.55, { color: [0.97, 0.97, 0.97] });
sp('CaCl2', 'calcium chloride', 's', 0, 0, -795.4, 110.98, { color: [0.97, 0.97, 0.96] });
sp('CaO', 'calcium oxide', 's', 0, 0, -634.92, 56.08, { color: [0.95, 0.94, 0.9] });
sp('Ca(OH)2', 'calcium hydroxide', 's', 0, 2, -985.2, 74.09, { color: WHITE });
sp('Mg(OH)2', 'magnesium hydroxide', 's', 0, 2, -924.54, 58.32, { color: WHITE });
sp('CaCO3', 'calcium carbonate', 's', 0, 0, -1206.92, 100.09, { color: WHITE });
sp('BaSO4', 'barium sulfate', 's', 0, 0, -1473.2, 233.39, { color: WHITE });
sp('PbI2', 'lead(II) iodide', 's', 0, 0, -175.48, 461.0, { color: [0.98, 0.84, 0.1] });

// ── Khí (thoát ra khỏi dung dịch) ────────────────────────────────────────
sp('H2', 'khí hydrogen', 'g', 0, 2, 0, 2.016);
sp('O2', 'khí oxygen', 'g', 0, 0, 0, 32.0);
sp('CO2', 'khí carbon dioxide', 'g', 0, 0, -393.51, 44.01);
sp('NH3(g)', 'khí ammonia', 'g', 0, 3, -45.94, 17.03);

export const SPECIES: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(
  list.map((s) => [s.id, s]),
);

export function species(id: string): SpeciesDef {
  const s = SPECIES[id];
  if (!s) throw new Error(`Chất chưa được định nghĩa: "${id}"`);
  return s;
}

export const GAS_IDS = list.filter((s) => s.phase === 'g').map((s) => s.id);

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
};

/** 'SO4^2-' → 'SO₄²⁻', 'Cu(OH)2' → 'Cu(OH)₂' */
export function pretty(id: string): string {
  if (SPECIES[id]?.indicator) return SPECIES[id].name;
  if (SPECIES[id]?.label) return SPECIES[id].label!;
  id = id.replace('(g)', '');
  const m = /^(.*?)(?:\^(\d*[+-])|([+-]))$/.exec(id);
  const base = m ? m[1] : id;
  const charge = m ? (m[2] ?? m[3]) : '';
  const b = base.replace(/\d/g, (d) => SUB[Number(d)]);
  const c = [...charge].map((ch) => SUP[ch] ?? ch).join('');
  return b + c;
}
