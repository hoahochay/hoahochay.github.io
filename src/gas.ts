/**
 * Pha khí phía trên mặt chất lỏng ("khoảng khí" trong ống nghiệm / cốc).
 *
 * - Khí sinh ra (bọt khí) đi vào khoảng khí, đẩy hỗn hợp khí cũ ra khỏi miệng ống.
 * - Khí thoát dần ra phòng qua miệng ống: khuếch tán + đối lưu. Khí nhẹ hơn không khí
 *   (H2, NH3) bay ra rất nhanh; khí nặng (CO2) đọng lại lâu → vì vậy thu CO2 phải ngửa bình.
 * - Khí tan (CO2, NH3) trao đổi với dung dịch theo định luật Henry: c = kH·p.
 *   Khi dung dịch quá bão hòa so với 1 atm, khí tách ra thành bọt (sủi bọt).
 */
import { Mixture } from './mixture';
import { species } from './species';
import { arrhenius, reactionEnthalpy, vantHoff } from './thermo';

export interface GasDef {
  id: string;
  /** Hệ số khuếch tán trong không khí, cm²/s */
  D: number;
  /** Dạng tan trong nước và hằng số Henry ở 25°C (M/atm) */
  dissolved?: { species: string; kH: number };
}

export const GASES: GasDef[] = [
  { id: 'H2', D: 0.61 },
  { id: 'O2', D: 0.2 },
  { id: 'CO2', D: 0.16, dissolved: { species: 'H2CO3', kH: 0.034 } },
  { id: 'NH3(g)', D: 0.23, dissolved: { species: 'NH3', kH: 58 } },
];
export const GAS_INDEX = new Map(GASES.map((g) => [g.id, g]));

/** Thành phần không khí (phần mol) */
export const AIR = { O2: 0.21, CO2: 4e-4 };
const M_AIR = 28.96;
const R_LATM = 0.082057;

/** Hình học của dụng cụ mà pha khí cần biết */
export interface GasVesselSpec {
  /** Thể tích trong toàn bộ, L */
  volumeL: number;
  /** Diện tích miệng (≈ diện tích mặt thoáng), cm² */
  mouthAreaCm2: number;
}

/** Hệ số truyền khối qua mặt thoáng chất lỏng (yên tĩnh), cm/s */
const K_LIQUID = 0.002;
/** Tốc độ tách bọt khi quá bão hòa, 1/s */
const K_NUCLEATION = 0.3;
/** Gió nhẹ trong phòng làm mới khí ở miệng ống, 1/s */
const K_DRAFT = 0.01;
/** Hệ số đối lưu do khí nhẹ hơn không khí */
const BUOYANCY = 100;

export function headspaceL(mix: Mixture, spec: GasVesselSpec): number {
  return Math.max(0.0005, spec.volumeL - mix.volumeL);
}

/** Hằng số Henry theo nhiệt độ (M/atm), ΔH hòa tan tính từ ΔfH° */
export function henryK(g: GasDef, T: number): number {
  if (!g.dissolved) return 0;
  return vantHoff(g.dissolved.kH, reactionEnthalpy(g.id, { [g.dissolved.species]: 1 }), T);
}

/** Áp suất riêng phần (atm) của khí trong khoảng khí */
export function partialPressure(mix: Mixture, id: string, spec: GasVesselSpec): number {
  return ((mix.headspace.get(id) ?? 0) * R_LATM * mix.tempK) / headspaceL(mix, spec);
}

/** Phần mol của các khí sinh ra trong khoảng khí (phần còn lại là không khí) */
export function headspaceFractions(mix: Mixture, spec: GasVesselSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of mix.headspace.keys()) out[id] = Math.min(1, partialPressure(mix, id, spec));
  return out;
}

/** Trao đổi khí giữa dung dịch và khoảng khí trong dt giây */
export function exchangeGases(mix: Mixture, spec: GasVesselSpec, dt: number): void {
  if (mix.volumeL <= 0) return;
  const T = mix.tempK;
  for (const g of GASES) {
    if (!g.dissolved) continue;
    const aq = g.dissolved.species;
    const kH = henryK(g, T);
    // Quá bão hòa so với khí nguyên chất ở 1 atm → tách thành bọt
    const c = mix.conc(aq);
    if (c > kH) {
      const nb = Math.min(mix.get(aq), arrhenius(K_NUCLEATION, 15000, T) * mix.volumeL * (c - kH) * dt);
      mix.add(aq, -nb);
      mix.add(g.id, nb);
    }
    // Bay hơi / hòa tan qua mặt thoáng
    const J = (K_LIQUID * spec.mouthAreaCm2 * (mix.conc(aq) - kH * partialPressure(mix, g.id, spec))) / 1000;
    if (J > 0) {
      const d = Math.min(J * dt, mix.get(aq) * 0.5);
      mix.add(aq, -d);
      mix.headspace.set(g.id, (mix.headspace.get(g.id) ?? 0) + d);
    } else if (J < 0) {
      const d = Math.min(-J * dt, mix.headspace.get(g.id) ?? 0);
      mix.headspace.set(g.id, (mix.headspace.get(g.id) ?? 0) - d);
      mix.add(aq, d);
    }
  }
}

/** Tốc độ khí thoát khỏi miệng dụng cụ, 1/s */
function ventRate(id: string, spec: GasVesselSpec, VhL: number): number {
  const g = GAS_INDEX.get(id);
  const Vh = VhL * 1000; // cm³
  const A = spec.mouthAreaCm2;
  const lighter = Math.max(0, (M_AIR - species(id).molarMass) / M_AIR);
  return ((g?.D ?? 0.2) * A * A) / (Vh * Vh) * (1 + BUOYANCY * lighter) + K_DRAFT;
}

/**
 * Đưa khí mới sinh vào khoảng khí (đẩy khí cũ ra), rồi cho khí thoát dần qua miệng.
 * Trả về lượng mỗi khí đã thoát ra ngoài phòng.
 */
export function ventHeadspace(mix: Mixture, spec: GasVesselSpec, dt: number, inflow: Map<string, number>): Map<string, number> {
  const escaped = new Map<string, number>();
  const out = (id: string, n: number) => {
    if (n <= 0) return;
    escaped.set(id, (escaped.get(id) ?? 0) + n);
    const left = (mix.headspace.get(id) ?? 0) - n;
    if (left > 1e-15) mix.headspace.set(id, left);
    else mix.headspace.delete(id);
  };
  const Vh = headspaceL(mix, spec);
  const nCap = Vh / (R_LATM * mix.tempK);
  // Khí mới vào đẩy hỗn hợp cũ ra (giả thiết khoảng khí trộn đều)
  let nIn = 0;
  for (const n of inflow.values()) nIn += n;
  const f = Math.min(1, nIn / nCap);
  if (f > 0) for (const [id, n] of [...mix.headspace]) out(id, n * f);
  for (const [id, n] of inflow) mix.headspace.set(id, (mix.headspace.get(id) ?? 0) + n);
  // Không vượt quá 1 atm
  let total = 0;
  for (const n of mix.headspace.values()) total += n;
  if (total > nCap) {
    const k = 1 - nCap / total;
    for (const [id, n] of [...mix.headspace]) out(id, n * k);
  }
  // Khuếch tán + đối lưu qua miệng
  if (dt > 0) {
    for (const [id, n] of [...mix.headspace]) out(id, n * (1 - Math.exp(-ventRate(id, spec, Vh) * dt)));
  }
  return escaped;
}

