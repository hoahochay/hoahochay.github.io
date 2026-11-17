import { describe, expect, it } from 'vitest';
import { collectTotals, constantsAt, chargeBalance, makeSolution, Vessel, VESSELS } from '../src';

const pHof = (solutes: Record<string, number>) => -Math.log10(makeSolution(solutes, 0.01).h);

describe('pH của dung dịch', () => {
  it.each([
    ['nước cất', {}, 7.0],
    ['HCl 0,01M', { HCl: 0.01 }, 2.0],
    ['NaOH 0,01M', { NaOH: 0.01 }, 12.0],
    ['CH3COOH 0,1M', { CH3COOH: 0.1 }, 2.88],
    ['NH3 0,1M', { NH3: 0.1 }, 11.12],
    ['Na2CO3 0,1M', { Na2CO3: 0.1 }, 11.66],
    ['đệm axetat 0,1M/0,1M', { CH3COOH: 0.1, CH3COONa: 0.1 }, 4.76],
    ['H2SO4 0,05M (nấc 2 là axit yếu)', { H2SO4: 0.05 }, 1.24],
  ])('%s', (_name, solutes, expected) => {
    expect(pHof(solutes)).toBeCloseTo(expected, 1);
  });

  it('FeCl3 có tính axit do thủy phân, không tự kết tủa', () => {
    const m = makeSolution({ FeCl3: 0.1 }, 0.01);
    expect(-Math.log10(m.h)).toBeLessThan(2.2);
    expect(m.get('Fe(OH)3')).toBe(0);
  });

  it('CuSO4 có tính axit nhẹ (pH ≈ 4) và không tự kết tủa Cu(OH)2', () => {
    for (const c of [0.1, 0.5]) {
      const m = makeSolution({ CuSO4: c }, 0.01);
      expect(-Math.log10(m.h)).toBeCloseTo(4.0, 0);
      expect(m.get('Cu(OH)2')).toBe(0);
    }
  });

  it('sau cân bằng, dung dịch trung hòa điện', () => {
    const m = makeSolution({ CuSO4: 0.1, NaHCO3: 0.05, NH4Cl: 0.02 }, 0.01);
    const K = constantsAt(m.tempK);
    expect(Math.abs(chargeBalance(Math.log10(m.h), collectTotals(m), K))).toBeLessThan(1e-9);
  });

  it('Kw tăng theo nhiệt độ (nước sôi có pH ≈ 6,1)', () => {
    expect(-Math.log10(constantsAt(373.15).Kw)).toBeCloseTo(12.2, 0);
  });
});

describe('Chuẩn độ', () => {
  function titrate(acid: Record<string, number>, mLBase: number) {
    const v = new Vessel(VESSELS.beaker100);
    v.addSolution(acid, 0.01);
    if (mLBase > 0) v.addSolution({ NaOH: 0.1 }, mLBase / 1000);
    return v.observe().pH;
  }

  it('HCl 0,1M bằng NaOH 0,1M: bước nhảy pH tại điểm tương đương', () => {
    expect(titrate({ HCl: 0.1 }, 0)).toBeCloseTo(1.0, 2);
    expect(titrate({ HCl: 0.1 }, 5)).toBeCloseTo(1.48, 1);
    expect(titrate({ HCl: 0.1 }, 9.9)).toBeCloseTo(3.3, 1);
    expect(titrate({ HCl: 0.1 }, 10)).toBeCloseTo(7.0, 1);
    expect(titrate({ HCl: 0.1 }, 10.1)).toBeCloseTo(10.7, 1);
  });

  it('CH3COOH 0,1M: pH = pKa ở nửa điểm tương đương, pH > 7 ở điểm tương đương', () => {
    expect(titrate({ CH3COOH: 0.1 }, 5)).toBeCloseTo(4.76, 1);
    expect(titrate({ CH3COOH: 0.1 }, 10)).toBeCloseTo(8.72, 1);
  });

  it('phenolphtalein: không màu trong axit, hồng trong bazơ', () => {
    const acid = new Vessel().addSolution({ HCl: 0.01, phenolphthalein: 3e-4 }, 0.01).observe();
    const base = new Vessel().addSolution({ NaOH: 0.01, phenolphthalein: 3e-4 }, 0.01).observe();
    const [r1, g1, b1] = acid.solutionColor;
    const [r2, g2] = base.solutionColor;
    expect(Math.min(r1, g1, b1)).toBeGreaterThan(0.95);
    expect(r2).toBeGreaterThan(0.5);
    expect(g2).toBeLessThan(0.1); // hấp thụ xanh lá → nhìn thấy màu hồng
  });
});

