/** Phát lại thí nghiệm mẫu: chạy từng bước, hiển thị lời thuyết minh, kết luận */
import type { ToolKind } from './probes';
import { describeStep } from './narration';
import { copyText, shareUrl } from './router';
import { BookId, BOOKS, gradeOf, LabState, LESSONS, LessonId, Recipe, RECIPES, Step } from './recipes';
import { Narrator } from './voice';

const BOOK_KEY = 'lab-book';
function savedBook(): BookId {
  try {
    const b = localStorage.getItem(BOOK_KEY);
    if (b && b in BOOKS) return b as BookId;
  } catch { /* bộ nhớ trình duyệt bị chặn */ }
  return 'kntt';
}

/** Những gì trình phát cần từ phòng thí nghiệm (main.ts cung cấp) */
export interface LabApi {
  add(chem: string, amount: number, vessel: number): void;
  setHeat(vessel: number, on: boolean): void;
  stir(vessel: number): void;
  probe(tool: ToolKind, vessel: number): void;
  /** Kẹp mẩu chất rắn đốt trên ngọn lửa đèn cồn */
  burn(chem: string): void;
  connect(src: number, dst: number | null): void;
  invert(vessel: number): void;
  /** Đặt dụng cụ lên cân điện tử; null: lấy xuống */
  weigh(vessel: number | null): void;
  /** Bấm nút trừ bì của cân */
  tare(): void;
  focus(vessels: number[] | null): void;
  resetAll(): void;
  setSpeed(s: number): void;
  simTime(): number;
  busy(): boolean;
  state: LabState;
}

class Abort extends Error {}

const FAST = 60;

