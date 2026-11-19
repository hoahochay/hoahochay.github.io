/**
 * Chạy từng thí nghiệm mẫu trực tiếp trên engine (không cần trình duyệt) để chắc chắn
 * kịch bản hợp lệ và hiện tượng xảy ra đúng như phần kết luận mô tả.
 */
import { describe, expect, it } from 'vitest';
import { contentsMassG, GasSyringe, indicatorDrops, litmusPH, litmusVerdict, makeSolution, testBurningSplint, testGlowingSplint, testMagnet, Vessel, VESSELS } from '../src';
import { CHEMICALS, solidMol } from '../web/catalog';
import { BEAKER, CATEGORIES, FLASK, LabState, PlayScript, RECIPE_ALIASES, RECIPES, SYRINGE, TOPICS } from '../web/recipes';

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
        else if (s.tool === 'ph_paper') probes.push('ph-' + Math.min(14, Math.max(1, Math.round(v.observe().pH))));
        else if (s.tool === 'litmus_sol') probes.push('litmus_sol-' + litmusVerdict(v.observe().pH));
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

  it('Bài 7 – nồng độ: sắt trong HCl 1M phản ứng nhiều hơn hẳn trong HCl 0,1M', () => {
    const v = runRecipe(RECIPES.find((x) => x.id === 'nong-do-toc-do-phan-ung')!).vessels;
    expect(v[1].mix.get('Fe^2+')).toBeGreaterThan(5 * v[0].mix.get('Fe^2+'));
    expect(v[0].mix.get('Fe^2+')).toBeGreaterThan(0);
  });

  it('Bài 7 – nhiệt độ: nước được đun trên 70 °C, viên sủi tan nhanh hơn trong nước nóng', () => {
    const r = RECIPES.find((x) => x.id === 'nhiet-do-toc-do-phan-ung')!;
    const res = runRecipe(r);
    expect(res.timedOut).toEqual([]);
    const left = (i: number) => res.vessels[i].mix.get('VitC') * 444.15;
    expect(left(1)).toBeLessThan(0.3 * left(0));
    expect(left(0)).toBeGreaterThan(0.02);
  });

  it('Bài 7 – diện tích bề mặt: đá vôi bột phản ứng nhanh hơn đá vôi viên', () => {
    // So sánh trong 5 giây đầu (về sau acid ở ống bột đã hết nên hai ống gần bằng nhau)
    const r = RECIPES.find((x) => x.id === 'be-mat-toc-do-phan-ung')!;
    const steps = r.steps.map((st) => (st.kind === 'wait' ? { ...st, seconds: 5 } : st));
    const v = runRecipe({ ...r, steps }).vessels;
    expect(v[1].mix.get('Ca^2+')).toBeGreaterThan(2 * v[0].mix.get('Ca^2+'));
  });

  it('Bài 7 – xúc tác: MnO2 phân hủy gần hết H2O2, que đóm bùng cháy, MnO2 còn nguyên', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'xuc-tac-toc-do-phan-ung')!);
    const v = res.vessels;
    expect(v[1].mix.get('H2O2')).toBeLessThan(0.05 * v[0].mix.get('H2O2'));
    expect(v[1].mix.get('MnO2') * 86.94).toBeCloseTo(0.1, 3);
    expect(res.probes).toEqual(['relight']);
  });

  it('Bài 8 – HCl làm quỳ tím hóa đỏ, tác dụng với sắt và kẽm (kẽm mạnh hơn)', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'tinh-chat-hydrochloric-acid')!);
    expect(res.probes).toEqual(['litmus_sol-acid']);
    const v = res.vessels;
    expect(v[1].mix.get('Fe^2+')).toBeGreaterThan(1e-5);
    expect(v[2].mix.get('Zn^2+')).toBeGreaterThan(2 * v[1].mix.get('Fe^2+'));
  });

  it('Bài 9 – base: quỳ hóa xanh; phenolphthalein hồng, nhỏ acid đến khi mất màu', () => {
    const r = RECIPES.find((x) => x.id === 'tinh-chat-base')!;
    const res = runRecipe(r);
    expect(res.probes).toEqual(['litmus_sol-base']);
    // Sau 0,8 mL acid vẫn còn base (pH > 10, còn hồng); sau 1,1 mL thì acid dư (pH < 7, mất màu)
    const lastAdd = r.steps.map((s) => s.kind).lastIndexOf('add');
    const before = r.steps.slice(0, lastAdd);
    expect(runRecipe({ ...r, steps: before }).vessels[1].observe().pH).toBeGreaterThan(10);
    expect(res.vessels[1].observe().pH).toBeLessThan(7);
  });

  it('Bài 9 – giấy pH: số đọc khớp lời thuyết minh', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'xac-dinh-ph')!);
    expect(res.timedOut).toEqual([]);
    expect(res.probes).toEqual(['ph-7', 'ph-2', 'ph-3', 'ph-9', 'ph-2', 'ph-8']);
  });

  it('Bài 10 – oxide acid: nước vôi trong vẩn đục rồi trong lại khi dẫn CO2 lâu', () => {
    const r = RECIPES.find((x) => x.id === 'tinh-chat-oxide-acid')!;
    const res = runRecipe(r);
    expect(res.timedOut).toEqual([]);
    expect(res.vessels[1].mix.get('CaCO3')).toBeLessThan(5e-7);
  });

  it('Bài 10 – oxide base: CuO tan dần trong H2SO4, dung dịch có ion Cu2+', () => {
    const v = runRecipe(RECIPES.find((x) => x.id === 'tinh-chat-oxide-base')!).vessels;
    expect(v[0].mix.conc('Cu^2+')).toBeGreaterThan(0.1);
    expect(v[0].mix.get('CuO') * 79.55).toBeLessThan(0.06);
  });

  it('Bài 11 – tính chất muối: Cu bám trên đinh, BaSO4 ở ống 2 và 3, Cu(OH)2 ở ống 4', () => {
    const v = runRecipe(RECIPES.find((x) => x.id === 'tinh-chat-muoi')!).vessels;
    expect(v[0].mix.get('Cu') * 63.55).toBeGreaterThan(0.01);
    expect(v[1].mix.get('BaSO4')).toBeGreaterThan(9e-5);
    expect(v[2].mix.get('BaSO4')).toBeGreaterThan(9e-5);
    expect(v[3].mix.get('Cu(OH)2')).toBeGreaterThan(4e-4);
  });

  it('CTST Bài 3 – vôi sống tỏa nhiệt, viên sủi thu nhiệt', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'phan-ung-toa-nhiet-thu-nhiet')!);
    expect(res.timedOut).toEqual([]);
    expect(res.vessels[0].mix.get('Ca(OH)2')).toBeGreaterThan(0.01);
  });

  it('CTST Bài 7 – pha CaCl2 10% và 1M', () => {
    const b = runRecipe(RECIPES.find((x) => x.id === 'pha-cacl2-10-phan-tram')!);
    expect(b.timedOut).toEqual([]);
    const f = runRecipe(RECIPES.find((x) => x.id === 'pha-cacl2-1m')!);
    expect(f.timedOut).toEqual([]);
    expect(f.vessels[5].mix.conc('Ca^2+')).toBeCloseTo(1, 1);
  });

  it('CTST Bài 8 – nồng độ, nhiệt độ, diện tích tiếp xúc', () => {
    const c = runRecipe(RECIPES.find((x) => x.id === 'nong-do-toc-do-ctst')!).vessels;
    expect(c[1].mix.get('Mg')).toBeLessThan(c[0].mix.get('Mg') / 5);
    const t = runRecipe(RECIPES.find((x) => x.id === 'nhiet-do-toc-do-ctst')!);
    expect(t.timedOut).toEqual([]);
    expect(t.vessels[0].mix.get('Zn')).toBeLessThan(t.vessels[1].mix.get('Zn'));
  });

  it('CTST Bài 8 – xúc tác MnO2: KClO3 phân hủy sớm hơn', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'xuc-tac-toc-do-ctst')!);
    expect(res.timedOut).toEqual([]);
    expect(res.probes).toEqual(['relight', 'none', 'relight']);
    expect(res.vessels[1].mix.get('MnO2') * 86.94).toBeCloseTo(0.1, 3);
  });

  const probesOf = (id: string) => runRecipe(RECIPES.find((r) => r.id === id)!).probes;
  const vesselsOf = (id: string) => runRecipe(RECIPES.find((r) => r.id === id)!).vessels;

  it('Khám phá – bảo toàn khối lượng: kết tủa không đổi, đá vôi + acid trong bình hở giảm khoảng 0,2 g', () => {
    const r = RECIPES.find((x) => x.id === 'mass-change')!;
    const res = runRecipe(r);
    const idx = (text: string) => r.steps.findIndex((s) => 'text' in s && s.text?.startsWith(text));
    const w = res.weighings;
    const afterMix = w[idx('Kết tủa trắng')];
    expect(w[idx('Theo dõi tiếp')]).toBeCloseTo(afterMix, 2);
    expect(afterMix).toBeGreaterThan(20);
    const added = w[idx('Thả 0,5 g đá vôi')];
    const lost = added - w[w.length - 1];
    expect(lost).toBeGreaterThan(0.15);
    expect(lost).toBeLessThan(0.25);
  });

  it('Khám phá – xi lanh đo khí: thu được khoảng 40 mL khí', () => {
    const res = runRecipe(RECIPES.find((r) => r.id === 'mg-rate')!);
    expect(res.syringe.volumeML).toBeGreaterThan(34);
    expect(res.syringe.volumeML).toBeLessThan(44);
    expect(res.vessels[FLASK].mix.get('Mg')).toBeLessThan(1e-5);
  });

  it('Khám phá – magnesium bột hết trước magnesium dải', () => {
    const r = RECIPES.find((x) => x.id === 'surface-area')!;
    const steps = r.steps.map((st) => (st.kind === 'wait' ? { ...st, seconds: 4, until: undefined } : st));
    const v = runRecipe({ ...r, steps }).vessels;
    expect(v[1].mix.get('Mg')).toBeLessThan(0.5 * v[0].mix.get('Mg'));
  });

  it('Khám phá – Cu(OH)2 kết tủa rồi tan hết trong HCl', () => {
    expect(vesselsOf('cuoh2')[1].mix.get('Cu(OH)2')).toBe(0);
  });

  it('Khám phá – mưa vàng: PbI2 kết tinh lại sau khi nguội', () => {
    expect(vesselsOf('golden-rain')[3].mix.get('PbI2')).toBeGreaterThan(3e-5);
  });

  it('Khám phá – nhận biết Cl-, SO4 2-, Fe3+ bằng kết tủa', () => {
    const v = vesselsOf('nhan-biet-ion');
    expect(v[0].mix.get('AgCl')).toBeGreaterThan(0);
    expect(v[1].mix.get('BaSO4')).toBeGreaterThan(0);
    expect(v[2].mix.get('Fe(OH)3')).toBeGreaterThan(0);
  });

  it('Khám phá – thử khí O2, H2, CO2, NH3 và cách thu H2', () => {
    expect(probesOf('o2-test')).toEqual(['none', 'relight']);
    expect(probesOf('h2-test')).toEqual(['pop', 'normal']);
    expect(probesOf('co2-test')).toEqual(['extinguished', 'litmus-acid']);
    expect(probesOf('nh3-test')).toEqual(['litmus-neutral', 'litmus-base']);
    expect(probesOf('h2-collect')).toEqual(['normal', 'pop']);
  });

  it('Khám phá – Li, Na, K với nước đều tạo base mạnh', () => {
    for (const v of vesselsOf('alkali-water').slice(0, 3)) expect(v.observe().pH).toBeGreaterThan(12);
  });

  it('Khám phá – dãy hoạt động: Mg > Zn > Fe > Cu', () => {
    const h2 = vesselsOf('metal-activity').slice(0, 4).map((v) => v.gasTotal.get('H2') ?? 0);
    expect(h2[0]).toBeGreaterThan(h2[1]);
    expect(h2[1]).toBeGreaterThan(h2[2]);
    expect(h2[2]).toBeGreaterThan(0);
    expect(h2[3]).toBe(0);
  });

  it('mỗi thí nghiệm thuộc một chủ đề và một mục có trong danh sách; id không trùng', () => {
    for (const r of RECIPES) expect(CATEGORIES[TOPICS[r.topic].cat]).toBeTruthy();
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it('link cũ tới thí nghiệm đã gộp vẫn trỏ tới thí nghiệm có thật', () => {
    for (const [old, id] of Object.entries(RECIPE_ALIASES)) {
      expect(RECIPES.some((r) => r.id === old)).toBe(false);
      expect(RECIPES.some((r) => r.id === id)).toBe(true);
    }
  });
});
