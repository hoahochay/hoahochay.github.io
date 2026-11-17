import { T25, WATER_PER_L } from './constants';
import { equilibrate } from './equilibrium';
import { Mixture } from './mixture';
import { species } from './species';
import { hydrogenAtoms } from './thermo';

export interface Compound {
  name: string;
  /** Các tiểu phân sinh ra khi hòa tan 1 mol chất */
  ions: Record<string, number>;
}

/** Hóa chất pha thành dung dịch */
export const COMPOUNDS: Record<string, Compound> = {
  HCl: { name: 'axit clohiđric', ions: { 'H+': 1, 'Cl-': 1 } },
  HNO3: { name: 'axit nitric', ions: { 'H+': 1, 'NO3-': 1 } },
  H2SO4: { name: 'axit sunfuric', ions: { 'H+': 2, 'SO4^2-': 1 } },
  CH3COOH: { name: 'axit axetic', ions: { CH3COOH: 1 } },
  NaOH: { name: 'natri hiđroxit', ions: { 'Na+': 1, 'OH-': 1 } },
  KOH: { name: 'kali hiđroxit', ions: { 'K+': 1, 'OH-': 1 } },
  NH3: { name: 'amoniac', ions: { NH3: 1 } },
  NaCl: { name: 'natri clorua', ions: { 'Na+': 1, 'Cl-': 1 } },
  KCl: { name: 'kali clorua', ions: { 'K+': 1, 'Cl-': 1 } },
  KI: { name: 'kali iođua', ions: { 'K+': 1, 'I-': 1 } },
  NaNO3: { name: 'natri nitrat', ions: { 'Na+': 1, 'NO3-': 1 } },
  AgNO3: { name: 'bạc nitrat', ions: { 'Ag+': 1, 'NO3-': 1 } },
  CuSO4: { name: 'đồng(II) sunfat', ions: { 'Cu^2+': 1, 'SO4^2-': 1 } },
  FeSO4: { name: 'sắt(II) sunfat', ions: { 'Fe^2+': 1, 'SO4^2-': 1 } },
  FeCl3: { name: 'sắt(III) clorua', ions: { 'Fe^3+': 1, 'Cl-': 3 } },
  MgCl2: { name: 'magie clorua', ions: { 'Mg^2+': 1, 'Cl-': 2 } },
  CaCl2: { name: 'canxi clorua', ions: { 'Ca^2+': 1, 'Cl-': 2 } },
  BaCl2: { name: 'bari clorua', ions: { 'Ba^2+': 1, 'Cl-': 2 } },
  Na2SO4: { name: 'natri sunfat', ions: { 'Na+': 2, 'SO4^2-': 1 } },
  Na2CO3: { name: 'natri cacbonat', ions: { 'Na+': 2, 'CO3^2-': 1 } },
  NaHCO3: { name: 'natri hiđrocacbonat', ions: { 'Na+': 1, 'HCO3-': 1 } },
  CH3COONa: { name: 'natri axetat', ions: { 'Na+': 1, 'CH3COO-': 1 } },
  NH4Cl: { name: 'amoni clorua', ions: { 'NH4+': 1, 'Cl-': 1 } },
  'Pb(NO3)2': { name: 'chì(II) nitrat', ions: { 'Pb^2+': 1, 'NO3-': 2 } },
  H2O2: { name: 'hiđro peoxit', ions: { H2O2: 1 } },
  phenolphthalein: { name: 'phenolphtalein', ions: { phenolphthalein: 1 } },
  'methyl orange': { name: 'metyl da cam', ions: { 'methyl orange': 1 } },
};

/**
 * Pha dung dịch: { HCl: 0.1 } nghĩa là HCl 0,1 M.
 * Dung dịch trong lọ đã ở trạng thái cân bằng, ở nhiệt độ phòng.
 */
export function makeSolution(solutes: Record<string, number>, volumeL: number, tempK = T25): Mixture {
  const m = new Mixture();
  m.volumeL = volumeL;
  m.tempK = tempK;
  m.set('H2O', volumeL * WATER_PER_L);
  for (const [name, molarity] of Object.entries(solutes)) {
    const c = COMPOUNDS[name];
    if (!c) throw new Error(`Chưa có hóa chất "${name}" trong COMPOUNDS`);
    for (const [id, nu] of Object.entries(c.ions)) m.add(id, nu * molarity * volumeL);
  }
  const a0 = hydrogenAtoms(m);
  equilibrate(m);
  m.add('H2O', (a0 - hydrogenAtoms(m)) / 2);
  return m;
}

/** Nước cất */
export function water(volumeL: number, tempK = T25): Mixture {
  return makeSolution({}, volumeL, tempK);
}

/** Vài giọt chất chỉ thị (1 giọt ≈ 0,05 mL dung dịch 1%) */
export function indicatorDrops(name: 'phenolphthalein' | 'methyl orange', drops = 2): Mixture {
  const molarity = 10 / species(name).molarMass; // 1% ≈ 10 g/L
  return makeSolution({ [name]: molarity }, drops * 5e-5);
}

export function gramsToMol(id: string, grams: number): number {
  return grams / species(id).molarMass;
}
