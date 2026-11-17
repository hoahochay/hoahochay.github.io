import { Mixture, SolidForm } from './mixture';
import { species } from './species';
import { SOLIDS } from './systems';
import { arrhenius } from './thermo';

/** H+, OH-, H2O không trừ/cộng trực tiếp: cân bằng điện tích và bảo toàn H lo phần này */
export const IMPLICIT = new Set(['H+', 'OH-', 'H2O']);

export interface RateContext {
  mix: Mixture;
  T: number;
  V: number;
  conc(id: string): number;
  surface(id: string): number;
}

export interface KineticReaction {
  id: string;
  name: string;
  equation: string;
  reactants: Record<string, number>;
  products: Record<string, number>;
  /** Tốc độ phản ứng, mol/s (theo tiến độ ξ) */
  rate(ctx: RateContext): number;
  /** Hình dạng của sản phẩm rắn (vd. đồng bám trên đinh sắt) */
  productForm?: SolidForm;
}

export interface MassActionOpts {
  /** Hằng số tốc độ ở 25°C */
  k25: number;
  /** Năng lượng hoạt hóa, J/mol */
  Ea: number;
  /** Bậc phản ứng theo nồng độ (M) */
  orders?: Record<string, number>;
  /** Phản ứng dị thể: tốc độ tỉ lệ diện tích bề mặt (cm²) của chất rắn này; nếu không có thì tỉ lệ thể tích (L) */
  surface?: string;
}

/** r = k(T) · (S hoặc V) · Π [C]^n */
export function massAction(o: MassActionOpts): (ctx: RateContext) => number {
  return (ctx) => {
    const extent = o.surface ? ctx.surface(o.surface) : ctx.V;
    if (extent <= 0) return 0;
    let r = arrhenius(o.k25, o.Ea, ctx.T) * extent;
    for (const [id, n] of Object.entries(o.orders ?? {})) r *= ctx.conc(id) ** n;
    return r;
  };
}

function context(mix: Mixture): RateContext {
  return {
    mix,
    T: mix.tempK,
    V: mix.volumeL,
    conc: (id) => mix.conc(id),
    surface: (id) => mix.surface(id),
  };
}

/** Chạy các phản ứng chậm trong khoảng thời gian dt (s) */
export function runKinetics(mix: Mixture, dt: number, reactions: KineticReaction[]): void {
  const ctx = context(mix);
  // "Ngân sách" H+/OH- trong bước này, để nhiều phản ứng không dùng quá lượng có sẵn
  const budget = new Map([['H+', mix.get('H+')], ['OH-', mix.get('OH-')]]);
  for (const r of reactions) {
    const rate = r.rate(ctx);
    if (!(rate > 0)) continue;
    let dXi = rate * dt;
    for (const [id, nu] of Object.entries(r.reactants)) {
      if (id === 'H2O') continue;
      const avail = budget.has(id) ? 0.5 * budget.get(id)! : mix.get(id);
      dXi = Math.min(dXi, avail / nu);
    }
    if (!(dXi > 0)) continue;
    for (const [id, nu] of Object.entries(r.reactants)) {
      if (budget.has(id)) budget.set(id, budget.get(id)! - nu * dXi);
      if (!IMPLICIT.has(id)) mix.add(id, -nu * dXi);
    }
    for (const [id, nu] of Object.entries(r.products)) {
      if (IMPLICIT.has(id)) continue;
      mix.add(id, nu * dXi);
      if (species(id).phase === 's' && !mix.formFactor.has(id)) mix.setForm(id, r.productForm ?? 'precipitate');
    }
  }
}

/** Hòa tan chất ít tan khi dung dịch chưa bão hòa (Q < Ksp) */
export function runDissolution(mix: Mixture, dt: number): void {
  for (const s of SOLIDS) {
    const n = mix.get(s.id);
    if (n <= 0) continue;
    const drive = 1 - (mix.saturation.get(s.id) ?? 0);
    if (drive <= 0) continue;
    const d = s.dissolution;
    const k = arrhenius(d.k, d.Ea, mix.tempK) + (d.kH ? arrhenius(d.kH, d.Ea, mix.tempK) * mix.conc('H+') : 0);
    const dXi = Math.min(n, k * mix.surface(s.id) * drive * dt);
    if (dXi <= 0) continue;
    mix.add(s.id, -dXi);
    for (const [id, nu] of Object.entries(s.ions)) if (!IMPLICIT.has(id)) mix.add(id, nu * dXi);
  }
}
