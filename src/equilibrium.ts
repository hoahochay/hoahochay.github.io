/**
 * Giải các cân bằng nhanh (tức thời) trong dung dịch:
 *  - acid–base: tìm [H+] thỏa mãn định luật bảo toàn điện tích
 *  - kết tủa: nếu Q > Ksp thì kết tủa phần dư cho đến khi Q = Ksp
 *
 * H+ và OH- không được lưu như số liệu đầu vào; chúng được suy ra từ cân bằng
 * điện tích. Nhờ vậy mọi phản ứng tiêu thụ/sinh H+ (Mg + 2H+, Na + H2O, ...)
 * tự động làm pH thay đổi đúng mà không cần ghi riêng.
 */
import { KW25 } from './constants';
import { Mixture } from './mixture';
import { species } from './species';
import { FAMILIES, FAMILY_INDEX, SOLIDS, SolidDef } from './systems';
import { reactionEnthalpy, vantHoff } from './thermo';

export interface EqConstants {
  Kw: number;
  /** pKa theo nhiệt độ, cho từng hệ */
  pKa: number[][];
  Ksp: Map<string, number>;
}

const cache = new Map<number, EqConstants>();

export function constantsAt(T: number): EqConstants {
  const key = Math.round(T * 100);
  const hit = cache.get(key);
  if (hit) return hit;
  const Kw = vantHoff(KW25, reactionEnthalpy('H2O', { 'H+': 1, 'OH-': 1 }), T);
  const pKa = FAMILIES.map((f) =>
    f.pKa.map((pk, i) => {
      const dH = reactionEnthalpy(f.forms[i], { [f.forms[i + 1]]: 1, 'H+': 1 });
      return -Math.log10(vantHoff(10 ** -pk, dH, T));
    }),
  );
  const Ksp = new Map(SOLIDS.map((s) => [s.id, vantHoff(s.Ksp, reactionEnthalpy(s.id, s.ions), T)]));
  const k = { Kw, pKa, Ksp };
  if (cache.size > 5000) cache.clear();
  cache.set(key, k);
  return k;
}

/** Tổng lượng (mol) của các chất tan, nhóm theo vai trò */
export interface Totals {
  V: number;
  /** Ion "cố định" (không tham gia acid–base): Na+, Cl-, ... */
  fixed: Map<string, number>;
  /** Tổng mol của từng hệ acid–base */
  family: number[];
}

export function collectTotals(mix: Mixture): Totals {
  const fixed = new Map<string, number>();
  const family = FAMILIES.map(() => 0);
  for (const [id, n] of mix.moles) {
    const s = species(id);
    if (s.phase !== 'aq' || id === 'H+' || id === 'OH-') continue;
    const fi = FAMILY_INDEX.get(id);
    if (fi) family[fi.family] += n;
    else if (s.charge !== 0) fixed.set(id, n);
  }
  return { V: mix.volumeL, fixed, family };
}

