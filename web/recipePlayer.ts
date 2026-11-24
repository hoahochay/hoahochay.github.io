/** Phát lại thí nghiệm mẫu: chạy từng bước, hiển thị lời thuyết minh, kết luận */
import type { ToolKind } from './probes';
import { describeStep } from './narration';
import { displayText } from './speech';
import { copyText, shareUrl } from './router';
import { BuretteAction, CATEGORIES, categoryOf, CategoryId, LabState, PlayScript, Recipe, RECIPES, Step, TOPICS, TopicId } from './recipes';
import { Narrator } from './voice';

type Tab = CategoryId | 'all';
const TAB_KEY = 'lab-tab';
const TABS: Tab[] = ['all', 10, 11, 12, 'explore'];
const tabLabel = (t: Tab) => (t === 'all' ? 'Tất cả' : CATEGORIES[t]);
function savedTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    const found = TABS.find((x) => String(x) === t);
    if (found !== undefined) return found;
  } catch { /* bộ nhớ trình duyệt bị chặn */ }
  return 'all';
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
  /** Đặt dụng cụ lên cân điện tử (tối đa hai ống nghiệm); off: lấy dụng cụ đó xuống; null: lấy tất cả xuống */
  weigh(vessel: number | null, off?: boolean): void;
  /** Đổ bỏ, tráng sạch dụng cụ */
  empty(vessel: number): void;
  /** Đổ hết chất lỏng từ dụng cụ này sang dụng cụ khác */
  pour(src: number, dst: number, mL?: number): void;
  focus(vessels: number[] | null): void;
  /** Vặn khóa burette lắp trên dụng cụ */
  burette(vessel: number, action: BuretteAction): void;
  /** Tua nhanh thời gian (giây) */
  timelapse(seconds: number): void;
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
const isRecipe = (r: PlayScript): r is Recipe => 'lesson' in r;
/** Bước thao tác thật (không phải lời thuyết minh, chờ, đổi góc nhìn, câu hỏi) */
const isAction = (s: Step) => !['say', 'wait', 'focus', 'predict'].includes(s.kind);

/** Chống chèn HTML khi hiển thị chữ do người dùng nhập (tiêu đề, câu trả lời) */
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Thí nghiệm tự làm: mỗi đoạn quan sát dài khoảng chừng này giây (tua nhanh nếu cần), mỗi thao tác giữ chừng này giây */
const SHARED_WAIT_S = 5;
const SHARED_HOLD_S = 1.5;

function fmtTime(t: number): string {
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  // Sau khi tua nhanh nhiều giờ, nhiều ngày: hiển thị giờ:phút:giây
  if (t >= 3600) return `${Math.floor(t / 3600)}:${Math.floor((t % 3600) / 60).toString().padStart(2, '0')}:${s}`;
  return `${Math.floor(t / 60)}:${s}`;
}

