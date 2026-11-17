/** Phát lại thí nghiệm mẫu: chạy từng bước, hiển thị lời thuyết minh, kết luận */
import { LabState, Recipe, RECIPES, Step } from './recipes';

/** Những gì trình phát cần từ phòng thí nghiệm (main.ts cung cấp) */
export interface LabApi {
  add(chem: string, amount: number, vessel: number): void;
  setHeat(vessel: number, on: boolean): void;
  stir(vessel: number): void;
  focus(vessels: number[] | null): void;
  resetAll(): void;
  setSpeed(s: number): void;
  simTime(): number;
  busy(): boolean;
  state: LabState;
  vesselName(i: number): string;
  chemLabel(key: string, amount: number): string;
}

class Abort extends Error {}

const FAST = 60;
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class RecipePlayer {
  private runId = 0;
  private paused = false;
  private skip = false;
  /** Tốc độ mô phỏng mà bước hiện tại muốn (khôi phục khi bỏ tạm dừng) */
  private stepSpeed = 1;
  private current: Recipe | null = null;
  private readonly ui: RecipeUi;

  constructor(private readonly lab: LabApi, listRoot: HTMLElement) {
    this.ui = new RecipeUi(listRoot, {
      play: (r) => void this.play(r),
      pause: () => this.togglePause(),
      skip: () => (this.skip = true),
      stop: () => this.stop(),
    });
  }

  get playing(): boolean {
    return this.current !== null;
  }

  async play(r: Recipe): Promise<void> {
    const id = ++this.runId;
    this.current = r;
    this.paused = false;
    this.ui.start(r);
    this.lab.resetAll();
    this.setSpeed(1);
    try {
      for (let i = 0; i < r.steps.length; i++) {
        const step = r.steps[i];
        this.skip = false;
        this.ui.step(i, r.steps.length, this.describe(step));
        await this.exec(step, id);
        await this.hold(step.kind === 'focus' ? 0.2 : 0.7, id);
      }
      this.setSpeed(1);
      this.current = null;
      this.ui.finish(r);
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
  }

  stop(): void {
    this.runId++;
    this.current = null;
    this.paused = false;
    this.setSpeed(1);
    this.ui.hide();
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.lab.setSpeed(this.paused ? 0 : this.stepSpeed);
    this.ui.setPaused(this.paused);
  }

  private setSpeed(s: number): void {
    this.stepSpeed = s;
    if (!this.paused) this.lab.setSpeed(s);
  }

  private describe(s: Step): string {
    switch (s.kind) {
      case 'say': return s.text;
      case 'add': return s.text ?? `Cho ${this.lab.chemLabel(s.chem, s.amount)} vào ${this.lab.vesselName(s.vessel).toLowerCase()}.`;
      case 'wait': return s.text ?? 'Quan sát…';
      case 'heat': return s.text ?? (s.on ? 'Đun nóng bằng đèn cồn.' : 'Tắt đèn cồn.');
      case 'stir': return s.text ?? 'Lắc nhẹ cho dung dịch trộn đều.';
      case 'focus': return '';
    }
  }

  private check(id: number): void {
    if (id !== this.runId) throw new Abort();
  }

  /** Chờ một khoảng thời gian thực (không tính lúc tạm dừng) */
  private async hold(seconds: number, id: number): Promise<void> {
    let left = seconds;
    let last = performance.now();
    while (left > 0 && !this.skip) {
      const now = await frame();
      this.check(id);
      if (!this.paused) left -= (now - last) / 1000;
      last = now;
    }
  }

  private async untilIdle(id: number): Promise<void> {
    while (this.lab.busy()) {
      await frame();
      this.check(id);
    }
  }

  private async exec(s: Step, id: number): Promise<void> {
    switch (s.kind) {
      case 'say':
        this.ui.progress(null);
        return this.hold(s.hold ?? Math.min(7, Math.max(2.5, s.text.length * 0.045)), id);
      case 'focus':
        this.lab.focus(s.vessels);
        return this.hold(0.9, id);
      case 'add':
        this.ui.progress(null);
        this.lab.add(s.chem, s.amount, s.vessel);
        return this.untilIdle(id);
      case 'heat':
        this.ui.progress(null);
        this.lab.setHeat(s.vessel, s.on);
        return this.untilIdle(id);
      case 'stir':
        this.ui.progress(null);
        this.lab.stir(s.vessel);
        return this.untilIdle(id);
      case 'wait': {
        const speed = s.speed ?? 1;
        this.setSpeed(speed);
        const start = this.lab.simTime();
        for (;;) {
          const elapsed = this.lab.simTime() - start;
          this.ui.progress(Math.min(1, elapsed / s.seconds), `${fmtTime(elapsed)} / ${fmtTime(s.seconds)}` + (this.stepSpeed > 1 ? ` · tua ${this.stepSpeed}×` : ''));
          if (elapsed >= s.seconds || s.until?.(this.lab.state)) break;
          if (this.skip && this.stepSpeed < FAST) this.setSpeed(FAST);
          await frame();
          this.check(id);
        }
        this.setSpeed(1);
        return;
      }
    }
  }
}

// ── Giao diện ────────────────────────────────────────────────────────────

interface UiHandlers {
  play(r: Recipe): void;
  pause(): void;
  skip(): void;
  stop(): void;
}

class RecipeUi {
  private readonly bar: HTMLElement;
  private readonly result: HTMLElement;

  constructor(private readonly listRoot: HTMLElement, private readonly h: UiHandlers) {
    this.renderList();
    this.bar = document.getElementById('recipe-bar')!;
    this.result = document.getElementById('recipe-result')!;
    this.bar.innerHTML = `
      <div class="rb-head">
        <span class="rb-title"></span>
        <span class="rb-count"></span>
        <div class="rb-ctrl">
          <button class="rb-pause" title="Tạm dừng / tiếp tục">⏸</button>
          <button class="rb-skip" title="Bỏ qua / tua nhanh bước này">⏭</button>
          <button class="rb-stop" title="Dừng thí nghiệm mẫu">✕</button>
        </div>
      </div>
      <div class="rb-text"></div>
      <div class="rb-progress"><div class="rb-fill"></div><span class="rb-time"></span></div>`;
    this.q<HTMLButtonElement>('.rb-pause').onclick = () => h.pause();
    this.q<HTMLButtonElement>('.rb-skip').onclick = () => h.skip();
    this.q<HTMLButtonElement>('.rb-stop').onclick = () => h.stop();
  }

  private q<T extends HTMLElement>(sel: string): T {
    return this.bar.querySelector(sel) as T;
  }

  private renderList(): void {
    this.listRoot.innerHTML = `<div class="chem-hint">Chọn một thí nghiệm, chương trình sẽ tự làm từng bước để bạn quan sát.</div>` +
      RECIPES.map((r) => `
        <div class="recipe" data-id="${r.id}">
          <div class="r-title">${r.title}</div>
          <div class="r-tags"><span>${r.level}</span><span>${r.topic}</span></div>
          <div class="r-sum">${r.summary}</div>
          <button class="r-play">▶ Xem thí nghiệm</button>
        </div>`).join('');
    this.listRoot.querySelectorAll<HTMLElement>('.recipe').forEach((el) => {
      const r = RECIPES.find((x) => x.id === el.dataset.id)!;
      el.querySelector<HTMLButtonElement>('.r-play')!.onclick = () => this.h.play(r);
    });
  }

  start(r: Recipe): void {
    this.result.classList.add('hidden');
    this.bar.classList.remove('hidden');
    this.q('.rb-title').textContent = r.title;
    this.setPaused(false);
    this.listRoot.querySelectorAll<HTMLElement>('.recipe').forEach((el) => el.classList.toggle('active', el.dataset.id === r.id));
  }

  step(i: number, n: number, text: string): void {
    this.q('.rb-count').textContent = `Bước ${i + 1}/${n}`;
    if (text) this.q('.rb-text').textContent = text;
  }

  progress(f: number | null, label = ''): void {
    const p = this.q('.rb-progress');
    p.style.visibility = f === null ? 'hidden' : 'visible';
    if (f !== null) {
      this.q('.rb-fill').style.width = `${(f * 100).toFixed(1)}%`;
      this.q('.rb-time').textContent = label;
    }
  }

  setPaused(p: boolean): void {
    this.q('.rb-pause').textContent = p ? '▶' : '⏸';
  }

  hide(): void {
    this.bar.classList.add('hidden');
    this.result.classList.add('hidden');
    this.listRoot.querySelectorAll('.recipe.active').forEach((el) => el.classList.remove('active'));
  }

  finish(r: Recipe): void {
    this.bar.classList.add('hidden');
    this.result.innerHTML = `
      <div class="rr-head"><span>✔ Kết luận</span><button class="rr-close" title="Đóng">×</button></div>
      <div class="rr-title">${r.title}</div>
      <div class="sec">Hiện tượng</div>
      <ul>${r.result.phenomena.map((p) => `<li>${p}</li>`).join('')}</ul>
      <div class="sec">Phương trình hóa học</div>
      ${r.result.equations.map((e) => `<div class="eq">${e}</div>`).join('<br>')}
      <div class="sec">Giải thích</div>
      <p>${r.result.explain}</p>
      <div class="rr-actions"><button class="rr-replay">↻ Xem lại</button><button class="rr-ok on">Đóng</button></div>`;
    this.result.classList.remove('hidden');
    const close = () => this.hide();
    this.result.querySelector<HTMLButtonElement>('.rr-close')!.onclick = close;
    this.result.querySelector<HTMLButtonElement>('.rr-ok')!.onclick = close;
    this.result.querySelector<HTMLButtonElement>('.rr-replay')!.onclick = () => this.h.play(r);
  }
}
