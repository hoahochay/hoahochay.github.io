/**
 * Chất lỏng hữu cơ không tan trong nước (hexane, benzene, toluene):
 * tách thành một lớp riêng, nhẹ hơn nước thì nổi lên trên, nặng hơn thì chìm xuống dưới.
 *
 * - Dung môi hữu cơ là chất có phase 'org' và có khối lượng riêng (density).
 * - Chất tan trong lớp hữu cơ (Br₂, β-carotene…) cũng có phase 'org' nhưng không có density.
 * - Chất tan phân bố giữa hai lớp theo hệ số phân bố K = c(hữu cơ) / c(nước). Để yên thì
 *   chất tan chỉ khuếch tán chậm qua mặt phân cách; lắc mạnh thì đạt cân bằng trong vài giây.
 */
import { Mixture } from './mixture';
import { species } from './species';

export interface Partition {
  aq: string;
  org: string;
  /** Hệ số phân bố c(org)/c(aq) */
  K: number;
}

export const PARTITIONS: Partition[] = [
  // Bromine tan trong hexane tốt hơn trong nước nhiều lần (chiết bromine)
  { aq: 'Br2', org: 'Br2(org)', K: 30 },
  // β-carotene gần như không tan trong nước, tan tốt trong hexane
  { aq: 'carotene', org: 'carotene(org)', K: 3000 },
];

/** Thể tích lớp chất lỏng hữu cơ, L */
export function orgVolumeL(mix: Mixture): number {
  return mix.orgL();
}

/** Khối lượng riêng trung bình của lớp hữu cơ, g/mL (0 nếu không có) */
export function orgDensity(mix: Mixture): number {
  let g = 0, v = 0;
  for (const [id, n] of mix.moles) {
    const s = species(id);
    if (s.phase === 'org' && s.density) {
      g += n * s.molarMass;
      v += (n * s.molarMass) / s.density;
    }
  }
  return v > 0 ? g / v : 0;
}

/**
 * Trao đổi chất giữa lớp nước và lớp hữu cơ trong dt giây.
 * agitation (0..1): mức khuấy trộn, 1 ngay sau khi lắc.
 */
export function exchangeOrganic(mix: Mixture, dt: number, agitation: number): void {
  const Vaq = mix.volumeL;
  const Vorg = orgVolumeL(mix);
  for (const p of PARTITIONS) {
    const na = mix.get(p.aq), no = mix.get(p.org);
    const n = na + no;
    if (n <= 0) continue;
    if (Vorg <= 1e-9) {
      // Không còn lớp hữu cơ: chất tan trở về nước
      if (no > 0) { mix.set(p.org, 0); mix.add(p.aq, no); }
      continue;
    }
    const noEq = Vaq <= 1e-9 ? n : (n * p.K * Vorg) / (Vaq + p.K * Vorg);
    // Để yên: chỉ khuếch tán chậm qua mặt phân cách; lắc: đạt cân bằng sau vài giây
    const r = 0.0003 + 1.5 * agitation;
    const d = (noEq - no) * (1 - Math.exp(-r * dt));
    mix.set(p.org, no + d);
    mix.set(p.aq, na - d);
  }
}
