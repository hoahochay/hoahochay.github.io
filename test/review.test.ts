/** Hồi quy cho các lỗi tìm thấy khi rà soát mã (11/2026) */
import { describe, expect, it } from 'vitest';
import { atmosphere, litmusPH, litmusVerdict, makeOrganic, makeSolution, Vessel, VESSELS } from '../src';
import { liquidHeatCapacity } from '../src/thermo';
import { parseHash } from '../web/router';
import { CHEMICALS } from '../web/catalog';
import { chemicalsFor, elementsOf } from '../web/periodic/labLinks';

describe('Phản ứng cần nước', () => {
  it('Na, K, CaC₂ trong ống khô không phản ứng', () => {
    for (const id of ['Na', 'K', 'Li', 'CaC2']) {
      const v = new Vessel(VESSELS.testTube);
      v.addSolid(id, 0.01, 'granule');
      v.run(10);
      expect(v.mix.get(id)).toBeCloseTo(0.01, 6);
      expect(v.mix.tempK).toBeCloseTo(298.15, 0);
    }
  });
  it('Na trong hexane không phản ứng', () => {
    const v = new Vessel(VESSELS.testTube);
    v.add(makeOrganic('C6H14', 0.003));
    v.addSolid('Na', 0.01, 'granule');
    v.run(10);
    expect(v.mix.get('Na')).toBeCloseTo(0.01, 6);
  });
  it('dư Na: chỉ phản ứng hết lượng nước có sẵn', () => {
    const v = new Vessel(VESSELS.testTube);
    v.add(makeSolution({}, 0.00005));
    const water = v.mix.get('H2O');
    v.addSolid('Na', 0.01, 'granule');
    v.run(30);
    expect(0.01 - v.mix.get('Na')).toBeLessThanOrEqual(water * 1.001);
    expect(v.mix.get('H2O')).toBeGreaterThanOrEqual(0);
  });
  it('xà phòng khô không phân li', () => {
    const v = new Vessel(VESSELS.testTube);
    v.mix.set('soap', 0.001);
    v.run(5);
    expect(v.mix.get('oleate')).toBe(0);
  });
});

describe('Nhiệt, khí, chất rắn', () => {
  it('giấy quỳ ẩm không hóa đỏ với không khí nóng', () => {
    const v = new Vessel(VESSELS.testTube);
    v.addSolid('Cu', 0.01, 'granule');
    v.mix.tempK = 673;
    expect(litmusVerdict(litmusPH(v))).not.toBe('acid');
  });
  it('phần mol khí trong ống NO₂ nút kín không vượt 1', () => {
    const v = new Vessel(VESSELS.testTube);
    v.fillNO2();
    v.mix.tempK = 353;
    const a = atmosphere(v);
    expect(a.air).toBeGreaterThanOrEqual(0);
    expect(Object.entries(a).filter(([k]) => k !== 'air').reduce((s, [, x]) => s + x, 0)).toBeLessThanOrEqual(1 + 1e-9);
  });
  it('ethanol có nhiệt dung; cốc xốp không bị NaN', () => {
    const v = new Vessel(VESSELS.foamCup);
    v.add(makeSolution({ C2H5OH: 17.2 }, 0.01));
    expect(liquidHeatCapacity(v.mix)).toBeGreaterThan(15);
    v.run(1);
    expect(Number.isFinite(v.mix.tempK)).toBe(true);
  });
  it('kết tủa tạo lại sau khi viên rắn tan hết là kết tủa mịn', () => {
    const v = new Vessel(VESSELS.testTube);
    v.add(makeSolution({ HCl: 1 }, 0.005));
    v.addSolid('CaCO3', 0.001, 'granule');
    v.run(300);
    expect(v.mix.get('CaCO3')).toBe(0);
    v.add(makeSolution({ Na2CO3: 1 }, 0.005));
    v.run(1);
    expect(v.mix.formFactor.get('CaCO3')).toBeGreaterThan(1000);
  });
  it('bỏ chất rắn vào không làm mất kết tủa đang lơ lửng', () => {
    const v = new Vessel(VESSELS.testTube);
    v.add(makeSolution({ CaCl2: 0.1 }, 0.003));
    v.add(makeSolution({ Na2CO3: 0.1 }, 0.003));
    expect(v.mix.suspended.get('CaCO3') ?? 0).toBeGreaterThan(0.9);
    v.addSolid('CaCO3', 0.0003, 'granule');
    expect(v.mix.suspended.get('CaCO3') ?? 0).toBeGreaterThan(0.3);
  });
});

describe('Giao diện', () => {
  it('link có dấu % lẻ không làm hỏng ứng dụng', () => {
    expect(() => parseHash('#/thi-nghiem/%')).not.toThrow();
    expect(parseHash('#/thi-nghiem/%').view).toBe('lab');
  });
  it('bảng tuần hoàn: chất hữu cơ có C, H; citric acid không sinh ra nguyên tố lạ', () => {
    const keys = chemicalsFor('C').map((e) => e.key);
    for (const k of ['hexane', 'ethyl_acetate', 'dau_an', 'glucose_2', 'egg_white', 'lemon', 'bong']) expect(keys).toContain(k);
    expect(chemicalsFor('N').map((e) => e.key)).toContain('egg_white');
    for (const e of CHEMICALS) for (const s of elementsOf(e)) expect(['Ci', 'Vi']).not.toContain(s);
  });
});
