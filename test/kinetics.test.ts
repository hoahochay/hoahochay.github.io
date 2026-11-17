import { describe, expect, it } from 'vitest';
import { gramsToMol, hydrogenAtoms, indicatorDrops, Vessel, VESSELS } from '../src';

function mgInAcid(form: 'strip' | 'powder', molarity = 1) {
  const v = new Vessel();
  v.addSolution({ HCl: molarity }, 0.01);
  v.addSolid('Mg', gramsToMol('Mg', 0.05), form);
  return v;
}

/** Thời gian (s) để một nửa lượng chất rắn phản ứng */
function halfLife(v: Vessel, id: string, max = 3600) {
  const n0 = v.mix.get(id);
  v.runUntil((x) => x.mix.get(id) < n0 / 2, max);
  return v.time;
}

describe('Kim loại + axit', () => {
  it('Mg + HCl: thoát H2 đúng tỉ lệ mol, dung dịch nóng lên', () => {
    const v = mgInAcid('strip');
    const nMg = v.mix.get('Mg');
    v.run(150);
    const o = v.observe();
    expect(v.mix.get('Mg')).toBeLessThan(nMg * 0.01);
    expect(o.gasTotalMol.H2).toBeCloseTo(nMg, 5);
    expect(o.dissolved['Mg^2+'] * 0.01).toBeCloseTo(nMg, 5);
  });

  it('Mg + HCl tỏa nhiệt: nhiệt độ tăng > 10°C', () => {
    const v = mgInAcid('strip');
    let maxT = 0;
    v.run(120, { every: 1, onTick: (o) => (maxT = Math.max(maxT, o.tempC)) });
    expect(maxT).toBeGreaterThan(35);
  });

  it('dải Mg tan trong khoảng 15–60 s (nửa lượng)', () => {
    const t = halfLife(mgInAcid('strip'), 'Mg');
    expect(t).toBeGreaterThan(15);
    expect(t).toBeLessThan(60);
  });

  it('bột Mg phản ứng nhanh hơn dải Mg (diện tích bề mặt)', () => {
    expect(halfLife(mgInAcid('powder'), 'Mg')).toBeLessThan(halfLife(mgInAcid('strip'), 'Mg') / 5);
  });

  it('axit loãng hơn → phản ứng chậm hơn (nồng độ)', () => {
    expect(halfLife(mgInAcid('strip', 0.5), 'Mg')).toBeGreaterThan(halfLife(mgInAcid('strip', 1), 'Mg') * 1.5);
  });

  it('đun nóng → phản ứng nhanh hơn (nhiệt độ)', () => {
    const cold = new Vessel();
    cold.addSolution({ HCl: 1 }, 0.01).addSolid('Zn', gramsToMol('Zn', 0.5), 'granule');
    const hot = new Vessel();
    hot.addSolution({ HCl: 1 }, 0.01);
    hot.mix.tempK = 333.15;
    hot.addSolid('Zn', gramsToMol('Zn', 0.5), 'granule');
    cold.run(30);
    hot.run(30);
    expect(hot.gasTotal.get('H2')!).toBeGreaterThan(cold.gasTotal.get('H2')! * 3);
  });

  it('axit yếu (CH3COOH) phản ứng chậm hơn axit mạnh cùng nồng độ', () => {
    const strong = mgInAcid('strip', 0.5);
    const weak = new Vessel();
    weak.addSolution({ CH3COOH: 0.5 }, 0.01).addSolid('Mg', gramsToMol('Mg', 0.05), 'strip');
    strong.run(20);
    weak.run(20);
    expect(weak.gasTotal.get('H2')!).toBeLessThan(strong.gasTotal.get('H2')! / 3);
  });
});

describe('Kim loại đẩy kim loại', () => {
  it('đinh sắt trong CuSO4: đồng bám lên đinh, dung dịch nhạt màu dần', () => {
    const v = new Vessel();
    v.addSolution({ CuSO4: 0.5 }, 0.01).addSolid('Fe', gramsToMol('Fe', 2), 'strip');
    const c0 = v.mix.conc('Cu^2+') + v.mix.conc('CuOH+');
    v.run(600, { dt: 0.5 });
    expect(v.mix.get('Cu')).toBeGreaterThan(1e-5);
    expect(v.observe().dissolved['Fe^2+']).toBeGreaterThan(0);
    expect(v.mix.conc('Cu^2+') + v.mix.conc('CuOH+')).toBeLessThan(c0);
  });

  it('dây đồng trong AgNO3 tạo bạc ("cây bạc")', () => {
    const v = new Vessel();
    v.addSolution({ AgNO3: 0.1 }, 0.01).addSolid('Cu', gramsToMol('Cu', 1), 'strip');
    v.run(300, { dt: 0.5 });
    expect(v.mix.get('Ag')).toBeGreaterThan(1e-5);
    // tỉ lệ 2 Ag : 1 Cu²⁺
    const cu2 = (v.mix.get('Cu^2+') + v.mix.get('CuOH+'));
    expect(v.mix.get('Ag') / cu2).toBeCloseTo(2, 3);
  });
});

