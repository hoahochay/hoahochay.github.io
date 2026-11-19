/**
 * Chuyển trạng thái hóa học thành thông tin hiển thị: màu dung dịch (định luật Beer–Lambert),
 * độ đục do kết tủa lơ lửng.
 */
import { Mixture } from './mixture';
import { RGB, species } from './species';
import { alphas, constantsAt } from './equilibrium';
import { KW25 } from './constants';

/** Màu ánh sáng truyền qua dung dịch (0..1), độ dày lớp chất lỏng pathCm */
export function solutionColor(mix: Mixture, pathCm: number): RGB {
  const A: RGB = [0, 0, 0];
  if (mix.volumeL <= 0) return [1, 1, 1];
  const pH = -Math.log10(mix.h);
  /** pH quy đổi theo [OH⁻] với Kw ở 25 °C (cho chỉ thị đổi màu theo OH⁻) */
  const pHviaOH = pH + Math.log10(constantsAt(mix.tempK).Kw / KW25);
  for (const [id, n] of mix.moles) {
    const s = species(id);
    if (s.phase !== 'aq') continue;
    const c = n / mix.volumeL;
    if (s.epsilon) for (let i = 0; i < 3; i++) A[i] += s.epsilon[i] * c * pathCm;
    if (s.indicator) {
      if (s.indicator.forms) {
        const a = alphas(s.indicator.forms.pKa, -pH);
        for (let i = 0; i < 3; i++) {
          let e = 0;
          for (let k = 0; k < a.length; k++) e += a[k] * s.indicator.forms.eps[k][i];
          A[i] += e * c * pathCm;
        }
        continue;
      }
      const x = s.indicator.viaOH ? pHviaOH : pH;
      const f = 1 / (1 + 10 ** ((s.indicator.hill ?? 1) * (s.indicator.pKa - x))); // phần dạng base
      for (let i = 0; i < 3; i++) {
        A[i] += ((1 - f) * s.indicator.acidEps[i] + f * s.indicator.baseEps[i]) * c * pathCm;
      }
    }
  }
  return A.map((a) => 10 ** -a) as RGB;
}

/** Độ đục 0..1 và màu trung bình của kết tủa đang lơ lửng */
export function turbidity(mix: Mixture, pathCm: number): { turbidity: number; color: RGB } {
  if (mix.volumeL <= 0) return { turbidity: 0, color: [1, 1, 1] };
  let grams = 0;
  let optical = 0;
  const color: RGB = [0, 0, 0];
  for (const [id, susp] of mix.suspended) {
    const s = species(id);
    const g = mix.get(id) * susp * s.molarMass;
    if (g <= 0) continue;
    grams += g;
    optical += g * (s.scatter ?? 1);
    const c = s.color ?? [1, 1, 1];
    for (let i = 0; i < 3; i++) color[i] += g * c[i];
  }
  if (grams <= 0) return { turbidity: 0, color: [1, 1, 1] };
  const gPerL = optical / mix.volumeL;
  return {
    turbidity: 1 - Math.exp(-0.5 * gPerL * pathCm),
    color: color.map((x) => x / grams) as RGB,
  };
}

export function toHex(c: RGB): string {
  return '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
}
