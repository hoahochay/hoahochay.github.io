/** Cân điện tử: bảo toàn khối lượng (đối chiếu bài RSC "Mass changes in chemical reactions") */
import { describe, expect, it } from 'vitest';
import { makeSolution, Vessel, VESSELS } from '../src';

const run = (v: Vessel, s: number) => { for (let t = 0; t < s; t += 0.05) v.step(0.05); };

describe('Cân điện tử', () => {
  it('cân dụng cụ rỗng ra khối lượng thủy tinh', () => {
    expect(new Vessel(VESSELS.beaker100).massG()).toBeCloseTo(48, 6);
  });

  it('pha dung dịch: khối lượng tăng đúng bằng khối lượng dung dịch', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.add(makeSolution({ NaCl: 0.1 }, 0.02, v.roomK));
    // 20 mL dung dịch loãng ≈ 20 g
    expect(v.massG() - 48).toBeGreaterThan(19.5);
    expect(v.massG() - 48).toBeLessThan(20.6);
  });

  it('tạo kết tủa (Na2CO3 + Ca(NO3)2): khối lượng không đổi', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.add(makeSolution({ Na2CO3: 0.5 }, 0.01, v.roomK));
    const a = makeSolution({ 'Ca(NO3)2': 0.5 }, 0.01, v.roomK);
    const before = v.massG() + (new Vessel(VESSELS.beaker100).add(a).massG() - 48);
    v.add(a);
    run(v, 30);
    expect(v.mix.get('CaCO3')).toBeGreaterThan(4e-3);
    expect(Math.abs(v.massG() - before)).toBeLessThan(0.005);
  });

  it('đá vôi + HCl trong cốc hở: khối lượng giảm đúng bằng CO2 bay đi', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.add(makeSolution({ HCl: 1 }, 0.02, v.roomK));
    v.addSolid('CaCO3', 0.5 / 100.09);
    const m0 = v.massG();
    run(v, 600);
    const co2 = (v.gasEscaped.get('CO2') ?? 0) * 44.01;
    expect(co2).toBeGreaterThan(0.15);
    expect(m0 - v.massG()).toBeGreaterThan(0.15);
    // phần chênh nhỏ còn lại là CO2 còn trong dung dịch / khoảng khí
    expect(Math.abs(m0 - v.massG() - co2)).toBeLessThan(0.03);
  });
});
