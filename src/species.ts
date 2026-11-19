/** org: chất lỏng hữu cơ không tan trong nước (lớp riêng) và chất tan trong lớp đó */
export type Phase = 'aq' | 's' | 'l' | 'g' | 'org';
/** Màu hoặc hệ số theo 3 kênh R, G, B */
export type RGB = [number, number, number];

/** Chất chỉ thị: màu phụ thuộc pH, nồng độ rất nhỏ nên bỏ qua trong cân bằng điện tích */
export interface IndicatorDef {
  pKa: number;
  /**
   * Dạng màu tạo ra do ion OH⁻ cộng vào phân tử chỉ thị (phenolphthalein): màu theo [OH⁻]
   * chứ không theo [H⁺], nên khi đun nóng dung dịch base yếu (Kw tăng) màu đậm hơn.
   * pKa khi đó là giá trị ở 25 °C, quy về thang pH = 14 + lg[OH⁻].
   */
  viaOH?: boolean;
  /**
   * Chỉ thị nhiều nấc màu (anthocyanin của bắp cải tím): pKa nối tiếp và hệ số hấp thụ của
   * từng dạng, từ dạng acid nhất. Khi có, bỏ qua pKa / acidEps / baseEps.
   */
  forms?: { pKa: number[]; eps: RGB[] };
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
  /** Mức tán xạ ánh sáng so với kết tủa thường (hạt keo rất mịn làm đục mạnh hơn nhiều với cùng khối lượng) */
  scatter?: number;
  /** Dung môi hữu cơ (phase 'org'): khối lượng riêng, g/mL */
  density?: number;
  /** Chất rắn luôn nằm thành lớp dưới đáy (đường kết tinh, khối than xốp): thể tích lớp, mL mỗi gam */
  bulk?: number;
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
sp('Al^3+', 'ion aluminium', 'aq', 3, 0, -538.4, 26.98);
sp('AlOH^2+', 'ion AlOH2+', 'aq', 2, 1, -767.0, 43.99);
sp('Cl-', 'ion chloride', 'aq', -1, 0, -167.16, 35.45);
sp('I-', 'ion iodide', 'aq', -1, 0, -55.19, 126.9);
sp('Br-', 'ion bromide', 'aq', -1, 0, -121.55, 79.9);
sp('F-', 'ion fluoride', 'aq', -1, 0, -332.63, 19.0);
sp('HF', 'hydrofluoric acid', 'aq', 0, 1, -320.08, 20.01);
sp('NO3-', 'ion nitrate', 'aq', -1, 0, -205.0, 62.0);
sp('S2O3^2-', 'ion thiosulfate', 'aq', -2, 0, -652.3, 112.13);
sp('MnO4-', 'ion permanganate', 'aq', -1, 0, -541.4, 118.94, { epsilon: [250, 2400, 400] });
sp('Mn^2+', 'ion manganese(II)', 'aq', 2, 0, -220.75, 54.94);
// Sulfur dioxide tan trong nước (rất dễ tan); không tách riêng H₂SO₃ vì dung dịch đã có acid mạnh
sp('SO2', 'sulfur dioxide', 'aq', 0, 0, -322.98, 64.07);
sp('HSO3-', 'ion hydrogensulfite', 'aq', -1, 1, -626.22, 81.07);
sp('SO3^2-', 'ion sulfite', 'aq', -2, 0, -635.5, 80.06);
// Phosphoric acid: acid ba nấc, độ mạnh trung bình
sp('H3PO4', 'phosphoric acid', 'aq', 0, 3, -1288.34, 97.99);
sp('H2PO4-', 'ion dihydrogenphosphate', 'aq', -1, 2, -1296.29, 96.99);
sp('HPO4^2-', 'ion hydrogenphosphate', 'aq', -2, 1, -1292.14, 95.98);
sp('PO4^3-', 'ion phosphate', 'aq', -3, 0, -1277.4, 94.97);
sp('Ag+', 'ion bạc', 'aq', 1, 0, 105.58, 107.87);
sp('Fe^2+', 'ion sắt(II)', 'aq', 2, 0, -89.1, 55.85, { epsilon: [1.2, 0.2, 0.8] });
sp('Mg^2+', 'ion magnesium', 'aq', 2, 0, -466.85, 24.305);
sp('Zn^2+', 'ion kẽm', 'aq', 2, 0, -153.89, 65.38);
sp('Ca^2+', 'ion calcium', 'aq', 2, 0, -542.83, 40.08);
sp('Ba^2+', 'ion barium', 'aq', 2, 0, -537.64, 137.33);
sp('Sr^2+', 'ion strontium', 'aq', 2, 0, -545.8, 87.62);
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
// Phenol: acid rất yếu, ít tan ở nhiệt độ thường (8,4 g/100 g nước); phần dư tách thành giọt nhỏ làm dung dịch trắng đục
sp('C6H5OH', 'phenol', 'aq', 0, 6, -152.0, 94.11);
sp('C6H5O-', 'ion phenolate', 'aq', -1, 5, -128.4, 93.1);
sp('C6H5OH(l)', 'phenol (giọt nhỏ không tan)', 's', 0, 6, -165.1, 94.11, { color: [0.98, 0.98, 0.97], label: 'C₆H₅OH', settleTime: 1e6, scatter: 6 });
// Kết tủa trắng 2,4,6-tribromophenol
sp('C6H2Br3OH', '2,4,6-tribromophenol', 's', 0, 3, -180, 330.8, { color: [0.98, 0.98, 0.95], label: 'C₆H₂Br₃OH', scatter: 3 });
// Aldehyde, thuốc thử Tollens và sản phẩm
sp('CH3CHO', 'acetaldehyde (ethanal)', 'aq', 0, 4, -212.2, 44.05);
sp('Ag2O', 'silver(I) oxide', 's', 0, 0, -31.1, 231.74, { color: [0.3, 0.22, 0.15] });
sp('Ag(NH3)2+', 'ion diamminesilver(I)', 'aq', 1, 6, -111.3, 141.94, { label: '[Ag(NH₃)₂]⁺' });
// Bạc sinh ra từ phản ứng tráng bạc: bám thành lớp gương trên thành ống, không lơ lửng
sp('Ag(mirror)', 'silver (lớp bạc sáng bám thành ống)', 's', 0, 0, 0, 107.87, { color: [0.85, 0.86, 0.88], label: 'Ag' });
sp('Cu2O', 'copper(I) oxide', 's', 0, 0, -168.6, 143.09, { color: [0.72, 0.24, 0.1], scatter: 2 });
// ── Tính háo nước của sulfuric acid đặc (SGK Hóa 11 Bài 8) ──
sp('C12H22O11', 'saccharose (đường mía)', 's', 0, 22, -2226.1, 342.3, { color: [0.97, 0.96, 0.93], bulk: 1.3 });
// Than sinh ra khi đường bị hút nước: khối xốp, phồng lên nhờ hơi nước và khí CO₂, SO₂
sp('C', 'carbon (than)', 's', 0, 0, 0, 12.011, { color: [0.08, 0.05, 0.03], bulk: 18 });
// ── Hydrocarbon không no (SGK Hóa 11 Bài 16) ──
sp('C2H4(g)', 'ethylene', 'g', 0, 4, 52.4, 28.05);
sp('C2H4', 'ethylene (tan)', 'aq', 0, 4, 36.4, 28.05);
sp('C2H2(g)', 'acetylene', 'g', 0, 2, 226.7, 26.04);
sp('C2H2', 'acetylene (tan)', 'aq', 0, 2, 212.0, 26.04);
sp('CaC2', 'calcium carbide (đất đèn)', 's', 0, 0, -59.8, 64.1, { color: [0.36, 0.36, 0.38] });
sp('C2H6O2', 'ethylene glycol', 'aq', 0, 6, -460.0, 62.07);
sp('C2O4^2-', 'ion oxalate', 'aq', -2, 0, -825.1, 88.02);
// Sản phẩm cộng bromine: chất lỏng nặng, không tan trong nước (giọt dầu chìm xuống đáy)
sp('C2H4Br2', '1,2-dibromoethane', 'org', 0, 4, -81.0, 187.86, { density: 2.18 });
sp('C2H2Br4', '1,1,2,2-tetrabromoethane', 'org', 0, 2, -60.0, 345.65, { density: 2.97 });
// ── Chất lỏng hữu cơ không tan trong nước (lớp riêng) ──
// Ester, chất béo (SGK Hóa 12 Chương 1): chất lỏng không tan trong nước, nhẹ hơn nước
sp('CH3COOC2H5', 'ethyl acetate', 'org', 0, 8, -479.3, 88.11, { density: 0.902 });
sp('triolein', 'chất béo (triolein)', 'org', 0, 104, -2190, 885.4, { density: 0.915, epsilon: [0.02, 0.03, 0.12], label: '(C₁₇H₃₃COO)₃C₃H₅' });
sp('oleate', 'ion oleate', 'aq', -1, 33, -800, 281.5, { label: 'C₁₇H₃₃COO⁻' });
// Xà phòng (sodium oleate) bị muối kết: tách thành khối nhẹ nổi lên trên
sp('soap', 'xà phòng (sodium oleate)', 'org', 0, 33, -1040, 304.4, { density: 0.95, epsilon: [0.05, 0.06, 0.15], label: 'C₁₇H₃₃COONa' });
sp('C6H14', 'hexane', 'org', 0, 14, -198.7, 86.18, { density: 0.655 });
sp('C6H6', 'benzene', 'org', 0, 6, 49.1, 78.11, { density: 0.877 });
sp('C6H5CH3', 'toluene', 'org', 0, 8, 12.4, 92.14, { density: 0.867 });
// Chất tan trong lớp hữu cơ
sp('Br2(org)', 'bromine (tan trong lớp hữu cơ)', 'org', 0, 0, -2.59, 159.8, { epsilon: [0.5, 12, 75], label: 'Br₂' });
// β-carotene (màu cam của cà rốt): trong nước ép ở dạng hạt keo, tan tốt trong hexane
sp('carotene', 'β-carotene (trong nước ép)', 'aq', 0, 56, 0, 536.9, { epsilon: [800, 40000, 160000], label: 'β-carotene' });
sp('carotene(org)', 'β-carotene (tan trong hexane)', 'org', 0, 56, 0, 536.9, { epsilon: [800, 40000, 160000], label: 'β-carotene' });
sp('C6H5COOH', 'benzoic acid', 'aq', 0, 6, -385.1, 122.12);
sp('C6H13Br', 'bromohexane', 'org', 0, 13, -230, 165.07);
// Alcohol (tan vô hạn trong nước)
sp('C2H5OH', 'ethanol', 'aq', 0, 6, -288.3, 46.07);
sp('glycerol', 'glycerol', 'aq', 0, 8, -676.5, 92.09, { label: 'C₃H₅(OH)₃' });
// Phức của Cu²⁺ với glycerol (polyalcohol có nhóm –OH liền kề): dung dịch xanh lam đậm
sp('Cu(glycerol)', 'phức copper(II) glycerate', 'aq', 0, 14, -1231.4, 245.7, { epsilon: [30, 5, 0.5], label: '[C₃H₅(OH)₂O]₂Cu' });
// Halogen tan trong nước: nước chlorine vàng lục nhạt, nước bromine vàng cam, iodine (cùng I⁻ tạo I₃⁻) nâu
sp('Cl2', 'chlorine', 'aq', 0, 0, -23.4, 70.9, { epsilon: [0.3, 0.2, 2.5] });
sp('Br2', 'bromine', 'aq', 0, 0, -2.59, 159.8, { epsilon: [1, 20, 110] });
sp('I2', 'iodine', 'aq', 0, 0, 22.6, 253.8, { epsilon: [60, 160, 600] });
// Hồ tinh bột (tính theo mắt xích C₆H₁₀O₅) và phức xanh tím với iodine
sp('amylose', 'hồ tinh bột', 'aq', 0, 10, -960, 162.14);
sp('I2-starch', 'phức iodine – tinh bột', 'aq', 0, 0, 22.6, 253.8, { epsilon: [70, 300, 20] });

// ── Lớp 12: carbohydrate (SGK Hóa 12 Chương 2) ──────────────────────────
sp('glucose', 'glucose', 'aq', 0, 12, -1263.8, 180.16, { label: 'C₆H₁₂O₆' });
sp('gluconate', 'ion gluconate', 'aq', -1, 11, -1593, 195.15, { label: 'C₅H₁₁O₅COO⁻' });
sp('saccharose', 'saccharose', 'aq', 0, 22, -2215.9, 342.3, { label: 'C₁₂H₂₂O₁₁' });
// Phức tan của Cu²⁺ với glucose / saccharose (nhiều nhóm –OH liền kề): dung dịch xanh lam
sp('Cu(glucose)', 'phức copper(II) – glucose', 'aq', 0, 10, -1141.9, 241.69, { epsilon: [45, 7, 0.6], label: 'phức Cu²⁺ – glucose' });
sp('Cu(saccharose)', 'phức copper(II) – saccharose', 'aq', 0, 20, -2094.0, 403.83, { epsilon: [45, 7, 0.6], label: 'phức Cu²⁺ – saccharose' });

// ── Lớp 12: amine, protein (SGK Hóa 12 Chương 3) ─────────────────────────
sp('CH3NH2', 'methylamine', 'aq', 0, 5, -70.2, 31.06);
sp('CH3NH3+', 'ion methylammonium', 'aq', 1, 6, -124.9, 32.07);
sp('C6H5NH2', 'aniline', 'aq', 0, 7, 31.3, 93.13);
sp('C6H5NH3+', 'ion anilinium', 'aq', 1, 8, 1.3, 94.14);
sp('C6H2Br3NH2', '2,4,6-tribromoaniline', 's', 0, 4, 16, 329.8, { color: [0.98, 0.98, 0.96], label: 'C₆H₂Br₃NH₂', scatter: 3 });
// Phức tan màu xanh lam đậm của Cu²⁺ với ammonia và methylamine
sp('Cu(NH3)4^2+', 'ion tetraamminecopper(II)', 'aq', 2, 12, -351.0, 131.67, { epsilon: [60, 15, 0.4], label: '[Cu(NH₃)₄]²⁺' });
sp('Cu(CH3NH2)4^2+', 'phức copper(II) – methylamine', 'aq', 2, 20, -310.6, 187.79, { epsilon: [60, 15, 1], label: '[Cu(CH₃NH₂)₄]²⁺' });
// Phức [CuCl₄]²⁻ màu vàng (trong HCl đặc)
sp('CuCl4^2-', 'ion tetrachlorocuprate(II)', 'aq', -2, 0, -583.9, 205.36, { epsilon: [0.8, 1.2, 30], label: '[CuCl₄]²⁻' });
// Protein lòng trắng trứng, tính theo một gốc amino acid trung bình (≈ 110 g/mol)
sp('protein', 'protein (lòng trắng trứng)', 'aq', 0, 7, -400, 110, { label: 'protein' });
// Phức màu tím của Cu²⁺ với liên kết peptide (phản ứng màu biuret)
sp('Cu(protein)', 'phức biuret (Cu²⁺ – peptide)', 'aq', 0, 26, -1478.1, 501.5, { epsilon: [25, 120, 15], label: 'phức biuret' });
// Protein bị đông tụ khi đun nóng: khối kết tủa trắng đục
sp('protein(coag)', 'protein đông tụ', 's', 0, 7, -405, 110, { color: [0.97, 0.96, 0.93], label: 'protein đông tụ', scatter: 4 });
// Protein phản ứng với HNO₃ đặc: kết tủa màu vàng (nitro hóa vòng benzene trong gốc amino acid)
sp('xanthoprotein', 'protein bị nitro hóa', 's', 0, 6, -340, 155, { color: [0.98, 0.82, 0.2], label: 'kết tủa vàng', scatter: 4 });

// ── Chất chỉ thị ─────────────────────────────────────────────────────────
sp('phenolphthalein', 'phenolphthalein', 'aq', 0, 0, 0, 318.3, {
  indicator: { pKa: 9.4, acidEps: [0, 0, 0], baseEps: [200, 30000, 600], hill: 2, viaOH: true },
});
// Anthocyanin trong dịch bắp cải tím (tính theo cyanidin-3-glucoside):
// đỏ (pH < 3) → tím (4 – 6) → xanh lam (7 – 8) → xanh lục (9 – 12) → vàng (> 13)
sp('anthocyanin', 'anthocyanin (dịch bắp cải tím)', 'aq', 0, 0, 0, 449.4, {
  indicator: {
    pKa: 0, acidEps: [0, 0, 0], baseEps: [0, 0, 0],
    forms: {
      pKa: [3.6, 7.3, 8.8, 12.6],
      eps: [[50, 700, 330], [190, 560, 120], [620, 360, 70], [560, 110, 470], [25, 110, 700]],
    },
  },
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
sp('VitC', 'viên vitamin C sủi', 's', 0, 10, -3448.0, 360.14, { color: [0.98, 0.93, 0.62], label: 'Vitamin C sủi' });
sp('S', 'lưu huỳnh', 's', 0, 0, 0, 32.06, { color: [0.96, 0.84, 0.18] });
// Lưu huỳnh sinh ra trong dung dịch (thiosulfate + acid): hạt rất mịn, lơ lửng lâu, làm dung dịch đục trắng ngà
sp('S(coll)', 'lưu huỳnh', 's', 0, 0, 0, 32.06, { color: [0.97, 0.95, 0.8], label: 'S', settleTime: 3600, scatter: 40 });
sp('FeS', 'iron(II) sulfide', 's', 0, 0, -100.0, 87.91, { color: [0.13, 0.12, 0.11] });
sp('CuO', 'copper(II) oxide', 's', 0, 0, -157.3, 79.55, { color: [0.08, 0.08, 0.09] });
sp('MnO2', 'manganese dioxide', 's', 0, 0, -520.03, 86.94, { color: [0.1, 0.1, 0.1] });

// Kết tủa (Ksp xem systems.ts)
sp('AgCl', 'silver chloride', 's', 0, 0, -127.07, 143.32, { color: WHITE });
sp('AgBr', 'silver bromide', 's', 0, 0, -100.37, 187.77, { color: [0.97, 0.94, 0.74] });
sp('AgI', 'silver iodide', 's', 0, 0, -61.84, 234.77, { color: [0.98, 0.88, 0.42] });
sp('Al', 'aluminium', 's', 0, 0, 0, 26.98, { color: [0.78, 0.79, 0.81] });
sp('Al2S3', 'aluminium sulfide', 's', 0, 0, -724, 150.16, { color: [0.72, 0.68, 0.5] });
// Gỉ sắt (Fe₂O₃·nH₂O, viết gọn FeOOH) màu nâu đỏ; kẽm bị ăn mòn tạo Zn(OH)₂ trắng
sp('FeOOH', 'gỉ sắt', 's', 0, 1, -559, 88.85, { color: [0.62, 0.3, 0.12], label: 'Fe₂O₃·nH₂O' });
sp('Zn(OH)2', 'zinc hydroxide', 's', 0, 2, -642, 99.4, { color: [0.96, 0.96, 0.95] });
// Cellulose (bông), tính theo một mắt xích C₆H₁₀O₅
sp('cellulose', 'cellulose (bông)', 's', 0, 10, -963, 162.14, { color: [0.97, 0.97, 0.95], label: '(C₆H₁₀O₅)ₙ' });
sp('cellulose_nitrate', 'cellulose trinitrate', 's', 0, 7, -700, 297.13, { color: [0.95, 0.94, 0.9], label: '[C₆H₇O₂(ONO₂)₃]ₙ' });
// Cellulose tan trong nước Schweizer (tạo phức với ion đồng–ammonia)
sp('cellulose(sw)', 'cellulose tan trong nước Schweizer', 'aq', 0, 10, -963, 162.14, { label: '(C₆H₁₀O₅)ₙ' });
sp('ClO-', 'ion hypochlorite', 'aq', -1, 0, -107.1, 51.45);
// Cánh hoa hồng: chất màu trong cánh hoa bị chất tẩy màu (ClO⁻, Cl₂, HClO) phá hủy
sp('petal', 'cánh hoa hồng', 's', 0, 0, 0, 100, { color: [0.93, 0.42, 0.6], label: 'cánh hoa hồng' });
sp('petal(bleached)', 'cánh hoa đã mất màu', 's', 0, 0, 0, 100, { color: [0.95, 0.93, 0.86], label: 'cánh hoa (mất màu)' });
sp('Pt', 'platinum', 's', 0, 0, 0, 195.08, { color: [0.82, 0.82, 0.84] });
sp('CaSO4', 'calcium sulfate', 's', 0, 0, -1434.5, 136.14, { color: WHITE });
sp('Cu(OH)2', 'copper(II) hydroxide', 's', 0, 2, -449.8, 97.56, { color: [0.35, 0.6, 0.88] });
sp('Al(OH)3', 'aluminium hydroxide', 's', 0, 3, -1276, 78.0, { color: WHITE });
sp('NH4Cl', 'ammonium chloride', 's', 0, 4, -314.43, 53.49, { color: [0.97, 0.97, 0.97] });
sp('KNO3', 'potassium nitrate', 's', 0, 0, -494.63, 101.1, { color: [0.97, 0.97, 0.97] });
sp('Fe(OH)2', 'iron(II) hydroxide', 's', 0, 2, -569.0, 89.86, { color: [0.6, 0.72, 0.62] });
sp('Fe(OH)3', 'iron(III) hydroxide', 's', 0, 3, -823.0, 106.87, { color: [0.6, 0.28, 0.1] });
sp('KClO3', 'potassium chlorate', 's', 0, 0, -397.73, 122.55, { color: [0.98, 0.98, 0.97] });
sp('KCl', 'potassium chloride', 's', 0, 0, -436.5, 74.55, { color: [0.97, 0.97, 0.97] });
sp('CaCl2', 'calcium chloride', 's', 0, 0, -795.4, 110.98, { color: [0.97, 0.97, 0.96] });
sp('CaO', 'calcium oxide', 's', 0, 0, -634.92, 56.08, { color: [0.95, 0.94, 0.9] });
sp('KMnO4', 'potassium permanganate', 's', 0, 0, -837.2, 158.03, { color: [0.22, 0.05, 0.25] });
sp('Na2O', 'sodium oxide', 's', 0, 0, -414.22, 61.98, { color: [0.97, 0.97, 0.96] });
sp('MgO', 'magnesium oxide', 's', 0, 0, -601.6, 40.3, { color: [0.97, 0.97, 0.97], settleTime: 30 });
// Tính theo đơn vị P₂O₅ (phân tử thật là P₄O₁₀)
sp('P2O5', 'diphosphorus pentoxide', 's', 0, 0, -1492, 141.94, { color: [0.98, 0.98, 0.98] });
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
sp('Cl2(g)', 'khí chlorine', 'g', 0, 0, 0, 70.9);
sp('SO2(g)', 'khí sulfur dioxide', 'g', 0, 0, -296.84, 64.07, { label: 'SO₂' });
// Nitrogen dioxide (nâu đỏ) ⇌ dinitrogen tetroxide (không màu); hệ số hấp thụ của khí, L/mol/cm
sp('NO2(g)', 'khí nitrogen dioxide', 'g', 0, 0, 33.2, 46.01, { epsilon: [1.5, 22, 160], label: 'NO₂' });
sp('N2O4(g)', 'khí dinitrogen tetroxide', 'g', 0, 0, 9.16, 92.01, { label: 'N₂O₄' });

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
