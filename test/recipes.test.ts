/**
 * Chạy từng thí nghiệm mẫu trực tiếp trên engine (không cần trình duyệt) để chắc chắn
 * kịch bản hợp lệ và hiện tượng xảy ra đúng như phần kết luận mô tả.
 */
import { describe, expect, it } from 'vitest';
import { indicatorDrops, litmusPH, litmusVerdict, makeSolution, testBurningSplint, testGlowingSplint, Vessel, VESSELS } from '../src';
import { CHEMICALS, solidMol } from '../web/catalog';
import { BEAKER, LabState, Recipe, RECIPES } from '../web/recipes';

interface RunResult {
  vessels: Vessel[];
  /** Các bước `wait` có `until` nhưng hết giờ mà điều kiện chưa đạt */
  timedOut: number[];
  /** Kết quả các lần thử khí, theo thứ tự */
  probes: string[];
}

function runRecipe(r: Recipe): RunResult {
  const vessels = [0, 1, 2, 3].map(() => new Vessel(VESSELS.testTube));
  vessels.push(new Vessel(VESSELS.beaker100));
  const state: LabState = {
    mix: (i) => vessels[i].mix,
    tempC: (i) => vessels[i].mix.tempK - 273.15,
  };
  const timedOut: number[] = [];
  const probes: string[] = [];
  /** Chạy mô phỏng thêm một khoảng (như lúc dụng cụ thử đang được đưa vào) */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) for (const v of vessels) v.step(0.05);
  };
  r.steps.forEach((s, idx) => {
    switch (s.kind) {
      case 'add': {
        const c = CHEMICALS.find((x) => x.key === s.chem);
        if (!c) throw new Error(`${r.id}: không có hóa chất "${s.chem}"`);
        const v = vessels[s.vessel];
        if (c.solid) v.addSolid(c.solid.id, solidMol(c.solid, s.amount), c.solid.form);
        else if (c.reagent!.indicator) v.add(indicatorDrops(c.reagent!.indicator, s.amount));
        else v.add(makeSolution(c.reagent!.solutes, s.amount / 1000, v.roomK));
        expect(v.mix.volumeL * 1000, `${r.id}: tràn ${s.vessel}`).toBeLessThanOrEqual(v.spec.capacityL * 1000);
        break;
      }
      case 'wait': {
        const speed = s.speed ?? 1;
        const dt = Math.min(0.05 * speed, 0.5);
        let t = 0;
        let met = false;
        while (t < s.seconds) {
          if (s.until?.(state)) { met = true; break; }
          for (const v of vessels) v.step(dt);
          t += dt;
        }
        if (s.until && !met && !s.until(state)) timedOut.push(idx);
        break;
      }
      case 'heat':
        vessels[s.vessel].heaterW = s.on ? (s.vessel === BEAKER ? 60 : 35) : 0;
        break;
      case 'stir':
        vessels[s.vessel].stir();
        break;
      case 'connect':
        if (s.dst !== null) vessels[s.src].outlet = vessels[s.dst];
        else vessels[s.src].outlet = null;
        break;
      case 'invert':
        vessels[s.vessel].inverted = !vessels[s.vessel].inverted;
        break;
      case 'probe': {
        const v = vessels[s.vessel];
        run(1.2); // thời gian đưa que / giấy tới miệng ống
        if (s.tool === 'glowing') probes.push(testGlowingSplint(v));
        else if (s.tool === 'burning') probes.push(testBurningSplint(v));
        else {
          run(5);
          probes.push('litmus-' + litmusVerdict(litmusPH(v)));
        }
        break;
      }
    }
  });
  return { vessels, timedOut, probes };
}

