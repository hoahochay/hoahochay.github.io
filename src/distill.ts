/**
 * Cân bằng lỏng – hơi của hỗn hợp ethanol – nước ở 1 atm (SGK Hóa 11 Bài 11: chưng cất).
 * Hỗn hợp sôi ở nhiệt độ giữa 78 °C và 100 °C tùy thành phần; hơi bay lên giàu ethanol hơn chất lỏng,
 * nên chất lỏng thu được ở bình hứng có độ cồn cao hơn rượu ban đầu, còn nhiệt độ sôi tăng dần.
 * Số liệu: phần mol ethanol trong lỏng x, trong hơi y, nhiệt độ sôi (°C).
 */
const X = [0, 0.019, 0.0721, 0.0966, 0.1238, 0.1661, 0.2337, 0.2608, 0.3273, 0.3965, 0.5079, 0.5732, 0.6763, 0.7472, 0.8943, 1];
const Y = [0, 0.17, 0.3891, 0.4375, 0.4704, 0.5089, 0.5445, 0.558, 0.5826, 0.6122, 0.6564, 0.6841, 0.7385, 0.7815, 0.8943, 1];
const T = [100, 95.5, 89, 86.7, 85.3, 84.1, 82.7, 82.3, 81.5, 80.7, 79.8, 79.3, 78.74, 78.41, 78.15, 78.3];

function interp(x: number, ys: number[]): number {
  if (x <= 0) return ys[0];
  if (x >= 1) return ys[ys.length - 1];
  let i = 1;
  while (X[i] < x) i++;
  const k = (x - X[i - 1]) / (X[i] - X[i - 1]);
  return ys[i - 1] + k * (ys[i] - ys[i - 1]);
}

/** Nhiệt độ sôi (K) của hỗn hợp có phần mol ethanol x */
export function bubblePointK(x: number): number {
  return interp(x, T) + 273.15;
}

/** Phần mol ethanol trong hơi cân bằng với chất lỏng có phần mol x */
export function vaporEthanol(x: number): number {
  return interp(x, Y);
}

/** Nhiệt hóa hơi của ethanol, J/mol */
export const H_VAP_ETHANOL = 38560;
/** Thể tích mol của ethanol lỏng, L/mol */
export const V_ETHANOL_L = 0.0584;
