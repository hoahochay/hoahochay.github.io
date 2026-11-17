import { CP_WATER, R, T25 } from './constants';
import { Mixture } from './mixture';
import { species } from './species';

/** Tổng enthalpy của hỗn hợp (J), theo ΔfH°. Nhiệt tỏa ra = H_trước − H_sau. */
export function enthalpy(mix: Mixture): number {
  let h = 0;
  for (const [id, n] of mix.moles) h += n * species(id).dHf * 1000;
  for (const [id, n] of mix.headspace) h += n * species(id).dHf * 1000;
  return h;
}

/** Tổng số nguyên tử H (kể cả khoảng khí), không tính nước. Dùng để suy ra lượng nước sinh ra/mất đi. */
export function hydrogenAtoms(mix: Mixture): number {
  let a = 0;
  for (const [id, n] of mix.moles) if (id !== 'H2O') a += n * species(id).hCount;
  for (const [id, n] of mix.headspace) a += n * species(id).hCount;
  return a;
}

/** Nhiệt dung của chất lỏng trong hỗn hợp, J/K */
export function liquidHeatCapacity(mix: Mixture): number {
  return CP_WATER * mix.get('H2O');
}

/** Nhiệt dung riêng gần đúng của chất rắn, J/(g·K) */
const CP_SOLID = 0.6;

/** Nhiệt dung của các chất rắn trong hỗn hợp, J/K */
export function solidHeatCapacity(mix: Mixture): number {
  let c = 0;
  for (const [id, n] of mix.moles) {
    const s = species(id);
    if (s.phase === 's') c += n * s.molarMass * CP_SOLID;
  }
  return c;
}

/** Hằng số cân bằng ở nhiệt độ T theo phương trình van 't Hoff (ΔH tính bằng kJ/mol) */
export function vantHoff(K25: number, dH_kJ: number, T: number): number {
  return K25 * Math.exp((-dH_kJ * 1000) / R * (1 / T - 1 / T25));
}

/** Hằng số tốc độ theo phương trình Arrhenius, quy về giá trị ở 25°C */
export function arrhenius(k25: number, EaJ: number, T: number): number {
  return k25 * Math.exp((-EaJ / R) * (1 / T - 1 / T25));
}

/**
 * ΔH (kJ/mol) của quá trình reactant → Σ products, tự bù nước sao cho bảo toàn H.
 * Ví dụ Fe3+ → FeOH2+ + H+ thực chất là Fe3+ + H2O → FeOH2+ + H+.
 */
export function reactionEnthalpy(reactant: string, products: Record<string, number>): number {
  let dH = -species(reactant).dHf;
  let hBalance = -species(reactant).hCount;
  for (const [id, nu] of Object.entries(products)) {
    dH += nu * species(id).dHf;
    hBalance += nu * species(id).hCount;
  }
  const waterConsumed = hBalance / 2;
  return dH - waterConsumed * species('H2O').dHf;
}
