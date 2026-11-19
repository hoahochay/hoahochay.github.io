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
  HCl: { name: 'hydrochloric acid', ions: { 'H+': 1, 'Cl-': 1 } },
  HNO3: { name: 'nitric acid', ions: { 'H+': 1, 'NO3-': 1 } },
  H2SO4: { name: 'sulfuric acid', ions: { 'H+': 2, 'SO4^2-': 1 } },
  CH3COOH: { name: 'acetic acid', ions: { CH3COOH: 1 } },
  NaOH: { name: 'sodium hydroxide', ions: { 'Na+': 1, 'OH-': 1 } },
  KOH: { name: 'potassium hydroxide', ions: { 'K+': 1, 'OH-': 1 } },
  NH3: { name: 'ammonia', ions: { NH3: 1 } },
  NaCl: { name: 'sodium chloride', ions: { 'Na+': 1, 'Cl-': 1 } },
  KCl: { name: 'potassium chloride', ions: { 'K+': 1, 'Cl-': 1 } },
  KI: { name: 'potassium iodide', ions: { 'K+': 1, 'I-': 1 } },
  NaF: { name: 'sodium fluoride', ions: { 'Na+': 1, 'F-': 1 } },
  NaBr: { name: 'sodium bromide', ions: { 'Na+': 1, 'Br-': 1 } },
  NaI: { name: 'sodium iodide', ions: { 'Na+': 1, 'I-': 1 } },
  Na2S2O3: { name: 'sodium thiosulfate', ions: { 'Na+': 2, 'S2O3^2-': 1 } },
  NaNO3: { name: 'sodium nitrate', ions: { 'Na+': 1, 'NO3-': 1 } },
  AgNO3: { name: 'silver nitrate', ions: { 'Ag+': 1, 'NO3-': 1 } },
  CuSO4: { name: 'copper(II) sulfate', ions: { 'Cu^2+': 1, 'SO4^2-': 1 } },
  FeSO4: { name: 'iron(II) sulfate', ions: { 'Fe^2+': 1, 'SO4^2-': 1 } },
  FeCl3: { name: 'iron(III) chloride', ions: { 'Fe^3+': 1, 'Cl-': 3 } },
  MgCl2: { name: 'magnesium chloride', ions: { 'Mg^2+': 1, 'Cl-': 2 } },
  CaCl2: { name: 'calcium chloride', ions: { 'Ca^2+': 1, 'Cl-': 2 } },
  'Ca(NO3)2': { name: 'calcium nitrate', ions: { 'Ca^2+': 1, 'NO3-': 2 } },
  'Ca(OH)2': { name: 'nước vôi trong', ions: { 'Ca^2+': 1, 'OH-': 2 } },
  BaCl2: { name: 'barium chloride', ions: { 'Ba^2+': 1, 'Cl-': 2 } },
  Na2SO4: { name: 'sodium sulfate', ions: { 'Na+': 2, 'SO4^2-': 1 } },
  AlCl3: { name: 'aluminium chloride', ions: { 'Al^3+': 1, 'Cl-': 3 } },
  C2H5OH: { name: 'ethanol', ions: { C2H5OH: 1 } },
  C6H5OH: { name: 'phenol', ions: { C6H5OH: 1 } },
  CH3CHO: { name: 'acetaldehyde', ions: { CH3CHO: 1 } },
  glycerol: { name: 'glycerol', ions: { glycerol: 1 } },
  Na2CO3: { name: 'sodium carbonate', ions: { 'Na+': 2, 'CO3^2-': 1 } },
  NaHCO3: { name: 'sodium hydrogencarbonate', ions: { 'Na+': 1, 'HCO3-': 1 } },
  CH3COONa: { name: 'sodium acetate', ions: { 'Na+': 1, 'CH3COO-': 1 } },
  NH4Cl: { name: 'ammonium chloride', ions: { 'NH4+': 1, 'Cl-': 1 } },
  'Pb(NO3)2': { name: 'lead(II) nitrate', ions: { 'Pb^2+': 1, 'NO3-': 2 } },
  H2O2: { name: 'hydrogen peroxide', ions: { H2O2: 1 } },
  Cl2: { name: 'nước chlorine', ions: { Cl2: 1 } },
  Br2: { name: 'nước bromine', ions: { Br2: 1 } },
  I2: { name: 'iodine', ions: { I2: 1 } },
  starch: { name: 'hồ tinh bột', ions: { amylose: 1 } },
  H3Cit: { name: 'citric acid', ions: { H3Cit: 1 } },
  H2CO3: { name: 'carbonic acid', ions: { H2CO3: 1 } },
  phenolphthalein: { name: 'phenolphthalein', ions: { phenolphthalein: 1 } },
  anthocyanin: { name: 'anthocyanin', ions: { anthocyanin: 1 } },
  'methyl orange': { name: 'methyl orange', ions: { 'methyl orange': 1 } },
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
export function indicatorDrops(name: 'phenolphthalein' | 'methyl orange' | 'anthocyanin', drops = 2): Mixture {
  const molarity = 10 / species(name).molarMass; // 1% ≈ 10 g/L
  return makeSolution({ [name]: molarity }, drops * 5e-5);
}

export function gramsToMol(id: string, grams: number): number {
  return grams / species(id).molarMass;
}

