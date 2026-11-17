import { describe, expect, it } from 'vitest';
import { atmosphere, gramsToMol, makeSolution, testBurningSplint, Vessel, VESSELS } from '../src';

const tube = () => new Vessel(VESSELS.testTube);
const stepAll = (vs: Vessel[], s: number) => {
  for (let t = 0; t < s; t += 0.05) for (const v of vs) v.step(0.05);
};
const co2Source = () => {
  const a = tube();
  a.add(makeSolution({ HCl: 1 }, 0.005)).addSolid('CaCO3', gramsToMol('CaCO3', 0.5), 'granule');
  return a;
};

describe('ống dẫn khí', () => {
  it('ống nút kín không để khí thoát ra phòng, mọi khí đi sang ống nhận', () => {
    const a = co2Source();
    const b = tube();
    a.outlet = b;
    stepAll([a, b], 30);
    expect(a.gasEscaped.get('CO2') ?? 0).toBe(0);
    expect(b.mix.headspace.get('CO2') ?? 0).toBeGreaterThan(0);
  });

  it('lúc đầu ống dẫn đẩy sang không khí, sau đó mới là khí sinh ra', () => {
    const a = co2Source();
    const b = tube();
    a.outlet = b;
    stepAll([a, b], 3);
    expect(atmosphere(b).CO2).toBeLessThan(0.05);
    stepAll([a, b], 40);
    expect(atmosphere(b).CO2).toBeGreaterThan(0.25);
  });

  it('CO2 sục vào nước vôi trong: vẩn đục, sục tiếp thì trong trở lại', () => {
    const a = co2Source();
    const b = tube();
    b.add(makeSolution({ 'Ca(OH)2': 0.005 }, 0.005));
    a.outlet = b;
    let maxTurb = 0;
    for (let t = 0; t < 20; t++) {
      stepAll([a, b], 1);
      maxTurb = Math.max(maxTurb, b.observe().turbidity);
    }
    expect(maxTurb).toBeGreaterThan(0.15);
    expect(b.mix.get('CaCO3')).toBeGreaterThan(0);
    stepAll([a, b], 100);
    expect(b.mix.get('CaCO3')).toBeLessThan(1e-7);
    expect(b.observe().pH).toBeLessThan(7);
  });

  it('khí H2 dẫn vào nước: không tan, bay lên khoảng khí', () => {
    const a = tube();
    a.add(makeSolution({ HCl: 1 }, 0.005)).addSolid('Mg', gramsToMol('Mg', 0.05), 'strip');
    const b = tube();
    b.add(makeSolution({}, 0.005));
    a.outlet = b;
    stepAll([a, b], 15);
    expect(b.observe().inletRateML).toBeGreaterThan(0.1);
    expect(b.mix.get('H2')).toBe(0);
    expect(atmosphere(b).H2).toBeGreaterThan(0.04);
  });

  it('thu H2: ống úp ngược giữ được khí, ống ngửa để khí bay mất', () => {
    const collect = (inverted: boolean) => {
      const a = tube();
      a.add(makeSolution({ HCl: 1 }, 0.005)).addSolid('Mg', gramsToMol('Mg', 0.05), 'strip');
      const b = tube();
      b.inverted = inverted;
      a.outlet = b;
      stepAll([a, b], 25);
      a.outlet = null;
      stepAll([a, b], 15);
      return b;
    };
    const up = collect(false);
    const down = collect(true);
    expect(atmosphere(down).H2).toBeGreaterThan(0.15);
    expect(atmosphere(up).H2).toBeLessThan(0.04);
    expect(testBurningSplint(down)).toBe('pop');
    expect(testBurningSplint(up)).toBe('normal');
  });

  it('ống úp ngược làm khí nặng (CO2) rơi ra nhanh hơn', () => {
    const keep = (inverted: boolean) => {
      const b = tube();
      b.inverted = inverted;
      b.mix.headspace.set('CO2', 0.0008);
      stepAll([b], 10);
      return b.mix.headspace.get('CO2') ?? 0;
    };
    expect(keep(true)).toBeLessThan(keep(false) * 0.75);
  });

  it('bảo toàn nguyên tố C khi sục CO2', () => {
    const a = co2Source();
    const b = tube();
    b.add(makeSolution({ 'Ca(OH)2': 0.005 }, 0.005));
    a.outlet = b;
    const C = (v: Vessel) =>
      ['CaCO3', 'H2CO3', 'HCO3-', 'CO3^2-'].reduce((s, id) => s + v.mix.get(id), 0) + (v.mix.headspace.get('CO2') ?? 0) + (v.gasEscaped.get('CO2') ?? 0);
    const c0 = C(a) + C(b);
    stepAll([a, b], 60);
    expect(C(a) + C(b)).toBeCloseTo(c0, 9);
  });
});