/** Phần mol của từng dạng trong hệ acid–base tại [H+] = 10^logh */
export function alphas(pKa: number[], logh: number): number[] {
  const m = pKa.length;
  const logs: number[] = [];
  let acc = 0;
  for (let k = 0; k <= m; k++) {
    if (k > 0) acc += pKa[k - 1];
    logs.push((m - k) * logh - acc);
  }
  const max = Math.max(...logs);
  const e = logs.map((l) => 10 ** (l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / sum);
}

/** Tổng điện tích (mol/L); bằng 0 tại nghiệm. Hàm tăng đơn điệu theo [H+]. */
export function chargeBalance(logh: number, t: Totals, K: EqConstants): number {
  const h = 10 ** logh;
  let q = h - K.Kw / h;
  for (const [id, n] of t.fixed) q += (species(id).charge * n) / t.V;
  FAMILIES.forEach((f, i) => {
    const total = t.family[i];
    if (total <= 0) return;
    const a = alphas(K.pKa[i], logh);
    f.forms.forEach((id, k) => (q += (species(id).charge * a[k] * total) / t.V));
  });
  return q;
}

/** Tìm log10[H+] bằng chia đôi (luôn hội tụ vì hàm đơn điệu) */
export function solveLogH(t: Totals, K: EqConstants): number {
  let lo = -16;
  let hi = 2;
  for (let i = 0; i < 64; i++) {
    const mid = 0.5 * (lo + hi);
    if (chargeBalance(mid, t, K) > 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

function ionConc(id: string, logh: number, t: Totals, K: EqConstants): number {
  if (id === 'H+') return 10 ** logh;
  if (id === 'OH-') return K.Kw / 10 ** logh;
  const fi = FAMILY_INDEX.get(id);
  if (fi) return (t.family[fi.family] * alphas(K.pKa[fi.family], logh)[fi.form]) / t.V;
  return (t.fixed.get(id) ?? 0) / t.V;
}

export function ionProduct(s: SolidDef, logh: number, t: Totals, K: EqConstants): number {
  let q = 1;
  for (const [id, nu] of Object.entries(s.ions)) q *= ionConc(id, logh, t, K) ** nu;
  return q;
}

function available(t: Totals, id: string): number {
  if (id === 'H+' || id === 'OH-') return Infinity;
  const fi = FAMILY_INDEX.get(id);
  return fi ? t.family[fi.family] : (t.fixed.get(id) ?? 0);
}

/** Totals sau khi kết tủa thêm d mol chất rắn s */
function withSolid(t: Totals, s: SolidDef, d: number): Totals {
  const fixed = new Map(t.fixed);
  const family = [...t.family];
  for (const [id, nu] of Object.entries(s.ions)) {
    if (id === 'H+' || id === 'OH-') continue;
    const fi = FAMILY_INDEX.get(id);
    if (fi) family[fi.family] = Math.max(0, family[fi.family] - nu * d);
    else fixed.set(id, Math.max(0, (fixed.get(id) ?? 0) - nu * d));
  }
  return { V: t.V, fixed, family };
}

/**
 * Đưa hỗn hợp về trạng thái cân bằng nhanh. Cập nhật mix tại chỗ.
 * Không tự tính nhiệt hay lượng nước: phần đó do Vessel làm bằng bảo toàn H và enthalpy.
 */
export function equilibrate(mix: Mixture): void {
  if (mix.volumeL <= 0) return;
  const K = constantsAt(mix.tempK);
  let t = collectTotals(mix);
  let logh = solveLogH(t, K);

  // Kết tủa: lặp vì kết tủa này có thể ảnh hưởng tới pH và kết tủa khác
  for (let round = 0; round < 20; round++) {
    let changed = false;
    for (const s of SOLIDS) {
      if (s.dissolveOnly) continue;
      const ksp = K.Ksp.get(s.id)!;
      const fresh = !(mix.get(s.id) > 0);
      if (ionProduct(s, logh, t, K) <= ksp * (fresh && s.nucleation ? s.nucleation : 1 + 1e-9)) continue;
      let maxD = Infinity;
      for (const [id, nu] of Object.entries(s.ions)) maxD = Math.min(maxD, available(t, id) / nu);
      if (!(maxD > 0) || !Number.isFinite(maxD)) continue;
      // Muối tạo từ ion "cố định" (vd. PbI2, AgCl) trung hòa điện nên không làm đổi pH
      const affectsPH = Object.keys(s.ions).some((id) => id === 'H+' || id === 'OH-' || FAMILY_INDEX.has(id));
      let lo = 0;
      let hi = maxD;
      for (let i = 0; i < 60; i++) {
        const mid = 0.5 * (lo + hi);
        const tm = withSolid(t, s, mid);
        if (ionProduct(s, affectsPH ? solveLogH(tm, K) : logh, tm, K) > ksp) lo = mid;
        else hi = mid;
      }
      t = withSolid(t, s, hi);
      logh = solveLogH(t, K);
      mix.addPrecipitate(s.id, hi);
      changed = true;
    }
    if (!changed) break;
  }

  // Ghi kết quả trở lại hỗn hợp
  for (const [id, n] of t.fixed) mix.set(id, n);
  FAMILIES.forEach((f, i) => {
    const a = alphas(K.pKa[i], logh);
    f.forms.forEach((id, k) => mix.set(id, t.family[i] * a[k]));
  });
  const h = 10 ** logh;
  mix.set('H+', h * t.V);
  mix.set('OH-', (K.Kw / h) * t.V);
  mix.h = h;

  mix.saturation.clear();
  for (const s of SOLIDS) mix.saturation.set(s.id, ionProduct(s, logh, t, K) / K.Ksp.get(s.id)!);
}
