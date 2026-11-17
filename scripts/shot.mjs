// Chụp màn hình cảnh 3D bằng Chrome headless.
// Dùng: node scripts/shot.mjs <url> <out-dir> [kịch bản]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url = 'http://localhost:5173', out = 'shots', scenario = 'basic'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,900', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle0' });
const lab = (fn, ...a) => page.evaluate(fn, ...a);
const idle = async () => { await page.waitForFunction(() => !window.__lab.busy(), { timeout: 60000 }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('saved', `${out}/${name}.png`); };

const scenarios = {
  async basic() {
    await sleep(1500);
    await shot('01-overview');
  },
  async reactions() {
    // Ống 1: HCl + Mg ; Ống 2: CuSO4 + NaOH ; Ống 3: CuSO4 + đinh sắt ; Cốc: nước + phenolphtalein + Na
    await lab(() => { window.__lab.select(0); window.__lab.pour('hcl', 5); window.__lab.drop('mg_strip'); });
    await idle();
    await lab(() => { window.__lab.select(1); window.__lab.pour('cuso4', 2); window.__lab.pour('naoh', 2); });
    await idle();
    await lab(() => { window.__lab.select(2); window.__lab.pour('cuso4', 5); window.__lab.drop('fe'); });
    await idle();
    await lab(() => { window.__lab.select(3); window.__lab.pour('pbno3', 5); window.__lab.pour('ki', 5); });
    await idle();
    await lab(() => { window.__lab.select(4); window.__lab.pour('water', 20); window.__lab.pour('water', 20); window.__lab.pour('phenol'); window.__lab.drop('na'); });
    await idle();
    await sleep(1500);
    await shot('02-reactions');
    await lab(() => { window.__lab.select(0); window.__lab.focus(); });
    await sleep(1500);
    await shot('03-closeup-mg');
    await lab(() => { window.__lab.select(1); });
    await sleep(1500);
    await shot('04-closeup-cuoh2');
    await lab(() => { window.__lab.select(4); });
    await sleep(1500);
    await shot('05-closeup-na');
    await lab(() => { window.__lab.select(2); window.__lab.setSpeed(60); });
    await sleep(8000);
    await lab(() => window.__lab.setSpeed(1));
    await shot('06-closeup-nail');
    await lab(() => { window.__lab.select(3); window.__lab.heat(); window.__lab.setSpeed(20); });
    await idle();
    await sleep(1500);
    await lab(() => window.__lab.setSpeed(1));
    await shot('07-heating-pbi2');
  },
};
await scenarios[scenario]();
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