describe('Thí nghiệm mẫu', () => {
  it('id không trùng nhau', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  for (const r of RECIPES) {
    it(`${r.title}: kịch bản chạy trọn vẹn`, () => {
      const res = runRecipe(r);
      expect(res.timedOut, 'điều kiện chờ không đạt').toEqual([]);
    });
  }

  const run = (id: string) => runRecipe(RECIPES.find((r) => r.id === id)!).vessels;

  it('Mg + HCl: Mg tan hết, thoát H2, nóng lên', () => {
    const [t1] = run('mg-hcl');
    expect(t1.mix.get('Mg')).toBeLessThan(1e-5);
    expect(t1.gasTotal.get('H2')).toBeGreaterThan(0);
  });

  it('trung hòa: kết thúc ở pH ≈ 7, dung dịch không màu', () => {
    const v = run('neutralization')[BEAKER];
    const o = v.observe();
    expect(o.pH).toBeGreaterThan(6);
    expect(o.pH).toBeLessThan(8.2);
    expect(Math.min(...o.solutionColor)).toBeGreaterThan(0.9);
  });

  it('trung hòa: vẫn hồng ngay trước giọt cuối', () => {
    const r = RECIPES.find((x) => x.id === 'neutralization')!;
    const lastAdd = r.steps.map((s) => s.kind).lastIndexOf('add');
    const v = runRecipe({ ...r, steps: r.steps.slice(0, lastAdd) }).vessels[BEAKER];
    expect(v.observe().solutionColor[1]).toBeLessThan(0.6);
  });

  it('Cu(OH)2: kết tủa rồi tan hết trong HCl', () => {
    expect(run('cuoh2')[1].mix.get('Cu(OH)2')).toBe(0);
  });

  it('sắt đẩy đồng: có Cu bám trên đinh', () => {
    expect(run('fe-cu')[2].mix.get('Cu')).toBeGreaterThan(1e-4);
  });

  it('Na + nước: dung dịch hồng, pH > 12', () => {
    const o = run('na-water')[BEAKER].observe();
    expect(o.pH).toBeGreaterThan(12);
    expect(o.solutionColor[1]).toBeLessThan(0.6);
  });

  it('H2O2: chỉ ống có MnO2 sinh nhiều O2', () => {
    const [t1, t2] = run('h2o2');
    expect(t2.gasTotal.get('O2') ?? 0).toBeGreaterThan(1e-3);
    expect(t1.gasTotal.get('O2') ?? 0).toBeLessThan(1e-6);
  });

  it('mưa vàng: PbI2 kết tinh lại sau khi nguội', () => {
    expect(run('golden-rain')[3].mix.get('PbI2')).toBeGreaterThan(3e-5);
  });

  it('nhận biết Cl-, SO4 2-, Fe3+: có kết tủa đặc trưng', () => {
    expect(run('chloride-test')[0].mix.get('AgCl')).toBeGreaterThan(0);
    expect(run('sulfate-test')[1].mix.get('BaSO4')).toBeGreaterThan(0);
    expect(run('feoh3')[2].mix.get('Fe(OH)3')).toBeGreaterThan(0);
  });

  const probesOf = (id: string) => runRecipe(RECIPES.find((r) => r.id === id)!).probes;

  it('thử O2: không khí → không bùng cháy; ống có MnO2 → bùng cháy', () => {
    expect(probesOf('o2-test')).toEqual(['none', 'relight']);
  });

  it('thử H2: nổ "bụp" khi đang sủi bọt, hết hiện tượng khi H2 bay đi', () => {
    expect(probesOf('h2-test')).toEqual(['pop', 'normal']);
  });

  it('thử CO2: que đóm tắt, quỳ ẩm hóa đỏ', () => {
    expect(probesOf('co2-test')).toEqual(['extinguished', 'litmus-acid']);
  });

  it('thử NH3: nước cất không đổi màu quỳ, amoniac làm quỳ hóa xanh', () => {
    expect(probesOf('nh3-test')).toEqual(['litmus-neutral', 'litmus-base']);
  });

  it('CO2 vào nước vôi trong: vẩn đục rồi trong lại', () => {
    const r = RECIPES.find((x) => x.id === 'co2-limewater')!;
    const vs = runRecipe(r).vessels;
    expect(vs[1].mix.get('CaCO3')).toBeLessThan(1e-7);
    expect(vs[1].observe().pH).toBeLessThan(7);
  });

  it('thu H2: ống ngửa không còn H2, ống úp giữ được H2', () => {
    expect(probesOf('h2-collect')).toEqual(['normal', 'pop']);
  });

  it('đá vôi + HCl: thoát CO2', () => {
    expect(run('caco3-hcl')[0].gasTotal.get('CO2') ?? 0).toBeGreaterThan(1e-3);
  });
});
