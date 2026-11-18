/**
 * Giao diện ghi thí nghiệm tự làm: thanh "đang ghi" và hộp chia sẻ (đặt tiêu đề, tạo link).
 * Phần ghi thao tác nằm ở share.ts (Recorder), main.ts nối các thao tác vào.
 */
import { copyText } from './router';
import type { Step } from './recipes';
import { TITLE_MAX } from './share';

export interface RecordHandlers {
  /** Chèn câu hỏi "đoán xem" trước thao tác tiếp theo */
  predict(): void;
  /** Dừng ghi, mở hộp chia sẻ */
  finish(): void;
  cancel(): void;
}

export class RecordBar {
  private readonly root: HTMLElement;

  constructor(h: RecordHandlers) {
    this.root = document.createElement('div');
    this.root.id = 'rec-bar';
    this.root.className = 'card hidden';
    this.root.innerHTML = `
      <span class="rec-dot"></span><span class="rec-label">Đang ghi</span><span class="rec-count"></span>
      <button class="rec-ask" title="Người xem sẽ được hỏi đoán hiện tượng trước thao tác tiếp theo của em">🤔 Đố bạn đoán</button>
      <button class="rec-done on" title="Dừng ghi và tạo link chia sẻ">⏹ Xong</button>
      <button class="rec-cancel" title="Hủy, không lưu">✕</button>`;
    document.body.appendChild(this.root);
    this.q('.rec-ask').onclick = () => h.predict();
    this.q('.rec-done').onclick = () => h.finish();
    this.q('.rec-cancel').onclick = () => h.cancel();
  }

  private q(sel: string): HTMLButtonElement {
    return this.root.querySelector(sel) as HTMLButtonElement;
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
    document.body.classList.toggle('recording', on);
  }

  /** Số thao tác đã ghi; askPending: đã chèn câu hỏi, chờ thao tác tiếp theo */
  update(actions: number, askPending: boolean): void {
    this.q('.rec-count').textContent = ` · ${actions} thao tác`;
    const ask = this.q('.rec-ask');
    ask.disabled = askPending;
    ask.textContent = askPending ? '🤔 Sẽ hỏi trước thao tác tiếp theo' : '🤔 Đố bạn đoán';
  }
}

export interface ShareHandlers {
  preview(title: string): void;
  /** Tạo chuỗi link (đã mã hóa) */
  link(title: string): Promise<string>;
}

/** Hộp chia sẻ sau khi ghi xong */
export class ShareDialog {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'share-dialog';
    this.root.className = 'hidden';
    document.body.appendChild(this.root);
  }

  open(steps: Step[], h: ShareHandlers): void {
    const actions = steps.filter((s) => s.kind !== 'wait' && s.kind !== 'predict').length;
    const asks = steps.filter((s) => s.kind === 'predict').length;
    this.root.innerHTML = `
      <div class="sd-card card" role="dialog" aria-label="Chia sẻ thí nghiệm">
        <div class="rr-head"><span>🎬 Chia sẻ thí nghiệm của em</span><button class="sd-x" title="Đóng">×</button></div>
        <label class="sd-label">Tên thí nghiệm
          <input class="sd-title" maxlength="${TITLE_MAX}" placeholder="Ví dụ: Thử đun nóng nước vôi trong">
        </label>
        <div class="sd-meta"><span class="sd-n"></span></div>
        <div class="sd-actions">
          <button class="sd-preview">▶ Xem thử</button>
          <button class="sd-make on">🔗 Tạo link</button>
        </div>
        <div class="sd-out hidden">
          <input class="sd-url" readonly>
          <button class="sd-copy">Sao chép</button>
        </div>
        <div class="sd-note">Toàn bộ thí nghiệm nằm ngay trong link, không lưu trên máy chủ nào. Link đã gửi đi thì không thu hồi được, nên đừng ghi thông tin cá nhân vào tên thí nghiệm.</div>
      </div>`;
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    q('.sd-n').textContent = `${actions} thao tác${asks ? `, ${asks} câu đố đoán hiện tượng` : ''}`;
    const title = q<HTMLInputElement>('.sd-title');
    title.oninput = () => q('.sd-out').classList.add('hidden');
    title.onkeydown = (e) => e.stopPropagation();
    const close = () => this.root.classList.add('hidden');
    q('.sd-x').onclick = close;
    this.root.onclick = (e) => { if (e.target === this.root) close(); };
    q('.sd-preview').onclick = () => { close(); h.preview(title.value); };
    const url = q<HTMLInputElement>('.sd-url');
    const copy = async () => {
      const ok = await copyText(url.value);
      q('.sd-copy').textContent = ok ? '✔ Đã sao chép' : 'Hãy tự sao chép';
    };
    q('.sd-make').onclick = async () => {
      url.value = await h.link(title.value);
      q('.sd-out').classList.remove('hidden');
      q('.sd-copy').textContent = 'Sao chép';
      url.select();
      await copy();
    };
    q('.sd-copy').onclick = () => void copy();
    this.root.classList.remove('hidden');
    title.focus();
  }
}