export class RecipePlayer {
  private runId = 0;
  private paused = false;
  private skip = false;
  /** Tốc độ mô phỏng mà bước hiện tại muốn (khôi phục khi bỏ tạm dừng) */
  private stepSpeed = 1;
  private current: PlayScript | null = null;
  private readonly ui: RecipeUi;
  /** Giọng đọc lời thuyết minh */
  readonly voice = new Narrator();
  /** Bước hiện tại đang được đọc thành tiếng */
  private spoken = false;
  /** Gọi khi bắt đầu (recipe) hoặc dừng (null) một thí nghiệm, để cập nhật đường dẫn */
  onChange: (r: PlayScript | null) => void = () => {};
  /** Nút "Ghi thí nghiệm mới" trong danh sách */
  onRecord: () => void = () => {};

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
      record: () => this.onRecord(),
    });
    this.ui.setVoice(this.voice.enabled);
  }

  /** Thí nghiệm đang chạy */
  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  /** Thí nghiệm đang chạy (cả thí nghiệm chia sẻ) */
  get currentScript(): PlayScript | null {
    return this.current;
  }

  get playing(): boolean {
    return this.current !== null;
  }

  async play(r: PlayScript): Promise<void> {
    const id = ++this.runId;
    this.current = r;
    this.paused = false;
    this.ui.start(r);
    this.onChange(r);
    this.lab.resetAll();
    this.setSpeed(1);
    await this.voice.load();
    // Trong lúc tải giọng đọc, người dùng có thể đã dừng hoặc chuyển sang bài khác
    if (id !== this.runId) return;
    try {
      for (let i = 0; i < r.steps.length; i++) {
        const step = r.steps[i];
        this.skip = false;
        if (step.kind === 'predict') {
          await this.predict(r.steps.slice(i + 1).find(isAction), i, r.steps.length, id);
          continue;
        }
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
          await this.hold(r.shared ? Math.max(0.3, SHARED_HOLD_S - shown) : Math.max(1.2, readTime(displayText(text)) - shown), id);
        } else await this.hold(step.kind === 'focus' ? 0.2 : 0.8, id);
      }
      this.setSpeed(1);
      this.current = null;
      // Đưa địa chỉ về danh sách: dán lại đúng link này sẽ chạy lại (trình duyệt bỏ qua link trùng địa chỉ hiện tại)
      this.onChange(null);
      if (isRecipe(r)) {
        this.ui.finish(r);
        this.voice.speak(r.result.explain);
      } else this.ui.finishShared(r);
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

  /**
   * Dừng mô phỏng, đố người xem bước tiếp theo sẽ thế nào; chạy tiếp khi họ bấm "Xem tiếp".
   * Không cần gõ câu trả lời: chỉ cho thời gian suy nghĩ.
   */
  private async predict(next: Step | undefined, i: number, n: number, id: number): Promise<void> {
    if (!next) return;
    const action = describeStep(next);
    this.voice.stop();
    this.ui.progress(null);
    this.lab.setSpeed(0);
    let done = false;
    this.ui.ask(i, n, action, () => (done = true));
    while (!done && !this.skip) {
      await frame();
      this.check(id);
    }
    this.ui.closeAsk();
    this.lab.setSpeed(this.paused ? 0 : this.stepSpeed);
  }

  /** Sao chép link tới thí nghiệm để gửi cho người khác */
  private async share(r: PlayScript): Promise<void> {
    const ok = await copyText(r.shared
      ? shareUrl({ view: 'lab', tab: 'recipes', shared: r.shared.data })
      : shareUrl({ view: 'lab', tab: 'recipes', recipe: r.id }));
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
        return this.hold(this.spoken ? (s.hold ?? 0) : (s.hold ?? readTime(displayText(s.text))), id);
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
      case 'burette':
        this.ui.progress(null);
        this.lab.burette(s.vessel, s.action);
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
        this.lab.weigh(s.vessel, s.off);
        return this.untilIdle(id);
      case 'empty':
        this.ui.progress(null);
        this.lab.empty(s.vessel);
        return this.untilIdle(id);
      case 'predict':
        return;
      case 'timelapse':
        this.ui.progress(null);
        this.lab.timelapse(s.seconds);
        return;
      case 'pour':
        this.ui.progress(null);
        this.lab.pour(s.src, s.dst, s.mL);
        return this.untilIdle(id);
      case 'probe':
        this.ui.progress(null);
        this.lab.probe(s.tool, s.vessel);
        return this.untilIdle(id);
      case 'wait': {
        // Thí nghiệm tự làm: đoạn quan sát nào cũng dài khoảng 5 giây (thời gian mô phỏng giữ nguyên, chỉ tua nhanh)
        const speed = this.current?.shared ? Math.min(FAST, Math.max(1, Math.ceil(s.seconds / SHARED_WAIT_S))) : s.speed ?? 1;
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
  play(r: PlayScript): void;
  pause(): void;
  skip(): void;
  stop(): void;
  share(r: PlayScript): void;
  /** Bắt đầu ghi một thí nghiệm tự làm */
  record(): void;
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
      <div class="rb-ask hidden">
        <div class="rb-q"></div>
        <div class="rb-ask-row"><button class="rb-go on">Xem tiếp ▶</button></div>
      </div>
      <div class="rb-progress"><div class="rb-fill"></div><span class="rb-time"></span></div>`;
    this.q<HTMLButtonElement>('.rb-pause').onclick = () => h.pause();
    this.q<HTMLButtonElement>('.rb-skip').onclick = () => h.skip();
    this.q<HTMLButtonElement>('.rb-stop').onclick = () => h.stop();
    this.q<HTMLButtonElement>('.rb-voice').onclick = () => h.voice();
    this.q<HTMLButtonElement>('.rb-share').onclick = () => this.current && h.share(this.current);
  }

  private current: PlayScript | null = null;
  private onAnswer: (() => void) | null = null;

  /** Hiện câu hỏi "đoán xem" thay cho lời thuyết minh */
  ask(i: number, n: number, action: string, next: () => void): void {
    this.q('.rb-count').textContent = `Bước ${i + 1}/${n}`;
    this.q('.rb-text').textContent = '🤔 Dừng lại một chút!';
    this.q('.rb-q').textContent = `Bước tiếp theo: ${displayText(action)} Theo em, sẽ có hiện tượng gì?`;
    this.onAnswer = next;
    this.q<HTMLButtonElement>('.rb-go').onclick = () => { this.onAnswer?.(); this.onAnswer = null; };
    this.q('.rb-ask').classList.remove('hidden');
    this.bar.classList.add('asking');
  }

  closeAsk(): void {
    this.onAnswer = null;
    this.q('.rb-ask').classList.add('hidden');
    this.bar.classList.remove('asking');
  }

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

  /** Tab đang xem: tất cả, một lớp, hoặc nhóm Khám phá */
  private tab: Tab = savedTab();

  private setTab(t: Tab): void {
    if (t === this.tab) return;
    this.tab = t;
    try { localStorage.setItem(TAB_KEY, String(t)); } catch { /* bỏ qua */ }
    this.renderList();
  }

  private renderList(): void {
    const shown = RECIPES.filter((r) => this.tab === 'all' || categoryOf(r) === this.tab);
    const topics = (Object.keys(TOPICS) as TopicId[]).filter((t) => shown.some((r) => r.topic === t));
    this.listRoot.innerHTML =
      `<div class="r-mine">
        <div class="r-mine-head">🎬 Thí nghiệm của em</div>
        <div class="r-mine-text">Tự làm một thí nghiệm, chương trình ghi lại từng thao tác thành một link. Gửi link cho bạn bè: máy của bạn sẽ làm lại đúng như vậy, và có thể dừng lại đố bạn đoán trước hiện tượng.</div>
        <button class="r-rec">⏺ Ghi thí nghiệm mới</button>
      </div>
      <div class="chem-hint">Chọn một thí nghiệm, chương trình sẽ tự làm từng bước để bạn quan sát. Thí nghiệm lớp 10 – 12 theo sách giáo khoa; mục Khám phá gồm các thí nghiệm cơ bản để làm quen với hóa học.</div>
      <div class="r-books">${TABS.map((t) =>
        `<button class="r-book${this.tab === t ? ' on' : ''}" data-tab="${t}">${tabLabel(t)}</button>`).join('')}</div>` +
      (shown.length ? '' : '<div class="chem-hint">Mục này đang được soạn, chưa có thí nghiệm nào.</div>') +
      topics.map((t) => `
        <div class="r-topic">${TOPICS[t].title}</div>` +
        shown.filter((r) => r.topic === t).map((r) => `
        <div class="recipe" data-id="${r.id}">
          <div class="r-title">${r.title}</div>
          <div class="r-tags"><span class="grade">${CATEGORIES[categoryOf(r)]}</span>${r.concepts.map((c) => `<span>${c}</span>`).join('')}</div>
          <div class="r-sum">${displayText(r.summary)}</div>
          <div class="r-foot">
            <button class="r-play">▶ Xem thí nghiệm</button>
            <button class="r-share" title="Sao chép link tới thí nghiệm này">🔗</button>
            ${r.page && categoryOf(r) !== 'explore' ? `<span class="r-src">SGK tr. ${r.page}</span>` : ''}
          </div>
        </div>`).join('')).join('');
    this.listRoot.querySelector<HTMLButtonElement>('.r-rec')!.onclick = () => this.h.record();
    this.listRoot.querySelectorAll<HTMLButtonElement>('.r-book').forEach((b) => {
      b.onclick = () => this.setTab(TABS.find((t) => String(t) === b.dataset.tab) ?? 'all');
    });
    this.listRoot.querySelectorAll<HTMLElement>('.recipe').forEach((el) => {
      const r = RECIPES.find((x) => x.id === el.dataset.id)!;
      el.querySelector<HTMLButtonElement>('.r-play')!.onclick = () => this.h.play(r);
      el.querySelector<HTMLButtonElement>('.r-share')!.onclick = () => this.h.share(r);
    });
  }

  start(r: PlayScript): void {
    this.current = r;
    // Mở bằng link tới thí nghiệm ở mục khác: chuyển danh sách sang mục đó
    if (isRecipe(r) && this.tab !== 'all' && this.tab !== categoryOf(r)) this.setTab(categoryOf(r));
    this.closeAsk();
    this.bar.classList.toggle('shared', !!r.shared);
    this.result.classList.add('hidden');
    this.bar.classList.remove('hidden');
    this.q('.rb-title').textContent = r.title;
    this.setPaused(false);
    this.listRoot.querySelectorAll<HTMLElement>('.recipe').forEach((el) => el.classList.toggle('active', el.dataset.id === r.id));
  }

  /** Kết thúc thí nghiệm tự làm (không có kết luận soạn sẵn) */
  finishShared(r: PlayScript): void {
    this.bar.classList.add('hidden');
    this.result.innerHTML = `
      <div class="rr-head"><span>✔ Xong thí nghiệm</span><button class="rr-close" title="Đóng">×</button></div>
      <div class="rr-title">${esc(r.title)}</div>
      <div class="rr-note">Thí nghiệm do người dùng tự làm và chia sẻ. Mọi hiện tượng được máy của em tính lại từ đầu, xem chi tiết trong Nhật ký.</div>
      <div class="rr-actions"><button class="rr-replay">↻ Xem lại</button><button class="rr-link">🔗 Sao chép link</button><button class="rr-ok on">🧪 Tự làm tiếp</button></div>`;
    this.result.classList.remove('hidden');
    const close = () => { this.h.closed(); this.hide(); };
    this.result.querySelector<HTMLButtonElement>('.rr-close')!.onclick = close;
    this.result.querySelector<HTMLButtonElement>('.rr-ok')!.onclick = () => {
      close();
      document.querySelector<HTMLButtonElement>('#left .tabs [data-tab="chem"]')?.click();
    };
    this.result.querySelector<HTMLButtonElement>('.rr-replay')!.onclick = () => this.h.play(r);
    this.result.querySelector<HTMLButtonElement>('.rr-link')!.onclick = () => this.h.share(r);
  }

  step(i: number, n: number, text: string): void {
    this.q('.rb-count').textContent = `Bước ${i + 1}/${n}`;
    if (text) this.q('.rb-text').textContent = displayText(text);
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
      <ul>${r.result.phenomena.map((p) => `<li>${displayText(p)}</li>`).join('')}</ul>
      ${r.result.equations.length ? `<div class="sec">Phương trình hóa học</div>
      ${r.result.equations.map((e) => `<div class="eq">${e}</div>`).join('<br>')}` : ''}
      <div class="sec">Giải thích</div>
      <p>${displayText(r.result.explain)}</p>
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
