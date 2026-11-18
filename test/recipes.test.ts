/**
 * Chạy từng thí nghiệm mẫu trực tiếp trên engine (không cần trình duyệt) để chắc chắn
 * kịch bản hợp lệ và hiện tượng xảy ra đúng như phần kết luận mô tả.
 */
import { describe, expect, it } from 'vitest';
import { contentsMassG, GasSyringe, indicatorDrops, litmusPH, litmusVerdict, makeSolution, testBurningSplint, testGlowingSplint, testMagnet, Vessel, VESSELS } from '../src';
import { CHEMICALS, solidMol } from '../web/catalog';
import { BEAKER, BOOKS, FLASK, LabState, LESSONS, PlayScript, RECIPES, SYRINGE } from '../web/recipes';

interface RunResult {
  vessels: Vessel[];
  /** Các bước `wait` có `until` nhưng hết giờ mà điều kiện chưa đạt */
  timedOut: number[];
  /** Kết quả các lần thử khí, theo thứ tự */
  probes: string[];
  syringe: GasSyringe;
  weighings: number[];
}

function runRecipe(r: PlayScript): RunResult {
  const vessels = [0, 1, 2, 3].map(() => new Vessel(VESSELS.testTube));
  vessels.push(new Vessel(VESSELS.beaker100), new Vessel(VESSELS.flask100));
  const syringe = new GasSyringe(100);
  let onBalance: number[] = [];
  /** Số đọc của cân sau mỗi bước, để kiểm tra kết quả */
  const weighings: number[] = [];
  const state: LabState = {
    mix: (i) => vessels[i].mix,
    tempC: (i) => vessels[i].mix.tempK - 273.15,
    syringeML: () => syringe.volumeML,
    balanceG: () => Math.round(onBalance.reduce((g, i) => g + contentsMassG(vessels[i].mix), 0) * 100) / 100,
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
        vessels[s.vessel].heaterW = s.on ? (s.vessel >= BEAKER ? 60 : 35) : 0;
        break;
      case 'stir':
        vessels[s.vessel].stir();
        break;
      case 'connect':
        if (s.dst === SYRINGE) {
          syringe.reset();
          vessels[s.src].outlet = syringe;
        } else if (s.dst !== null) vessels[s.src].outlet = vessels[s.dst];
        else vessels[s.src].outlet = null;
        break;
      case 'invert':
        vessels[s.vessel].inverted = !vessels[s.vessel].inverted;
        break;
      case 'weigh':
        if (s.vessel === null) onBalance = [];
        else if (s.off) onBalance = onBalance.filter((i) => i !== s.vessel);
        else if (!onBalance.includes(s.vessel)) {
          const tubes = s.vessel < BEAKER && onBalance.length < 2 && onBalance.every((i) => i < BEAKER);
          onBalance = tubes ? [...onBalance, s.vessel] : [s.vessel];
        }
        break;
      case 'empty':
        vessels[s.vessel] = new Vessel(vessels[s.vessel].spec);
        break;
      case 'predict':
        break;
      case 'pour': {
        const src = vessels[s.src], dst = vessels[s.dst];
        dst.add(src.take(src.mix.volumeL));
        expect(dst.mix.volumeL * 1000, `${r.id}: tràn ${s.dst}`).toBeLessThanOrEqual(dst.spec.capacityL * 1000);
        break;
      }
      case 'burn': {
        const c = CHEMICALS.find((x) => x.key === s.chem);
        if (!c?.solid) throw new Error(`${r.id}: không có chất rắn "${s.chem}"`);
        probes.push('burn-' + c.solid.id);
        break;
      }
      case 'probe': {
        const v = vessels[s.vessel];
        run(1.2); // thời gian đưa que / giấy tới miệng ống
        if (s.tool === 'glowing') probes.push(testGlowingSplint(v));
        else if (s.tool === 'burning') probes.push(testBurningSplint(v));
        else if (s.tool === 'magnet') probes.push('magnet-' + testMagnet(v));
        else {
          run(5);
          probes.push('litmus-' + litmusVerdict(litmusPH(v)));
        }
        break;
      }
    }
    weighings.push(state.balanceG());
  });
  return { vessels, timedOut, probes, syringe, weighings };
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

  it('Bài 2 – dấu hiệu chất mới: ống 1 có khí, ống 2 không đổi, ống 3 có kết tủa', () => {
    const v = run('dau-hieu-chat-moi');
    expect(v[0].gasTotal.get('H2') ?? 0).toBeGreaterThan(1e-4);
    expect(v[1].mix.get('BaSO4')).toBe(0);
    expect(v[1].gasTotal.size).toBe(0);
    expect(v[2].mix.get('Cu(OH)2')).toBeGreaterThan(5e-4);
  });

  it('Bài 2 – sắt + lưu huỳnh: trước khi đun bị nam châm hút, sau khi đun thành FeS', () => {
    const r = RECIPES.find((x) => x.id === 'sat-luu-huynh')!;
    const res = runRecipe(r);
    expect(res.probes).toEqual(['magnet-attracted', 'magnet-none']);
    expect(res.vessels[1].mix.get('FeS')).toBeGreaterThan(0.012);
    expect(res.vessels[0].mix.get('FeS')).toBeLessThan(1e-8);
  });

  it('CTST Bài 2 – làm đục nước vôi trong: có CaCO3 trong ống 2', () => {
    const v = run('lam-duc-nuoc-voi-trong');
    expect(v[1].mix.get('CaCO3')).toBeGreaterThan(1e-5);
    expect(v[0].gasTotal.get('CO2') ?? 0).toBeGreaterThan(3e-4);
  });

  it('CTST Bài 2 – đốt magnesium', () => {
    expect(runRecipe(RECIPES.find((x) => x.id === 'dot-chay-magnesium')!).probes).toEqual(['burn-Mg']);
  });

  it('Bài 4 – nhận biết dung dịch: ống 1, 2 tan hết, ống 3 còn bột gạo, ống 4 bão hòa còn dư muối', () => {
    const v = run('nhan-biet-dung-dich');
    expect(v[0].mix.get('NaCl') * 58.44).toBeLessThan(1e-3);
    expect(v[0].mix.get('Na+')).toBeGreaterThan(0.012);
    expect(v[1].mix.get('CuSO4') * 249.69).toBeLessThan(1e-3);
    expect(v[1].mix.get('Cu^2+')).toBeGreaterThan(0.002);
    expect(v[2].mix.get('starch') * 162.14).toBeCloseTo(0.75, 2);
    const leftG = v[3].mix.get('NaCl') * 58.44;
    expect(leftG).toBeGreaterThan(0.9);
    expect(leftG).toBeLessThan(1.6);
  });

  it('Bài 4 – pha nước muối 0,9%: cốc rỗng 0,00 g, cân chỉ 0,90 g muối, tổng khoảng 100 g, muối tan hết', () => {
    const r = RECIPES.find((x) => x.id === 'pha-nuoc-muoi-sinh-li')!;
    const res = runRecipe(r);
    const iSalt = r.steps.findIndex((s) => s.kind === 'add' && s.chem === 'salt');
    const iWater = r.steps.findIndex((s) => s.kind === 'add' && s.chem === 'water');
    expect(res.weighings[iSalt - 1]).toBe(0);
    expect(res.weighings[iSalt]).toBeCloseTo(0.9, 2);
    expect(res.weighings[iWater]).toBeGreaterThan(99.5);
    expect(res.weighings[iWater]).toBeLessThan(100.5);
    expect(res.vessels[BEAKER].mix.get('NaCl') * 58.44).toBeLessThan(1e-3);
  });

  it('Bài 5 – bảo toàn khối lượng: có kết tủa BaSO4, số chỉ của cân không đổi', () => {
    const r = RECIPES.find((x) => x.id === 'bao-toan-khoi-luong')!;
    const res = runRecipe(r);
    const iPour = r.steps.findIndex((s) => s.kind === 'pour');
    expect(res.vessels[1].mix.get('BaSO4')).toBeGreaterThan(3e-4);
    expect(res.vessels[0].mix.volumeL).toBeLessThan(1e-6);
    expect(res.weighings[iPour - 1]).toBeGreaterThan(7);
    expect(res.weighings[iPour]).toBeCloseTo(res.weighings[iPour - 1], 2);
    expect(res.weighings[res.weighings.length - 1]).toBeCloseTo(res.weighings[iPour - 1], 2);
  });

  it('mỗi bài học thuộc một bộ sách có trong danh sách', () => {
    for (const r of RECIPES) expect(BOOKS[LESSONS[r.lesson].book]).toBeTruthy();
  });
});
