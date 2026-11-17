/**
 * Chuyển trạng thái hóa học thành thông tin hiển thị: màu dung dịch (định luật Beer–Lambert),
 * độ đục do kết tủa lơ lửng.
 */
import { Mixture } from './mixture';
import { RGB, species } from './species';

/** Màu ánh sáng truyền qua dung dịch (0..1), độ dày lớp chất lỏng pathCm */
export function solutionColor(mix: Mixture, pathCm: number): RGB {
  const A: RGB = [0, 0, 0];
  if (mix.volumeL <= 0) return [1, 1, 1];
  const pH = -Math.log10(mix.h);
  for (const [id, n] of mix.moles) {
    const s = species(id);
    if (s.phase !== 'aq') continue;
    const c = n / mix.volumeL;
    if (s.epsilon) for (let i = 0; i < 3; i++) A[i] += s.epsilon[i] * c * pathCm;
    if (s.indicator) {
      const f = 1 / (1 + 10 ** (s.indicator.pKa - pH)); // phần dạng bazơ
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
  const color: RGB = [0, 0, 0];
  for (const [id, susp] of mix.suspended) {
    const s = species(id);
    const g = mix.get(id) * susp * s.molarMass;
    if (g <= 0) continue;
    grams += g;
    const c = s.color ?? [1, 1, 1];
    for (let i = 0; i < 3; i++) color[i] += g * c[i];
  }
  if (grams <= 0) return { turbidity: 0, color: [1, 1, 1] };
  const gPerL = grams / mix.volumeL;
  return {
    turbidity: 1 - Math.exp(-0.5 * gPerL * pathCm),
    color: color.map((x) => x / grams) as RGB,
  };
}

export function toHex(c: RGB): string {
  return '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
}
