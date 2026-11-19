/**
 * Chạy từng thí nghiệm mẫu trực tiếp trên engine (không cần trình duyệt) để chắc chắn
 * kịch bản hợp lệ và hiện tượng xảy ra đúng như phần kết luận mô tả.
 */
import { describe, expect, it } from 'vitest';
import { Burette, burnSulfurIn, flameTest, liquidBurn, testDyePaper, contentsMassG, GasSyringe, litmusPH, litmusVerdict, testBurningSplint, testGlowingSplint, testMagnet, Vessel, VESSELS } from '../src';
import { BURETTES, CHEMICALS, isBurette, reagentMixture, solidMol } from '../web/catalog';
import { X_HIDDEN_TURBIDITY } from '../web/xcard';
import { BEAKER, CATEGORIES, FLASK, TUBE1, TUBE2, TUBE3, TUBE4, LabState, PlayScript, RECIPE_ALIASES, RECIPES, SYRINGE, TOPICS } from '../web/recipes';

interface RunResult {
  vessels: Vessel[];
  /** Các bước `wait` có `until` nhưng hết giờ mà điều kiện chưa đạt */
  timedOut: number[];
  /** Kết quả các lần thử khí, theo thứ tự */
  probes: string[];
  syringe: GasSyringe;
  weighings: number[];
  /** Thể tích đã dùng của burette trên từng dụng cụ, mL */
  burettes: Map<number, Burette>;
}

