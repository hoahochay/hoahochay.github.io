/**
 * Các phép thử khí trong phòng thí nghiệm, đặt ở miệng dụng cụ.
 * Kết quả suy ra từ thành phần khoảng khí (gas.ts), không gán cứng theo thí nghiệm.
 */
import { WATER_PER_L } from './constants';
import { equilibrate } from './equilibrium';
import { AIR, GAS_INDEX, headspaceFractions, henryK } from './gas';
import { Mixture } from './mixture';
import { RGB } from './species';
import type { Vessel } from './vessel';

export interface Atmosphere {
  /** Phần mol O2 (kể cả O2 của không khí còn lại) */
  O2: number;
  H2: number;
  CO2: number;
  NH3: number;
  Cl2: number;
  SO2: number;
  /** Phần không khí còn lại */
  air: number;
}

/** Thành phần khí ở miệng dụng cụ */
export function atmosphere(v: Vessel): Atmosphere {
  const f = headspaceFractions(v.mix, v.spec);
  const produced = Object.values(f).reduce((a, b) => a + b, 0);
  const air = Math.max(0, 1 - produced);
  return {
    O2: (f.O2 ?? 0) + AIR.O2 * air,
    H2: f.H2 ?? 0,
    CO2: (f.CO2 ?? 0) + AIR.CO2 * air,
    NH3: f['NH3(g)'] ?? 0,
    Cl2: f['Cl2(g)'] ?? 0,
    SO2: f['SO2(g)'] ?? 0,
    air,
  };
}

/** Phần mol chlorine ở miệng dụng cụ từ đó giấy màu ẩm bị tẩy màu rõ trong vài giây */
export const BLEACH_MIN_CL2 = 0.05;

/**
 * Mẩu giấy màu ẩm: chlorine tan vào lớp nước trên giấy tạo HClO, chất oxi hóa mạnh, làm mất màu.
 * Trả về tốc độ mất màu (1/s); 0 nếu không có chlorine.
 */
export function bleachRate(v: Vessel): number {
  const c = atmosphere(v).Cl2;
  return c < 0.005 ? 0 : 0.8 * c;
}
export function testDyePaper(v: Vessel): 'bleached' | 'none' {
  return atmosphere(v).Cl2 >= BLEACH_MIN_CL2 ? 'bleached' : 'none';
}

export type GlowingSplintResult = 'relight' | 'none';
export type BurningSplintResult = 'pop' | 'burns-at-mouth' | 'brighter' | 'extinguished' | 'normal';

/** Que đóm còn tàn đỏ bùng cháy khi khí giàu oxygen (≳ 50% O2) */
export function testGlowingSplint(v: Vessel): GlowingSplintResult {
  return atmosphere(v).O2 >= 0.5 ? 'relight' : 'none';
}

/**
 * Que đóm đang cháy:
 *  - H2 lẫn không khí (4–75%): nổ nhỏ "bụp", H2 bị đốt hết
 *  - H2 gần nguyên chất: khí cháy ở miệng ống, lửa xanh nhạt
 *  - Giàu O2: cháy sáng mạnh hơn
 *  - Thiếu O2 (CO2, ... chiếm chỗ): que đóm tắt
 */
export function testBurningSplint(v: Vessel): BurningSplintResult {
  const a = atmosphere(v);
  let result: BurningSplintResult = 'normal';
  if (a.H2 >= 0.04 && a.H2 <= 0.75) result = 'pop';
  else if (a.H2 > 0.75) result = 'burns-at-mouth';
  else if (a.O2 >= 0.5) result = 'brighter';
  else if (a.O2 < 0.15) result = 'extinguished';
  if (result === 'pop' || result === 'burns-at-mouth') v.mix.headspace.delete('H2');
  return result;
}

/** pH của lớp nước mỏng trên giấy quỳ ẩm, cân bằng với khí ở miệng dụng cụ */
export function litmusPH(v: Vessel): number {
  const a = atmosphere(v);
  const T = v.mix.tempK;
  const film = new Mixture();
  film.volumeL = 1e-5;
  film.tempK = T;
  film.set('H2O', film.volumeL * WATER_PER_L);
  film.add('H2CO3', henryK(GAS_INDEX.get('CO2')!, T) * a.CO2 * film.volumeL);
  film.add('NH3', henryK(GAS_INDEX.get('NH3(g)')!, T) * a.NH3 * film.volumeL);
  film.add('SO2', henryK(GAS_INDEX.get('SO2(g)')!, T) * a.SO2 * film.volumeL);
  equilibrate(film);
  return -Math.log10(film.h);
}

const LITMUS_RED: RGB = [0.86, 0.22, 0.26];
const LITMUS_PURPLE: RGB = [0.56, 0.32, 0.62];
const LITMUS_BLUE: RGB = [0.36, 0.46, 0.86];
const LITMUS_DEEP_BLUE: RGB = [0.1, 0.2, 0.72];

/**
 * Màu quỳ tím theo pH: đỏ (pH < 4,5) – tím (5–8) – xanh (pH > 9).
 * Base càng mạnh quỳ càng xanh đậm (vd. NaOH xanh đậm, Mg(OH)₂ xanh nhạt).
 */
export function litmusColor(pH: number): RGB {
  const lerp = (a: RGB, b: RGB, t: number) => a.map((x, i) => x + (b[i] - x) * Math.max(0, Math.min(1, t))) as RGB;
  if (pH < 5) return lerp(LITMUS_RED, LITMUS_PURPLE, (pH - 4.2) / 0.8);
  if (pH < 10) return lerp(LITMUS_PURPLE, LITMUS_BLUE, (pH - 8) / 1);
  return lerp(LITMUS_BLUE, LITMUS_DEEP_BLUE, (pH - 10.5) / 2);
}

/** Đánh giá màu quỳ: 'acid' (đỏ), 'base' (xanh) hoặc 'neutral' (không đổi màu) */
export function litmusVerdict(pH: number): 'acid' | 'base' | 'neutral' {
  return pH < 4.8 ? 'acid' : pH > 8.3 ? 'base' : 'neutral';
}

/** Lượng sắt tự do tối thiểu để thấy rõ bị nam châm hút, g */
export const MAGNET_MIN_FE_G = 0.02;

/** Đưa nam châm lại gần: sắt tự do bị hút; hợp chất của sắt như FeS thì không */
export function testMagnet(v: Vessel): 'attracted' | 'none' {
  return v.mix.get('Fe') * 55.85 >= MAGNET_MIN_FE_G ? 'attracted' : 'none';
}

/** Lượng lưu huỳnh trên muôi sắt (khoảng 0,05 g), mol */
export const SPOON_SULFUR_MOL = 0.05 / 32.06;

/**
 * Muôi sắt chứa lưu huỳnh đang cháy được đưa vào dụng cụ trong dt giây: S + O₂ → SO₂.
 * Tốc độ cháy tỉ lệ với phần mol O₂ ở chỗ ngọn lửa; trả về phần mol O₂ đó (độ sáng ngọn lửa).
 */
export function burnSulfurIn(v: Vessel, dt: number): number {
  const o2 = atmosphere(v).O2;
  const n = 4e-5 * o2 * dt;
  const hs = v.mix.headspace;
  // O₂ thu được (nếu có) bị tiêu thụ trước; phần còn lại lấy từ không khí trong bình
  const fromO2 = Math.min(n, hs.get('O2') ?? 0);
  if (fromO2 > 0) hs.set('O2', (hs.get('O2') ?? 0) - fromO2);
  hs.set('SO2(g)', (hs.get('SO2(g)') ?? 0) + n);
  return o2;
}
