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
  /** Phát một thí nghiệm mẫu và chụp ảnh giữa chừng: node scripts/shot.mjs <url> <dir> recipe:<id> */
  async recipe(id) {
    await lab((rid) => { const p = window.__lab.player; p.play(window.__lab.recipes.find((r) => r.id === rid)); }, id);
    await sleep(8000);
    await shot(`recipe-${id}`);
  },
};
const [name, arg] = scenario.split(':');
await scenarios[name](arg);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
