/**
 * Chạy: npm run demo
 * In diễn biến một số thí nghiệm SGK theo thời gian, kèm ô màu (terminal hỗ trợ truecolor).
 */
import { gramsToMol, indicatorDrops, Observation, pretty, RGB, toHex, Vessel, VESSELS } from '../src';

const swatch = (c: RGB) => {
  const [r, g, b] = c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255));
  return `\x1b[48;2;${r};${g};${b}m    \x1b[0m`;
};

function line(o: Observation) {
  const gas = Object.entries(o.gasRateML)
    .filter(([, r]) => r > 0.005)
    .map(([id, r]) => `${pretty(id)} ${r.toFixed(2)} mL/s`)
    .join(', ');
  const solids = o.solids
    .filter((s) => s.grams > 1e-4)
    .map((s) => `${s.formula} ${(s.grams * 1000).toFixed(1)} mg`)
    .join(', ');
  console.log(
    `  t=${o.timeS.toFixed(0).padStart(5)} s  ${swatch(o.appearance)} ${toHex(o.appearance)}` +
      `  ${o.tempC.toFixed(1).padStart(5)}°C  pH ${o.pH.toFixed(2).padStart(5)}` +
      (gas ? `  khí: ${gas}` : '') +
      (solids ? `  rắn: ${solids}` : '') +
      (o.boiling ? '  (đang sôi)' : ''),
  );
}

function title(s: string) {
  console.log(`\n\x1b[1m▶ ${s}\x1b[0m`);
}

// 1 ───────────────────────────────────────────────────────────────────────
title('Chuẩn độ 10 mL HCl 0,1M bằng NaOH 0,1M, chỉ thị phenolphtalein');
{
  const v = new Vessel(VESSELS.beaker100);
  v.addSolution({ HCl: 0.1 }, 0.01).add(indicatorDrops('phenolphthalein'));
  let added = 0;
  for (const mL of [0, 5, 9, 9.9, 10, 10.1, 11, 15]) {
    if (mL > added) v.addSolution({ NaOH: 0.1 }, (mL - added) / 1000);
    added = mL;
    const o = v.observe();
    console.log(`  NaOH ${mL.toFixed(1).padStart(5)} mL  ${swatch(o.solutionColor)}  pH ${o.pH.toFixed(2)}`);
  }
}

// 2 ───────────────────────────────────────────────────────────────────────
title('Dải Mg 0,05 g vào 10 mL HCl 1M');
new Vessel()
  .addSolution({ HCl: 1 }, 0.01)
  .addSolid('Mg', gramsToMol('Mg', 0.05), 'strip')
  .run(90, { every: 15, onTick: line });

title('Bột Mg 0,05 g vào 10 mL HCl 1M (bề mặt lớn hơn → nhanh hơn)');
new Vessel()
  .addSolution({ HCl: 1 }, 0.01)
  .addSolid('Mg', gramsToMol('Mg', 0.05), 'powder')
  .run(6, { every: 1, onTick: line });

// 3 ───────────────────────────────────────────────────────────────────────
title('Nhỏ NaOH vào CuSO4 → kết tủa xanh lơ Cu(OH)2, để yên cho lắng');
{
  const v = new Vessel();
  v.addSolution({ CuSO4: 0.2 }, 0.005);
  line(v.observe());
  v.addSolution({ NaOH: 0.2 }, 0.01);
  line(v.observe());
  v.run(180, { every: 60, onTick: line });
}

// 4 ───────────────────────────────────────────────────────────────────────
title('Đinh sắt trong dung dịch CuSO4 0,5M (1 giờ)');
new Vessel()
  .addSolution({ CuSO4: 0.5 }, 0.01)
  .addSolid('Fe', gramsToMol('Fe', 2), 'strip')
  .run(3600, { dt: 1, every: 600, onTick: line });

// 5 ───────────────────────────────────────────────────────────────────────
title('Mẩu Na 0,1 g vào 50 mL nước có phenolphtalein');
new Vessel(VESSELS.beaker100)
  .add(indicatorDrops('phenolphthalein'))
  .addSolution({}, 0.05)
  .addSolid('Na', gramsToMol('Na', 0.1), 'granule')
  .run(12, { every: 2, onTick: line });

// 6 ───────────────────────────────────────────────────────────────────────
title('H2O2 3% + một ít bột MnO2 (xúc tác)');
new Vessel()
  .addSolution({ H2O2: 0.88 }, 0.01)
  .addSolid('MnO2', 0.001, 'powder')
  .run(60, { every: 10, onTick: line });

// 7 ───────────────────────────────────────────────────────────────────────
title('Đá vôi (CaCO3) 0,5 g vào 10 mL HCl 1M');
new Vessel()
  .addSolution({ HCl: 1 }, 0.01)
  .addSolid('CaCO3', gramsToMol('CaCO3', 0.5), 'granule')
  .run(240, { every: 30, onTick: line });

// 8 ───────────────────────────────────────────────────────────────────────
title('"Mưa vàng": Pb(NO3)2 + KI → PbI2, đun nóng rồi để nguội');
{
  const v = new Vessel();
  v.addSolution({ 'Pb(NO3)2': 0.01 }, 0.01).addSolution({ KI: 0.02 }, 0.01);
  line(v.observe());
  v.heaterW = 50;
  console.log('  — đun bằng đèn cồn —');
  v.runUntil((x) => x.mix.tempK > 363, 600, 0.1);
  line(v.observe());
  v.heaterW = 0;
  console.log('  — tắt đèn, để nguội —');
  v.run(900, { dt: 0.25, every: 300, onTick: line });
}
console.log();