describe('Các phản ứng khác', () => {
  it('Na + nước (có phenolphtalein): dung dịch hóa hồng, nóng lên, thoát H2', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.addSolution({}, 0.05).add(indicatorDrops('phenolphthalein'));
    v.addSolid('Na', gramsToMol('Na', 0.1), 'granule');
    v.run(30);
    const o = v.observe();
    expect(v.mix.get('Na')).toBe(0);
    expect(o.pH).toBeGreaterThan(12.5);
    expect(o.gasTotalMol.H2).toBeCloseTo(gramsToMol('Na', 0.1) / 2, 6);
    expect(o.solutionColor[1]).toBeLessThan(0.5); // hồng
  });

  it('H2O2 phân hủy nhanh với MnO2, gần như không đổi khi không có xúc tác', () => {
    const cat = new Vessel();
    cat.addSolution({ H2O2: 0.88 }, 0.01).addSolid('MnO2', 0.001, 'powder');
    const none = new Vessel();
    none.addSolution({ H2O2: 0.88 }, 0.01);
    cat.run(120);
    none.run(120);
    expect(cat.mix.conc('H2O2')).toBeLessThan(0.088);
    expect(none.mix.conc('H2O2')).toBeGreaterThan(0.87);
    expect(cat.mix.get('MnO2')).toBeCloseTo(0.001, 9); // xúc tác không bị tiêu hao
  });

  it('CaCO3 + HCl: sủi bọt CO2; CaCO3 trong nước thì không', () => {
    const acid = new Vessel();
    acid.addSolution({ HCl: 1 }, 0.01).addSolid('CaCO3', gramsToMol('CaCO3', 0.5), 'granule');
    const water = new Vessel();
    water.addSolution({}, 0.01).addSolid('CaCO3', gramsToMol('CaCO3', 0.5), 'granule');
    acid.run(300);
    water.run(300);
    expect(acid.gasTotal.get('CO2') ?? 0).toBeGreaterThan(1e-3);
    expect(water.gasTotal.get('CO2') ?? 0).toBe(0);
    expect(water.mix.get('CaCO3')).toBeGreaterThan(gramsToMol('CaCO3', 0.5) * 0.99);
  });

  it('NaHCO3 + HCl: sủi bọt ngay', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.addSolution({ NaHCO3: 1 }, 0.02).addSolution({ HCl: 1 }, 0.02);
    v.run(5);
    expect(v.observe().gasRateML.CO2).toBeGreaterThan(1);
  });
});

describe('Bảo toàn', () => {
  it('bảo toàn nguyên tố H (kể cả nước và khí đã thoát)', () => {
    const v = mgInAcid('strip');
    const total = () => hydrogenAtoms(v.mix) + 2 * v.mix.get('H2O') + 2 * (v.gasEscaped.get('H2') ?? 0);
    const a0 = total();
    v.run(60);
    expect(total()).toBeCloseTo(a0, 8);
  });

  it('nhiệt trung hòa: 50 mL HCl 1M + 50 mL NaOH 1M trong cốc xốp, ΔT ≈ 6,7°C', () => {
    const v = new Vessel(VESSELS.foamCup);
    v.addSolution({ HCl: 1 }, 0.05).addSolution({ NaOH: 1 }, 0.05);
    expect(v.observe().tempC - 25).toBeCloseTo(6.6, 0);
  });

  it('nhiệt nhận được = C·ΔT = 55,8 kJ/mol × số mol nước tạo thành', () => {
    const v = new Vessel(VESSELS.foamCup);
    v.addSolution({ HCl: 1 }, 0.05).addSolution({ NaOH: 1 }, 0.05);
    const q = v.heatCapacity() * (v.mix.tempK - 298.15);
    expect(q / 0.05).toBeCloseTo(55840, -2);
  });

  it('nóng dung dịch nguội dần về nhiệt độ phòng', () => {
    const v = new Vessel(VESSELS.beaker100);
    v.addSolution({}, 0.05);
    v.mix.tempK = 353.15;
    v.run(1800, { dt: 0.5 });
    expect(v.observe().tempC).toBeLessThan(45);
  });

  it('đun sôi: dừng ở 100°C và nước bay hơi', () => {
    const v = new Vessel();
    v.addSolution({ NaCl: 0.1 }, 0.01);
    v.heaterW = 60;
    v.run(240);
    const o = v.observe();
    expect(o.boiling).toBe(true);
    expect(o.tempC).toBeCloseTo(100, 1);
    expect(o.volumeML).toBeLessThan(10);
    expect(o.dissolved['Na+']).toBeGreaterThan(0.1);
  });
});
