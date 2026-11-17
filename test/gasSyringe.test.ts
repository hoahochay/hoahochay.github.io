/** Xi lanh đo khí: 0,04 g Mg + 50 mL HCl 1 M cho khoảng 40 mL H2 */
import { describe, expect, it } from 'vitest';
import { GasSyringe, Vessel, VESSELS } from '../src';

function mgRun(seconds: number) {
  const flask = new Vessel(VESSELS.flask100);
  flask.addSolution({ HCl: 1 }, 0.05);
  const T0 = flask.mix.tempK;
  flask.addSolid('Mg', 0.04 / 24.305, 'strip');
  const syr = new GasSyringe(100);
  flask.outlet = syr;
  const readings: number[] = [];
  let Tmax = T0;
  for (let t = 0; t < seconds; t += 0.05) {
    flask.step(0.05);
    Tmax = Math.max(Tmax, flask.mix.tempK);
    if (Math.abs(t / 10 - Math.round(t / 10)) < 0.024) readings.push(syr.volumeML);
  }
  return { syr, readings, dT: Tmax - T0 };
}

describe('Xi lanh đo khí', () => {
  it('3 cm Mg (0,04 g) + 50 mL HCl 1M cho khoảng 40 mL khí', () => {
    const { syr } = mgRun(240);
    expect(syr.volumeML).toBeGreaterThan(36);
    expect(syr.volumeML).toBeLessThan(44);
    // Khí đẩy sang là hỗn hợp: không khí trong bình đi trước, H2 trộn dần vào
    expect(syr.fractions().H2).toBeGreaterThan(0.15);
  });

  it('đồ thị dốc nhất lúc đầu rồi nằm ngang', () => {
    const { readings } = mgRun(240);
    const d = readings.slice(1).map((v, i) => v - readings[i]);
    expect(d[0]).toBeGreaterThan(d[3]);
    expect(d[3]).toBeGreaterThan(d[8] - 1e-9);
    expect(d[d.length - 1]).toBeLessThan(0.1);
  });

  it('nhiệt độ chỉ tăng vài độ', () => {
    const { dT } = mgRun(240);
    expect(dT).toBeGreaterThan(1.5);
    expect(dT).toBeLessThan(5);
  });

  it('pít-tông dừng ở vạch cuối, khí thừa rò ra', () => {
    const s = new GasSyringe(100);
    s.receiveGas(new Map([['H2', 0.006]]), 0.006);
    expect(s.volumeML).toBeCloseTo(100, 6);
    expect(s.leakedMol).toBeGreaterThan(0);
    s.reset();
    expect(s.volumeML).toBe(0);
  });
});
