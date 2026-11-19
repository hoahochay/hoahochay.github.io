/**
 * Giọng đọc lời thuyết minh: phát file âm thanh tạo sẵn (public/tts, xem scripts/tts.py).
 * Câu nào chưa có file thì im lặng (trình phát quay về thời gian đọc ước lượng).
 */
import { clipKey, speechText } from './speech';

const KEY = 'lab-voice';

interface Index { voice: string; clips: Record<string, number> }

export class Narrator {
  private index: Index | null = null;
  private loading: Promise<void> | null = null;
  private audio: HTMLAudioElement | null = null;
  private done: (() => void) | null = null;
  enabled: boolean;

  constructor() {
    let on = true;
    try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* bộ nhớ bị chặn */ }
    this.enabled = on;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* bộ nhớ bị chặn */ }
    if (!on) this.stop();
  }

  /** Tải danh sách file (một lần) */
  load(): Promise<void> {
    this.loading ??= fetch('tts/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Index | null) => { this.index = j; })
      .catch(() => { this.index = null; });
    return this.loading;
  }

  /** Thời lượng đoạn đọc của câu (giây), null nếu không có file */
  duration(text: string): number | null {
    return this.index?.clips[clipKey(speechText(text))] ?? null;
  }

  /**
   * Đọc câu. `spoken`: có file đọc cho câu này (và đang bật giọng đọc);
   * `ended` xong khi đọc hết hoặc bị dừng (ngay lập tức nếu không đọc).
   */
  speak(text: string): { spoken: boolean; ended: Promise<void> } {
    this.stop();
    if (!this.enabled || !text) return { spoken: false, ended: Promise.resolve() };
    const key = clipKey(speechText(text));
    if (!this.index?.clips[key]) return { spoken: false, ended: Promise.resolve() };
    const a = new Audio(`tts/${key}.mp3`);
    this.audio = a;
    const ended = new Promise<void>((resolve) => {
      this.done = resolve;
      a.onended = a.onerror = () => { if (this.audio === a) this.finish(); };
    });
    // Trình duyệt chặn tự phát nếu chưa có thao tác của người dùng: coi như đọc xong
    a.play().catch(() => { if (this.audio === a) this.finish(); });
    return { spoken: true, ended };
  }

  get speaking(): boolean {
    return this.audio !== null;
  }

  pause(paused: boolean): void {
    if (!this.audio) return;
    if (paused) this.audio.pause();
    else {
      const a = this.audio;
      void a.play().catch(() => { if (this.audio === a) this.finish(); });
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.finish();
  }

  private finish(): void {
    this.audio = null;
    const d = this.done;
    this.done = null;
    d?.();
  }
}