describe('Kết tủa (Ksp)', () => {
  it('AgNO3 + NaCl → AgCl↓, [Ag+] còn lại = √Ksp', () => {
    const v = new Vessel();
    v.addSolution({ AgNO3: 0.1 }, 0.005).addSolution({ NaCl: 0.1 }, 0.005);
    expect(v.mix.get('AgCl')).toBeCloseTo(5e-4, 6);
    expect(v.mix.conc('Ag+')).toBeCloseTo(Math.sqrt(1.77e-10), 7);
    const o = v.observe();
    expect(o.turbidity).toBeGreaterThan(0.9);
  });

  it('CuSO4 + NaOH → Cu(OH)2↓ xanh lơ, dung dịch mất màu xanh', () => {
    const v = new Vessel();
    v.addSolution({ CuSO4: 0.1 }, 0.005);
    const before = v.observe().solutionColor;
    v.addSolution({ NaOH: 0.1 }, 0.01);
    expect(v.mix.get('Cu(OH)2')).toBeCloseTo(5e-4, 5);
    const after = v.observe().solutionColor;
    expect(after[0]).toBeGreaterThan(before[0] + 0.3); // bớt hấp thụ đỏ → bớt xanh
  });

  it('BaCl2 + H2SO4 → BaSO4↓ trắng', () => {
    const v = new Vessel();
    v.addSolution({ BaCl2: 0.1 }, 0.005).addSolution({ H2SO4: 0.1 }, 0.005);
    expect(v.mix.get('BaSO4')).toBeGreaterThan(4.9e-4);
  });

  it('FeCl3 + NaOH → Fe(OH)3↓ nâu đỏ', () => {
    const v = new Vessel();
    v.addSolution({ FeCl3: 0.1 }, 0.005).addSolution({ NaOH: 0.3 }, 0.005);
    expect(v.mix.get('Fe(OH)3')).toBeGreaterThan(4.9e-4);
  });

  it('kết tủa lắng dần, khuấy thì lơ lửng trở lại', () => {
    const v = new Vessel();
    v.addSolution({ AgNO3: 0.1 }, 0.005).addSolution({ NaCl: 0.1 }, 0.005);
    const t0 = v.observe().turbidity;
    v.run(300);
    const settled = v.observe().turbidity;
    v.stir();
    expect(settled).toBeLessThan(t0 * 0.5);
    expect(v.observe().turbidity).toBeCloseTo(t0, 5);
  });

  it('"mưa vàng": PbI2 tan khi đun nóng, kết tinh lại khi nguội', () => {
    const v = new Vessel();
    v.addSolution({ 'Pb(NO3)2': 0.01 }, 0.01).addSolution({ KI: 0.02 }, 0.01);
    const cold = v.mix.get('PbI2');
    expect(cold).toBeGreaterThan(5e-5);
    v.heaterW = 50;
    v.runUntil((x) => x.mix.tempK > 363, 600);
    expect(v.mix.get('PbI2')).toBeLessThan(cold * 0.05);
    v.heaterW = 0;
    v.runUntil((x) => x.mix.tempK < 308, 3000);
    expect(v.mix.get('PbI2')).toBeGreaterThan(cold * 0.7);
  });
});