function runRecipe(r: PlayScript): RunResult {
  const vessels = [0, 1, 2, 3].map(() => new Vessel(VESSELS.testTube));
  vessels.push(new Vessel(VESSELS.beaker100), new Vessel(VESSELS.flask100));
  const syringe = new GasSyringe(100);
  let onBalance: number[] = [];
  /** Số đọc của cân sau mỗi bước, để kiểm tra kết quả */
  const weighings: number[] = [];
  const burettes = new Map<number, Burette>();
  const state: LabState = {
    buretteML: (i) => burettes.get(i)?.usedML ?? 0,
    mix: (i) => vessels[i].mix,
    tempC: (i) => vessels[i].mix.tempK - 273.15,
    syringeML: () => syringe.volumeML,
    balanceG: () => Math.round(onBalance.reduce((g, i) => g + contentsMassG(vessels[i].mix), 0) * 100) / 100,
  };
  const timedOut: number[] = [];
  const probes: string[] = [];
  /** Chạy mô phỏng thêm một khoảng (như lúc dụng cụ thử đang được đưa vào) */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      for (const b of burettes.values()) b.step(0.05);
      for (const v of vessels) v.step(0.05);
    }
  };
  r.steps.forEach((s, idx) => {
    switch (s.kind) {
      case 'add': {
        const c = CHEMICALS.find((x) => x.key === s.chem);
        if (!c) throw new Error(`${r.id}: không có hóa chất "${s.chem}"`);
        const v = vessels[s.vessel];
        if (c.solid) v.addSolid(c.solid.id, solidMol(c.solid, s.amount), c.solid.form);
        else v.add(reagentMixture(c.reagent!, s.amount, v.roomK));
        expect(v.mix.liquidL() * 1000, `${r.id}: tràn ${s.vessel}`).toBeLessThanOrEqual(v.spec.capacityL * 1000);
        break;
      }
      case 'timelapse': {
        for (let t = 0; t < s.seconds; t += 60) for (const v of vessels) v.step(Math.min(60, s.seconds - t));
        break;
      }
      case 'wait': {
        const speed = s.speed ?? 1;
        const dt = Math.min(0.05 * speed, 0.5);
        let t = 0;
        let met = false;
        while (t < s.seconds) {
          if (s.until?.(state)) { met = true; break; }
          for (const b of burettes.values()) b.step(dt);
          for (const v of vessels) v.step(dt);
          t += dt;
        }
        if (s.until && !met && !s.until(state)) timedOut.push(idx);
        break;
      }
      case 'heat':
        vessels[s.vessel].heaterW = s.on ? (s.vessel >= BEAKER ? 60 : 35) : 0;
        if (s.on) vessels[s.vessel].bathK = null;
        break;
      case 'burette': {
        const b = burettes.get(s.vessel);
        if (!b) throw new Error(`${r.id}: chưa lắp burette trên dụng cụ ${s.vessel}`);
        if (s.action === 'drop') b.drop();
        else b.mode = s.action === 'close' ? 'closed' : s.action;
        break;
      }
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
        dst.add(src.take(Math.min(src.mix.liquidL(), (s.mL ?? Infinity) / 1000)));
        expect(dst.mix.liquidL() * 1000, `${r.id}: tràn ${s.dst}`).toBeLessThanOrEqual(dst.spec.capacityL * 1000);
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
        else if (s.tool === 'xcard') probes.push('xcard');
        else if (s.tool === 'dye_paper') probes.push('dye-' + testDyePaper(v));
        else if (s.tool === 'ph_paper') probes.push('ph-' + Math.min(14, Math.max(1, Math.round(v.observe().pH))));
        // Như giao diện: ngâm lần nữa vào cùng loại cốc thì lấy ống ra
        else if (s.tool === 'ice_bath' || s.tool === 'warm_bath' || s.tool === 'hot_bath') {
          const K = { ice_bath: 273.15, warm_bath: 323.15, hot_bath: 353.15 }[s.tool];
          v.bathK = v.bathK === K ? null : K;
        }
        else if (isBurette(s.tool)) {
          if (burettes.has(s.vessel)) burettes.delete(s.vessel);
          else burettes.set(s.vessel, new Burette(v, BURETTES[s.tool].solutes));
        } else if (s.tool === 'flame_wire') probes.push('flame-' + (flameTest(v.mix)?.ion ?? 'none'));
        else if (s.tool === 'dish_burn') probes.push('dish-' + liquidBurn(v.take(Math.min(0.001, v.mix.liquidL()))).flame);
        else if (s.tool === 'spoon_s') {
          let o2 = 0;
          for (let i = 0; i < 6; i++) { o2 = burnSulfurIn(v, 1); run(1); }
          probes.push('spoon-' + (o2 > 0.5 ? 'bright' : 'dim'));
        } else if (s.tool === 'no2_tube') probes.push('no2-' + v.fillNO2());
        else if (s.tool === 'ph_moist') {
          run(5);
          probes.push('ph_moist-' + Math.round(litmusPH(v)));
        } else if (s.tool === 'litmus_sol') probes.push('litmus_sol-' + litmusVerdict(v.observe().pH));
        else {
          run(5);
          probes.push('litmus-' + litmusVerdict(litmusPH(v)));
        }
        break;
      }
    }
    weighings.push(state.balanceG());
  });
  return { vessels, timedOut, probes, syringe, weighings, burettes };
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

  it('Hóa 11 Bài 1 – NO2: lạnh nhạt màu, nóng đậm màu', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'nhiet-do-can-bang-no2')!);
    const no2 = res.vessels.slice(0, 3).map((v) => v.mix.headspace.get('NO2(g)') ?? 0);
    console.log('NO2 mol', no2);
    expect(no2[1]).toBeLessThan(no2[0] * 0.5);
    expect(no2[2]).toBeGreaterThan(no2[0] * 2);
    expect(res.vessels[0].stoppered).toBe(true);
  });

  it('Hóa 11 Bài 1 – CH3COONa: nóng hồng đậm hơn, lạnh nhạt hơn', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'nhiet-do-can-bang-ch3coona')!);
    const green = res.vessels.slice(0, 3).map((v) => v.observe().appearance[1]);
    console.log('G kênh', green, res.vessels.slice(0, 3).map((v) => v.mix.volumeL * 1000));
    expect(green[1]).toBeGreaterThan(green[0] + 0.15);
    expect(green[2]).toBeLessThan(green[0]);
  });

  it('Hóa 11 Bài 2 – bắp cải tím: giấm đỏ, muối tím, soda xanh lục', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'chi-thi-bap-cai-tim')!);
    const col = [0, 1, 2, 3, 4].map((i) => res.vessels[i].observe().appearance.map((x) => +x.toFixed(2)));
    console.log('bắp cải', res.probes, JSON.stringify(col));
    expect(res.probes).toHaveLength(5);
    const [vinegar, , , soda, salt] = col;
    expect(vinegar[0]).toBeGreaterThan(vinegar[1] + 0.3); // đỏ
    expect(soda[1]).toBeGreaterThan(soda[0] + 0.3); // xanh lục
    expect(soda[1]).toBeGreaterThan(soda[2] + 0.3);
    expect(salt[2]).toBeGreaterThan(salt[1] + 0.2); // tím: thiếu xanh lục
  });

  it('Hóa 11 Bài 21 – phenol tan trong NaOH, Na2CO3; tạo kết tủa với nước bromine', () => {
    const v = run('phenol-naoh-na2co3');
    for (const i of [0, 1]) {
      expect(v[i].mix.get('C6H5OH(l)')).toBeLessThan(1e-7);
      expect(v[i].observe().turbidity).toBeLessThan(0.02);
    }
    expect(v[1].gasTotal.get('CO2') ?? 0).toBeLessThan(1e-6);
    const b = run('phenol-nuoc-bromine');
    expect(b[0].mix.get('C6H2Br3OH')).toBeGreaterThan(2e-5);
    expect(b[0].mix.get('Br2')).toBeLessThan(1e-7);
  });

  it('Hóa 11 Bài 23 – tráng bạc và Cu2O đỏ gạch', () => {
    const t = run('trang-bac-tollens');
    expect(t[0].mix.get('Ag(mirror)')).toBeGreaterThan(5e-5);
    expect(t[0].mix.get('Ag2O')).toBeLessThan(1e-8);
    const c = run('aldehyde-cuoh2');
    expect(c[0].mix.get('Cu2O')).toBeGreaterThan(7e-5);
    expect(c[0].mix.get('CuO')).toBeLessThan(5e-6);
  });

  it('Hóa 11 Bài 8 – Cu + H2SO4 đặc nóng tạo SO2, nguội thì không', () => {
    const v = run('dong-h2so4-dac');
    expect(v[0].gasTotal.get('SO2(g)') ?? 0).toBeGreaterThan(1e-4);
    expect(v[0].mix.get('Cu^2+')).toBeGreaterThan(4e-4);
    expect(v[0].mix.get('Cu')).toBeGreaterThan(5e-4);
  });

  it('Hóa 11 Bài 7 – lưu huỳnh cháy sáng trong bình oxygen, tạo SO2 làm quỳ ẩm hóa đỏ', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'luu-huynh-chay-oxygen')!);
    expect(res.timedOut).toEqual([]);
    expect(res.probes).toEqual(['spoon-bright', 'litmus-acid']);
  });

  describe('Hóa 12 – Chương 2, 3', () => {
    const run = (id: string) => runRecipe(RECIPES.find((x) => x.id === id)!);
    it('Bài 4 – glucose hòa tan Cu(OH)₂ thành dung dịch xanh lam', () => {
      const r = run('glucose-cuoh2');
      expect(r.timedOut).toEqual([]);
      const m = r.vessels[TUBE1].mix;
      expect(m.get('Cu(OH)2')).toBeLessThan(2e-6);
      expect(m.get('Cu(glucose)')).toBeGreaterThan(1.4e-4);
    });
    it('Bài 4 – tính chất aldehyde của glucose: Cu₂O, gương bạc, mất màu bromine', () => {
      const r = run('glucose-tinh-chat-aldehyde');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('Cu2O')).toBeGreaterThan(7e-5);
      expect(r.vessels[TUBE2].mix.get('Ag(mirror)')).toBeGreaterThan(1e-4);
      expect(r.vessels[TUBE3].mix.get('Br2')).toBeLessThan(1e-7);
    });
    it('Bài 5 – saccharose hòa tan Cu(OH)₂, đun nóng không khử', () => {
      const r = run('saccharose-cuoh2');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('Cu(saccharose)')).toBeGreaterThan(1.4e-4);
    });
    it('Bài 6 – thủy phân tinh bột rồi thử Cu(OH)₂: kết tủa đỏ gạch', () => {
      const r = run('thuy-phan-tinh-bot');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('amylose')).toBeLessThan(1.5e-5);
      expect(r.vessels[TUBE2].mix.get('Cu2O')).toBeGreaterThan(6e-5);
    });
    it('Bài 6 – hồ tinh bột + iodine: xanh tím', () => {
      const r = run('ho-tinh-bot-iodine');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('I2-starch')).toBeGreaterThan(4e-6);
    });
    it('Bài 8 – methylamine: base, mất màu hồng, Fe(OH)₃, phức Cu xanh lam đậm', () => {
      const r = run('tinh-chat-methylamine');
      expect(r.timedOut).toEqual([]);
      expect(r.probes[0]).toMatch(/^ph-1[12]$/);
      expect(r.vessels[TUBE1].observe().pH).toBeLessThan(8);
      expect(r.vessels[TUBE2].mix.get('Fe(OH)3')).toBeGreaterThan(8e-5);
      expect(r.vessels[TUBE4].mix.get('Cu(CH3NH2)4^2+')).toBeGreaterThan(1.8e-4);
    });
    it('Bài 8 – aniline + nước bromine: mất màu, kết tủa trắng', () => {
      const r = run('aniline-nuoc-bromine');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('C6H2Br3NH2')).toBeGreaterThan(6e-6);
    });
    it('Bài 9 – phản ứng màu biuret: tím', () => {
      const r = run('phan-ung-biuret');
      expect(r.timedOut).toEqual([]);
      const o = r.vessels[TUBE1].observe();
      expect(r.vessels[TUBE1].mix.get('Cu(protein)')).toBeGreaterThan(1.8e-5);
      // Tím: kênh xanh lục bị hấp thụ nhiều hơn kênh đỏ và lam
      expect(o.solutionColor[1]).toBeLessThan(o.solutionColor[0] - 0.05);
      expect(o.solutionColor[1]).toBeLessThan(o.solutionColor[2] - 0.05);
    });
    it('Bài 19 – kẽm + H₂SO₄ loãng: khí hydrogen', () => {
      const r = run('kim-loai-acid-loang-hoa12');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('Zn^2+')).toBeGreaterThan(1e-4);
    });
    it('Bài 19 – đinh sắt + CuSO₄: đồng bám trên đinh', () => {
      const r = run('kim-loai-dung-dich-muoi-hoa12');
      expect(r.vessels[TUBE1].mix.get('Cu')).toBeGreaterThan(2e-4);
    });
    it('Bài 27 – chuẩn độ FeSO₄ bằng KMnO₄: hết khoảng 4,8 mL', () => {
      const r = run('chuan-do-fe2-kmno4');
      expect(r.timedOut).toEqual([]);
      const used = r.burettes.get(FLASK)!.usedML;
      expect(used).toBeGreaterThan(4.75);
      expect(used).toBeLessThan(4.95);
      expect(r.vessels[FLASK].mix.get('MnO4-')).toBeGreaterThan(3e-7);
    });
    it('Bài 27 – nhận biết Fe³⁺ (nâu đỏ) và Cu²⁺ (xanh)', () => {
      const r = run('nhan-biet-cu2-fe3');
      expect(r.vessels[TUBE1].mix.get('Fe(OH)3')).toBeGreaterThan(4e-5);
      expect(r.vessels[TUBE2].mix.get('Cu(OH)2')).toBeGreaterThan(6e-5);
    });
    it('Bài 29 – phức [Cu(NH₃)₄]²⁺ xanh lam đậm và [CuCl₄]²⁻ vàng', () => {
      const r = run('phuc-chat-cu2');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('Cu(NH3)4^2+')).toBeGreaterThan(3e-4);
      const m = r.vessels[TUBE2].mix;
      expect(m.get('CuCl4^2-')).toBeGreaterThan(0.8 * (m.get('CuCl4^2-') + m.get('Cu^2+')));
    });
    it('Bài 1 – ester thủy phân không hết trong acid, gần hết trong kiềm', () => {
      const r = run('thuy-phan-ester');
      const n0 = (2 * 0.902) / 88.11;
      expect(r.vessels[TUBE1].mix.get('CH3COOC2H5')).toBeGreaterThan(0.5 * n0);
      expect(r.vessels[TUBE2].mix.get('CH3COOC2H5')).toBeLessThan(0.2 * n0);
    });
    it('Bài 2 – xà phòng hóa chất béo, xà phòng tách ra trong NaCl bão hòa', () => {
      const r = run('xa-phong-hoa-chat-beo');
      expect(r.timedOut).toEqual([]);
      const b = r.vessels[BEAKER].mix;
      expect(b.get('soap')).toBeGreaterThan(4 * b.get('oleate'));
      expect(b.get('glycerol')).toBeGreaterThan(1.5e-3);
    });
    it('Bài 6 – thủy phân cellulose, sản phẩm khử Cu(OH)₂ tạo Cu₂O', () => {
      const r = run('thuy-phan-cellulose');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE2].mix.get('Cu2O')).toBeGreaterThan(5e-5);
    });
    it('Bài 6 – nitrate hóa cellulose; bông nitrate cháy bùng', () => {
      const r = run('cellulose-nitric-acid');
      expect(r.timedOut).toEqual([]);
      expect(r.probes).toEqual(['burn-cellulose', 'burn-cellulose_nitrate']);
      expect(r.vessels[TUBE1].mix.get('cellulose_nitrate')).toBeGreaterThan(2.5e-4);
    });
    it('Bài 6 – bông tan trong nước Schweizer', () => {
      const r = run('cellulose-schweizer');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[BEAKER].mix.get('cellulose(sw)')).toBeGreaterThan(3e-4);
    });
    it('Bài 19 – đốt Mg; Al + S bùng cháy tạo Al₂S₃', () => {
      const r = run('kim-loai-phi-kim-hoa12');
      expect(r.timedOut).toEqual([]);
      expect(r.probes).toEqual(['burn-Mg']);
      expect(r.vessels[TUBE1].mix.get('Al2S3')).toBeGreaterThan(1.5e-3);
    });
    it('Bài 22 – đinh sắt gỉ sau 3 ngày', () => {
      const r = run('an-mon-dien-hoa-sat');
      expect(r.vessels[TUBE1].mix.get('FeOOH') * 88.85e3).toBeGreaterThan(8);
    });
    it('Bài 22 – kẽm bảo vệ sắt', () => {
      const r = run('bao-ve-sat-dien-hoa');
      const rust1 = r.vessels[TUBE1].mix.get('FeOOH'), rust2 = r.vessels[TUBE2].mix.get('FeOOH');
      expect(rust2).toBeLessThan(0.02 * rust1);
      expect(r.vessels[TUBE2].mix.get('Zn(OH)2')).toBeGreaterThan(1e-5);
    });
    it('Bài 24 – Li, Na, K với nước; màu ngọn lửa Li⁺, Na⁺, K⁺', () => {
      expect(run('alkali-water').timedOut).toEqual([]);
      expect(run('mau-ngon-lua-nhom-ia').probes).toEqual(['flame-Li⁺', 'flame-Na⁺', 'flame-K⁺']);
    });
    it('Bài 25 – màu ngọn lửa Ca²⁺, Sr²⁺, Ba²⁺', () => {
      expect(run('mau-ngon-lua-nhom-iia').probes).toEqual(['flame-Ca²⁺', 'flame-Sr²⁺', 'flame-Ba²⁺']);
    });
    it('Bài 25 – BaSO₄ kết tủa ngay, CaSO₄ phải nhỏ nhiều giọt', () => {
      const r = run('do-tan-caso4-baso4');
      expect(r.vessels[TUBE2].mix.get('BaSO4')).toBeGreaterThan(4e-5);
      expect(r.vessels[TUBE1].mix.get('CaSO4')).toBeGreaterThan(1e-4);
    });
    it('Bài 25 – nhận biết Ca²⁺, Ba²⁺, SO₄²⁻, CO₃²⁻', () => {
      const r = run('nhan-biet-ca-ba-so4-co3');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE2].mix.get('BaSO4')).toBeGreaterThan(1.5e-4);
      expect(r.vessels[TUBE3].mix.get('BaSO4')).toBeGreaterThan(1.4e-4);
      expect(r.vessels[TUBE1].mix.get('CaSO4')).toBeLessThan(r.vessels[TUBE2].mix.get('BaSO4'));
      expect(r.vessels[TUBE4].mix.get('CaCO3')).toBeLessThan(1e-6);
    });
    it('Bài 10 – protein đông tụ khi đun, HNO₃ đặc tạo kết tủa vàng', () => {
      const r = run('dong-tu-protein');
      expect(r.timedOut).toEqual([]);
      expect(r.vessels[TUBE1].mix.get('protein(coag)')).toBeGreaterThan(5.5e-4);
      expect(r.vessels[TUBE2].mix.get('xanthoprotein')).toBeGreaterThan(3e-4);
    });
  });

  it('Hóa 11 Bài 11 – chưng cất rượu: sôi khoảng 86 °C, sản phẩm có độ cồn cao, cháy được', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'chung-cat-ethanol')!);
    expect(res.timedOut).toEqual([]);
    expect(res.probes).toEqual(['dish-none', 'dish-blue']);
    const t = res.vessels[0];
    expect(t.mix.conc('C2H5OH')).toBeGreaterThan(10);
    const T = res.vessels[FLASK].mix.tempK - 273.15;
    expect(T).toBeGreaterThan(84);
  });

  it('Hóa 11 Bài 11 – chiết β-carotene: lớp hexane màu cam được rót riêng ra', () => {
    const { vessels: [a, b] } = runRecipe(RECIPES.find((x) => x.id === 'tach-beta-carotene')!);
    const total = 6e-3 * 1.5e-5;
    expect(b.mix.get('carotene(org)')).toBeGreaterThan(0.85 * total);
    expect(b.mix.volumeL).toBeLessThan(1e-5);
    expect(b.observe().organic!.color[2]).toBeLessThan(0.2);
    expect(a.observe().solutionColor[1]).toBeGreaterThan(0.9);
  });

  it('Hóa 11 Bài 15 – bromine chuyển lên lớp hexane, nhạt màu khi ngâm nước ấm', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'brom-hoa-hexane')!);
    expect(res.timedOut).toEqual([]);
    const v = res.vessels[0];
    expect(v.mix.get('C6H13Br')).toBeGreaterThan(1.5e-5);
    expect(v.observe().organic!.onTop).toBe(true);
    expect(v.observe().pH).toBeLessThan(2.2);
  });

  it('Hóa 11 Bài 15 – hexane không làm mất màu KMnO₄', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'hexane-kmno4')!);
    expect(res.probes).toEqual(['dish-luminous']);
    expect(res.vessels[1].mix.liquidL()).toBeLessThan(1e-6);
    const v = res.vessels[0];
    expect(v.mix.get('MnO4-')).toBeGreaterThan(0.99 * 0.4e-3 * 0.063);
    expect(v.observe().organic!.volumeML).toBeCloseTo(1, 1);
  });

  it('Hóa 11 Bài 16 – ethylene và acetylene làm mất màu KMnO₄, nước bromine, cháy ở đầu ống dẫn', () => {
    for (const [id, burn] of [['dieu-che-ethylene', 'burns-ethylene'], ['dieu-che-acetylene', 'burns-acetylene']]) {
      const res = runRecipe(RECIPES.find((x) => x.id === id)!);
      expect(res.timedOut, id).toEqual([]);
      expect(res.probes, id).toEqual([burn]);
      const [t1, t2] = res.vessels;
      expect(t1.mix.get('MnO2'), id).toBeGreaterThan(3.5e-6);
      expect(t2.observe().solutionColor[2], id).toBeGreaterThan(0.85);
    }
  });

  it('Hóa 11 Bài 17 – toluene làm mất màu KMnO₄ khi đun, benzene thì không', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'oxi-hoa-toluene-benzene')!);
    expect(res.timedOut).toEqual([]);
    const [a, b] = res.vessels;
    expect(a.mix.get('MnO4-')).toBeGreaterThan(4.5e-5);
    expect(b.observe().solutionColor[1]).toBeGreaterThan(0.85);
    expect(b.mix.get('C6H5COOH')).toBeGreaterThan(4e-5);
  });

  it('Hóa 11 Bài 2 – chuẩn độ HCl 0,1 M bằng NaOH: dừng ở màu hồng nhạt, V ≈ 9,5 mL', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'chuan-do-acid-base')!);
    expect(res.timedOut).toEqual([]);
    const v = res.burettes.get(FLASK)!.usedML;
    expect(v).toBeGreaterThan(9.45);
    expect(v).toBeLessThan(9.65);
    const o = res.vessels[FLASK].observe();
    expect(o.pH).toBeGreaterThan(8.3);
    // Hồng: đỏ và lam còn lại nhiều hơn hẳn lục
    expect(o.solutionColor[0] - o.solutionColor[1]).toBeGreaterThan(0.3);
    expect(o.pH).toBeLessThan(10.8);
  });

  it('Hóa 11 Bài 8 – H₂SO₄ đặc than hóa đường mía, tỏa nhiệt, sinh SO₂', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'duong-h2so4-dac')!);
    expect(res.timedOut).toEqual([]);
    const b = res.vessels[BEAKER];
    expect(b.mix.get('C') * 12.011).toBeGreaterThan(3.5);
    expect(b.observe().gasTotalMol['SO2(g)'] ?? 0).toBeGreaterThan(1e-3);
  });

  it('Hóa 11 Bài 2 – môi trường dung dịch muối: nước 7, Na2CO3 base, AlCl3 và FeCl3 acid', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'moi-truong-dung-dich-muoi')!);
    console.log('pH muối', res.probes);
    const [water, na2co3, alcl3, fecl3] = res.probes.map((p) => Number(p.slice(3)));
    expect(water).toBe(7);
    expect(na2co3).toBeGreaterThanOrEqual(11);
    expect(alcl3).toBeGreaterThanOrEqual(3);
    expect(alcl3).toBeLessThanOrEqual(4);
    expect(fecl3).toBeLessThan(alcl3);
  });

  it('Hóa 11 Bài 5 – nhận biết NH4+: chỉ ống phân ammonium làm giấy pH ẩm hóa xanh', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'nhan-biet-ion-ammonium')!);
    console.log('pH ẩm', res.probes);
    expect(Number(res.probes[0].split('-')[1])).toBeGreaterThanOrEqual(5);
    expect(Number(res.probes[0].split('-')[1])).toBeLessThanOrEqual(7);
    expect(Number(res.probes[1].split('-')[1])).toBeGreaterThanOrEqual(9);
  });

  it('Hóa 11 Bài 8 – nhận biết SO4: cả hai ống có BaSO4', () => {
    const v = run('nhan-biet-ion-sulfate');
    expect(v[0].mix.get('BaSO4')).toBeGreaterThan(1e-5);
    expect(v[1].mix.get('BaSO4')).toBeGreaterThan(1e-5);
  });

  it('Hóa 11 Bài 20 – glycerol hòa tan Cu(OH)2, ethanol thì không', () => {
    const v = run('cuoh2-glycerol');
    expect(v[0].mix.get('Cu(OH)2')).toBeGreaterThan(1e-4);
    expect(v[1].mix.get('Cu(OH)2')).toBeLessThan(1e-6);
    expect(v[1].mix.get('Cu(glycerol)')).toBeGreaterThan(1e-4);
  });

  it('Hóa 11 Bài 24 – acetic acid: quỳ đỏ, Mg tạo H2, Na2CO3 tạo CO2', () => {
    const res = runRecipe(RECIPES.find((x) => x.id === 'tinh-acid-acetic-acid')!);
    expect(res.probes).toEqual(['litmus_sol-acid']);
    expect(res.vessels[0].gasTotal.get('H2') ?? 0).toBeGreaterThan(1.5e-4);
    expect(res.vessels[1].gasTotal.get('CO2') ?? 0).toBeGreaterThan(5e-4);
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
    const r = RECIPES.find((x) => x.id === 'dien-tich-be-mat-hoa10')!;
    const steps = r.steps.map((st) => (st.kind === 'wait' ? { ...st, seconds: 5 } : st));
    const v = runRecipe({ ...r, steps }).vessels;
    expect(v[1].mix.get('Ca^2+')).toBeGreaterThan(2 * v[0].mix.get('Ca^2+'));
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

  it('Lớp 10 – các thí nghiệm giai đoạn 1 cho đúng hiện tượng', () => {
    const v7 = vesselsOf('muoi-carbonate-tac-dung-acid');
    expect(v7[0].gasTotal.get('CO2') ?? 0).toBeGreaterThan(1e-4);
    const v15 = vesselsOf('chat-oxi-hoa-chat-khu');
    expect(v15[0].mix.get('Cu') * 63.55).toBeGreaterThan(0.01);
    expect(v15[1].gasTotal.get('H2') ?? 0).toBeGreaterThan(0);
    const v17 = vesselsOf('nhiet-phan-ung-trung-hoa');
    expect(v17[BEAKER].observe().tempC).toBeGreaterThan(27);
    expect(v17[BEAKER].observe().pH).toBeCloseTo(7, 0);
    const v19 = vesselsOf('xuc-tac-hoa10');
    expect(v19[1].mix.get('H2O2')).toBeLessThan(0.05 * v19[0].mix.get('H2O2'));
    expect(v19[1].mix.get('MnO2') * 86.94).toBeCloseTo(0.1, 3);
    const v22 = vesselsOf('hcl-tac-dung-kim-loai');
    expect(v22[0].gasTotal.get('H2') ?? 0).toBeGreaterThan(0);
    expect(v22[1].gasTotal.get('H2') ?? 0).toBe(0);
    expect(vesselsOf('hcl-tac-dung-nahco3')[0].gasTotal.get('CO2') ?? 0).toBeGreaterThan(1e-3);
  });

  it('Lớp 10 – nhận biết ion halide: F⁻ không kết tủa, Cl⁻ Br⁻ I⁻ kết tủa với Ag⁺', () => {
    const v = vesselsOf('nhan-biet-ion-halide');
    expect(v[0].observe().turbidity).toBeLessThan(0.01);
    expect(v[1].mix.get('AgCl')).toBeGreaterThan(2.5e-5);
    expect(v[2].mix.get('AgBr')).toBeGreaterThan(2.5e-5);
    expect(v[3].mix.get('AgI')).toBeGreaterThan(2.5e-5);
    for (const i of [1, 2, 3]) expect(v[i].observe().turbidity).toBeGreaterThan(0.3);
  });

  it('Lớp 10 – phản ứng thế halide: Cl₂ đẩy Br₂, I₂; Br₂ đẩy I₂; hồ tinh bột hóa xanh', () => {
    const v = vesselsOf('phan-ung-the-muoi-halide');
    expect(v[0].mix.get('Br2')).toBeGreaterThan(1.3e-5);
    expect(v[0].mix.get('Cl2')).toBeLessThan(1e-7);
    expect(v[2].mix.get('I2')).toBeGreaterThan(5e-6);
    expect(v[2].mix.get('Br2')).toBeLessThan(1e-7);
    expect(v[1].mix.get('I2-starch')).toBeGreaterThan(1e-5);
  });

  it('Lớp 10 – Mg + nước: ống đun nóng hồng nhanh hơn hẳn ống nguội', () => {
    const v = vesselsOf('nhiet-do-toc-do-hoa10');
    expect(v[1].observe().solutionColor[1]).toBeLessThan(0.7);
    expect(v[0].observe().solutionColor[1]).toBeGreaterThan(0.95);
  });

  it('Lớp 10 – oxide chu kì 3 + nước: Na₂O base mạnh, MgO base yếu, P₂O₅ acid', () => {
    const r = runRecipe(RECIPES.find((x) => x.id === 'oxide-tac-dung-nuoc')!);
    const [a, b, c] = r.vessels;
    expect(a.observe().pH).toBeGreaterThan(12.5);
    expect(b.observe().pH).toBeGreaterThan(9);
    expect(b.observe().pH).toBeLessThan(11);
    expect(b.mix.get('MgO') * 40.3).toBeGreaterThan(0.09);
    expect(c.observe().pH).toBeLessThan(2.5);
    expect(a.mix.get('Na2O') + c.mix.get('P2O5')).toBeLessThan(1e-6);
  });

  it('Lớp 10 – nồng độ thiosulfate càng lớn, chữ X biến mất càng nhanh', () => {
    const hiddenAt = (chem: string) => {
      const v = runRecipe({ id: 'x', title: 'x', steps: [{ kind: 'add', chem, amount: 5, vessel: 0 }, { kind: 'add', chem: 'h2so4', amount: 5, vessel: 0 }] }).vessels[0];
      let t = 0;
      while (v.observe().turbidity < X_HIDDEN_TURBIDITY && t < 300) { v.step(0.1); t += 0.1; }
      return t;
    };
    const [a, b, c] = ['na2s2o3_005', 'na2s2o3_01', 'na2s2o3_03'].map(hiddenAt);
    expect(c).toBeGreaterThan(8); expect(c).toBeLessThan(25);
    expect(b).toBeGreaterThan(30); expect(b).toBeLessThan(60);
    expect(a).toBeGreaterThan(70); expect(a).toBeLessThan(120);
    const v = vesselsOf('nong-do-toc-do-hoa10');
    for (const i of [0, 1, 2]) expect(v[i].observe().turbidity).toBeGreaterThan(X_HIDDEN_TURBIDITY);
  });

  it('Lớp 10 – khí chlorine từ thuốc tím + HCl đặc tẩy màu giấy ẩm; HCl loãng thì không', () => {
    const r = runRecipe(RECIPES.find((x) => x.id === 'tay-mau-chlorine-am')!);
    expect(r.probes).toContain('dye-bleached');
    const weak = runRecipe({ id: 'x', title: 'x', steps: [
      { kind: 'add', chem: 'kmno4', amount: 0.2, vessel: FLASK }, { kind: 'add', chem: 'hcl', amount: 5, vessel: FLASK },
      { kind: 'wait', seconds: 20 }, { kind: 'probe', tool: 'dye_paper', vessel: FLASK }] });
    expect(weak.probes).toContain('dye-none');
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