/** Thời gian đọc một câu thuyết minh (giây), khoảng 15 kí tự mỗi giây */
function readTime(text: string): number {
  return Math.min(10, Math.max(3, text.length / 15));
}
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
  /** Giọng đọc lời thuyết minh */
  readonly voice = new Narrator();
  /** Bước hiện tại đang được đọc thành tiếng */
  private spoken = false;
  /** Gọi khi bắt đầu (recipe) hoặc dừng (null) một thí nghiệm, để cập nhật đường dẫn */
  onChange: (r: Recipe | null) => void = () => {};

  constructor(private readonly lab: LabApi, listRoot: HTMLElement) {
    this.ui = new RecipeUi(listRoot, {
      play: (r) => void this.play(r),
      pause: () => this.togglePause(),
      skip: () => (this.skip = true),
      stop: () => this.stop(),
      share: (r) => this.share(r),
      voice: () => {
        this.voice.setEnabled(!this.voice.enabled);
        this.ui.setVoice(this.voice.enabled);
      },
      closed: () => this.voice.stop(),
    });
    this.ui.setVoice(this.voice.enabled);
  }

  /** Thí nghiệm đang chạy */
  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  get playing(): boolean {
    return this.current !== null;
  }

  async play(r: Recipe): Promise<void> {
    const id = ++this.runId;
    this.current = r;
    this.paused = false;
    this.ui.start(r);
    this.onChange(r);
    this.lab.resetAll();
    this.setSpeed(1);
    await this.voice.load();
    try {
      for (let i = 0; i < r.steps.length; i++) {
        const step = r.steps[i];
        this.skip = false;
        const text = describeStep(step);
        this.ui.step(i, r.steps.length, text);
        this.spoken = this.voice.speak(text).spoken;
        const t0 = performance.now();
        await this.exec(step, id);
        if (this.spoken) {
          // Có giọng đọc: chờ đọc hết câu rồi mới sang bước sau
          await this.untilSpoken(id);
          await this.hold(step.kind === 'focus' ? 0.2 : 0.5, id);
        } else if (step.kind !== 'wait' && step.kind !== 'focus' && step.kind !== 'say') {
          // Bước thao tác (không phải bước chờ có đồng hồ): giữ lời thuyết minh đủ lâu để đọc hết
          const shown = (performance.now() - t0) / 1000;
          await this.hold(Math.max(1.2, readTime(text) - shown), id);
        } else await this.hold(step.kind === 'focus' ? 0.2 : 0.8, id);
      }
      this.setSpeed(1);
      this.current = null;
      this.ui.finish(r);
      this.voice.speak(r.result.explain);
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
  }

  stop(): void {
    this.runId++;
    this.current = null;
    this.paused = false;
    this.setSpeed(1);
    this.voice.stop();
    this.ui.hide();
    this.onChange(null);
  }

  /** Thông báo ngắn giữa màn hình */
  toast(text: string): void {
    this.ui.toast(text);
  }

  /** Sao chép link tới thí nghiệm để gửi cho người khác */
  private async share(r: Recipe): Promise<void> {
    const ok = await copyText(shareUrl({ view: 'lab', tab: 'recipes', recipe: r.id }));
    this.ui.toast(ok ? 'Đã sao chép link thí nghiệm' : 'Không sao chép được, hãy copy từ thanh địa chỉ');
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.lab.setSpeed(this.paused ? 0 : this.stepSpeed);
    this.voice.pause(this.paused);
    this.ui.setPaused(this.paused);
  }

  private setSpeed(s: number): void {
    this.stepSpeed = s;
    if (!this.paused) this.lab.setSpeed(s);
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

  /** Chờ giọng đọc đọc hết câu hiện tại; bấm "bỏ qua" thì ngắt */
  private async untilSpoken(id: number): Promise<void> {
    while (this.voice.speaking) {
      if (this.skip) this.voice.stop();
      await frame();
      this.check(id);
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
        return this.hold(this.spoken ? (s.hold ?? 0) : (s.hold ?? readTime(s.text)), id);
      case 'focus':
        this.lab.focus(s.vessels);
        return this.hold(0.9, id);
      case 'add':
        this.ui.progress(null);
        this.lab.add(s.chem, s.amount, s.vessel);
        return this.untilIdle(id);
      case 'burn':
        this.ui.progress(null);
        this.lab.burn(s.chem);
        return this.untilIdle(id);
      case 'heat':
        this.ui.progress(null);
        this.lab.setHeat(s.vessel, s.on);
        return this.untilIdle(id);
      case 'stir':
        this.ui.progress(null);
        this.lab.stir(s.vessel);
        return this.untilIdle(id);
      case 'connect':
        this.ui.progress(null);
        this.lab.connect(s.src, s.dst);
        return this.untilIdle(id);
      case 'invert':
        this.ui.progress(null);
        this.lab.invert(s.vessel);
        return this.untilIdle(id);
      case 'weigh':
        this.ui.progress(null);
        this.lab.weigh(s.vessel);
        return this.untilIdle(id);
      case 'tare':
        this.ui.progress(null);
        this.lab.tare();
        return this.untilIdle(id);
      case 'probe':
        this.ui.progress(null);
        this.lab.probe(s.tool, s.vessel);
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
  share(r: Recipe): void;
  /** Bật/tắt giọng đọc */
  voice(): void;
  /** Đóng bảng kết luận */
  closed(): void;
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
          <button class="rb-voice" title="Bật / tắt giọng đọc">🔊</button>
          <button class="rb-share" title="Sao chép link tới thí nghiệm này">🔗</button>
          <button class="rb-stop" title="Dừng thí nghiệm mẫu">✕</button>
        </div>
      </div>
      <div class="rb-text"></div>
      <div class="rb-progress"><div class="rb-fill"></div><span class="rb-time"></span></div>`;
    this.q<HTMLButtonElement>('.rb-pause').onclick = () => h.pause();
    this.q<HTMLButtonElement>('.rb-skip').onclick = () => h.skip();
    this.q<HTMLButtonElement>('.rb-stop').onclick = () => h.stop();
    this.q<HTMLButtonElement>('.rb-voice').onclick = () => h.voice();
    this.q<HTMLButtonElement>('.rb-share').onclick = () => this.current && h.share(this.current);
  }

  private current: Recipe | null = null;

  /** Thông báo ngắn ở giữa màn hình */
  toast(text: string): void {
    const t = document.createElement('div');
    t.className = 'toast card';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1600);
    setTimeout(() => t.remove(), 2100);
  }

  private q<T extends HTMLElement>(sel: string): T {
    return this.bar.querySelector(sel) as T;
  }

  private gradeFilter: number | 'all' = 'all';
  /** Bộ sách đang xem */
  private book: BookId = savedBook();

  private setBook(b: BookId): void {
    if (b === this.book) return;
    this.book = b;
    try { localStorage.setItem(BOOK_KEY, b); } catch { /* bỏ qua */ }
    this.renderList();
  }

  private renderList(): void {
    const inBook = RECIPES.filter((r) => LESSONS[r.lesson].book === this.book);
    const grades = [...new Set(inBook.map(gradeOf))].sort((a, b) => a - b);
    if (this.gradeFilter !== 'all' && !grades.includes(this.gradeFilter)) this.gradeFilter = 'all';
    const shown = inBook.filter((r) => this.gradeFilter === 'all' || gradeOf(r) === this.gradeFilter);
    const lessons = (Object.keys(LESSONS) as LessonId[]).filter((t) => shown.some((r) => r.lesson === t));
    const chip = (v: number | 'all', label: string) =>
      `<button class="r-lv${this.gradeFilter === v ? ' on' : ''}" data-grade="${v}">${label}</button>`;
    this.listRoot.innerHTML =
      `<div class="chem-hint">Chọn một thí nghiệm, chương trình sẽ tự làm từng bước để bạn quan sát. Các thí nghiệm theo sách giáo khoa, xếp theo bài học.</div>
      <div class="r-books">${(Object.keys(BOOKS) as BookId[]).map((b) =>
        `<button class="r-book${this.book === b ? ' on' : ''}" data-book="${b}">${BOOKS[b]}</button>`).join('')}</div>
      <div class="r-levels">${chip('all', 'Tất cả các lớp')}${grades.map((g) => chip(g, `Lớp ${g}`)).join('')}</div>` +
      (shown.length ? '' : '<div class="chem-hint">Bộ sách này chưa có thí nghiệm nào.</div>') +
      lessons.map((t) => `
        <div class="r-topic">${LESSONS[t].title}</div>` +
        shown.filter((r) => r.lesson === t).map((r) => `
        <div class="recipe" data-id="${r.id}">
          <div class="r-title">${r.title}</div>
          <div class="r-tags"><span class="grade">Lớp ${gradeOf(r)}</span>${r.concepts.map((c) => `<span>${c}</span>`).join('')}</div>
          <div class="r-sum">${r.summary}</div>
          <div class="r-foot">
            <button class="r-play">▶ Xem thí nghiệm</button>
            <button class="r-share" title="Sao chép link tới thí nghiệm này">🔗</button>
            ${r.page ? `<span class="r-src">SGK tr. ${r.page}</span>` : ''}
          </div>
        </div>`).join('')).join('');
    this.listRoot.querySelectorAll<HTMLButtonElement>('.r-book').forEach((b) => {
      b.onclick = () => this.setBook(b.dataset.book as BookId);
    });
    this.listRoot.querySelectorAll<HTMLButtonElement>('.r-lv').forEach((b) => {
      b.onclick = () => { this.gradeFilter = b.dataset.grade === 'all' ? 'all' : Number(b.dataset.grade); this.renderList(); };
    });
    this.listRoot.querySelectorAll<HTMLElement>('.recipe').forEach((el) => {
      const r = RECIPES.find((x) => x.id === el.dataset.id)!;
      el.querySelector<HTMLButtonElement>('.r-play')!.onclick = () => this.h.play(r);
      el.querySelector<HTMLButtonElement>('.r-share')!.onclick = () => this.h.share(r);
    });
  }

  start(r: Recipe): void {
    this.current = r;
    // Mở bằng link tới bài của bộ sách khác: chuyển danh sách sang bộ sách đó
    this.setBook(LESSONS[r.lesson].book);
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

  private voiceOn = true;

  setVoice(on: boolean): void {
    this.voiceOn = on;
    for (const b of document.querySelectorAll<HTMLButtonElement>('.rb-voice, .rr-voice')) {
      b.textContent = on ? '🔊' : '🔇';
      b.title = on ? 'Tắt giọng đọc' : 'Bật giọng đọc';
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
      <div class="rr-actions"><button class="rr-replay">↻ Xem lại</button><button class="rr-voice" title="Bật / tắt giọng đọc">🔊</button><button class="rr-ok on">Đóng</button></div>`;
    this.result.classList.remove('hidden');
    const close = () => { this.h.closed(); this.hide(); };
    this.result.querySelector<HTMLButtonElement>('.rr-close')!.onclick = close;
    this.result.querySelector<HTMLButtonElement>('.rr-ok')!.onclick = close;
    this.result.querySelector<HTMLButtonElement>('.rr-replay')!.onclick = () => this.h.play(r);
    this.result.querySelector<HTMLButtonElement>('.rr-voice')!.onclick = () => this.h.voice();
    this.setVoice(this.voiceOn);
  }
}
