export type Phase = 'aq' | 's' | 'l' | 'g';
/** Màu hoặc hệ số theo 3 kênh R, G, B */
export type RGB = [number, number, number];

/** Chất chỉ thị: màu phụ thuộc pH, nồng độ rất nhỏ nên bỏ qua trong cân bằng điện tích */
export interface IndicatorDef {
  pKa: number;
  /** Hệ số hấp thụ mol (L/mol/cm) của dạng axit theo R, G, B */
  acidEps: RGB;
  /** Hệ số hấp thụ mol của dạng bazơ */
  baseEps: RGB;
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
  /** Chất rắn: màu nhìn thấy (0..1) */
  color?: RGB;
  indicator?: IndicatorDef;
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
sp('H+', 'ion hiđro', 'aq', 1, 1, 0, 1.008);
sp('OH-', 'ion hiđroxit', 'aq', -1, 1, -229.99, 17.007);

// ── Ion không tham gia axit–bazơ ─────────────────────────────────────────
sp('Na+', 'ion natri', 'aq', 1, 0, -240.12, 22.99);
sp('K+', 'ion kali', 'aq', 1, 0, -252.38, 39.1);
sp('Cl-', 'ion clorua', 'aq', -1, 0, -167.16, 35.45);
sp('I-', 'ion iođua', 'aq', -1, 0, -55.19, 126.9);
sp('NO3-', 'ion nitrat', 'aq', -1, 0, -205.0, 62.0);
sp('Ag+', 'ion bạc', 'aq', 1, 0, 105.58, 107.87);
sp('Fe^2+', 'ion sắt(II)', 'aq', 2, 0, -89.1, 55.85, { epsilon: [1.2, 0.2, 0.8] });
sp('Mg^2+', 'ion magie', 'aq', 2, 0, -466.85, 24.305);
sp('Zn^2+', 'ion kẽm', 'aq', 2, 0, -153.89, 65.38);
sp('Ca^2+', 'ion canxi', 'aq', 2, 0, -542.83, 40.08);
sp('Ba^2+', 'ion bari', 'aq', 2, 0, -537.64, 137.33);
sp('Pb^2+', 'ion chì(II)', 'aq', 2, 0, -1.7, 207.2);

// ── Các hệ axit–bazơ (xem systems.ts) ────────────────────────────────────
sp('Cu^2+', 'ion đồng(II)', 'aq', 2, 0, 64.77, 63.55, { epsilon: [12, 3, 0.3] });
// ΔfH của CuOH+ là giá trị ước lượng (ΔH thủy phân ≈ +40 kJ/mol)
sp('CuOH+', 'ion CuOH+', 'aq', 1, 1, -181.0, 80.55, { epsilon: [12, 3, 0.3] });
sp('Fe^3+', 'ion sắt(III)', 'aq', 3, 0, -48.5, 55.85, { epsilon: [0.4, 2.5, 20] });
sp('FeOH^2+', 'ion FeOH2+', 'aq', 2, 1, -290.8, 72.85, { epsilon: [0.5, 6, 40] });
sp('HSO4-', 'ion hiđrosunfat', 'aq', -1, 1, -887.34, 97.07);
sp('SO4^2-', 'ion sunfat', 'aq', -2, 0, -909.27, 96.06);
sp('CH3COOH', 'axit axetic', 'aq', 0, 4, -485.76, 60.05);
sp('CH3COO-', 'ion axetat', 'aq', -1, 3, -486.01, 59.04);
sp('H2CO3', 'axit cacbonic (CO2 tan)', 'aq', 0, 2, -699.65, 62.03);
sp('HCO3-', 'ion hiđrocacbonat', 'aq', -1, 1, -691.99, 61.02);
sp('CO3^2-', 'ion cacbonat', 'aq', -2, 0, -677.14, 60.01);
sp('NH4+', 'ion amoni', 'aq', 1, 4, -132.51, 18.04);
sp('NH3', 'amoniac', 'aq', 0, 3, -80.29, 17.03);

// ── Phân tử tan trung hòa ────────────────────────────────────────────────
sp('H2O2', 'hiđro peoxit', 'aq', 0, 2, -191.17, 34.01);

// ── Chất chỉ thị ─────────────────────────────────────────────────────────
sp('phenolphthalein', 'phenolphtalein', 'aq', 0, 0, 0, 318.3, {
  indicator: { pKa: 9.4, acidEps: [0, 0, 0], baseEps: [200, 30000, 600] },
});
sp('methyl orange', 'metyl da cam', 'aq', 0, 0, 0, 327.3, {
  indicator: { pKa: 3.47, acidEps: [300, 25000, 12000], baseEps: [0, 3000, 25000] },
});

// ── Kim loại & chất rắn ──────────────────────────────────────────────────
sp('Na', 'natri', 's', 0, 0, 0, 22.99, { color: [0.82, 0.82, 0.8] });
sp('Mg', 'magie', 's', 0, 0, 0, 24.305, { color: [0.78, 0.78, 0.78] });
sp('Zn', 'kẽm', 's', 0, 0, 0, 65.38, { color: [0.62, 0.64, 0.67] });
sp('Fe', 'sắt', 's', 0, 0, 0, 55.85, { color: [0.4, 0.4, 0.42] });
sp('Cu', 'đồng', 's', 0, 0, 0, 63.55, { color: [0.72, 0.42, 0.2] });
sp('Ag', 'bạc', 's', 0, 0, 0, 107.87, { color: [0.75, 0.75, 0.78] });
sp('MnO2', 'mangan đioxit', 's', 0, 0, -520.03, 86.94, { color: [0.1, 0.1, 0.1] });

// Kết tủa (Ksp xem systems.ts)
sp('AgCl', 'bạc clorua', 's', 0, 0, -127.07, 143.32, { color: WHITE });
sp('Cu(OH)2', 'đồng(II) hiđroxit', 's', 0, 2, -449.8, 97.56, { color: [0.35, 0.6, 0.88] });
sp('Fe(OH)2', 'sắt(II) hiđroxit', 's', 0, 2, -569.0, 89.86, { color: [0.6, 0.72, 0.62] });
sp('Fe(OH)3', 'sắt(III) hiđroxit', 's', 0, 3, -823.0, 106.87, { color: [0.6, 0.28, 0.1] });
sp('Mg(OH)2', 'magie hiđroxit', 's', 0, 2, -924.54, 58.32, { color: WHITE });
sp('CaCO3', 'canxi cacbonat', 's', 0, 0, -1206.92, 100.09, { color: WHITE });
sp('BaSO4', 'bari sunfat', 's', 0, 0, -1473.2, 233.39, { color: WHITE });
sp('PbI2', 'chì(II) iođua', 's', 0, 0, -175.48, 461.0, { color: [0.98, 0.84, 0.1] });

// ── Khí (thoát ra khỏi dung dịch) ────────────────────────────────────────
sp('H2', 'khí hiđro', 'g', 0, 2, 0, 2.016);
sp('O2', 'khí oxi', 'g', 0, 0, 0, 32.0);
sp('CO2', 'khí cacbonic', 'g', 0, 0, -393.51, 44.01);

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
  const m = /^(.*?)(?:\^(\d*[+-])|([+-]))$/.exec(id);
  const base = m ? m[1] : id;
  const charge = m ? (m[2] ?? m[3]) : '';
  const b = base.replace(/\d/g, (d) => SUB[Number(d)]);
  const c = [...charge].map((ch) => SUP[ch] ?? ch).join('');
  return b + c;
}
