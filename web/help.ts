/** Hướng dẫn thao tác trong phòng thí nghiệm: tự mở ở lần đầu, mở lại bằng nút ❓ hoặc phím H */

const SEEN_KEY = 'lab-help-seen-v1';

const HTML = `
  <div class="help-box card" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <div class="help-head">
      <h2 id="help-title">Hướng dẫn thao tác</h2>
      <button class="help-close" title="Đóng (Esc)">✕</button>
    </div>
    <div class="help-body">
      <section>
        <h3>🎥 Góc nhìn</h3>
        <table class="keys">
          <tr><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> hoặc <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></td><td>Di chuyển tới, trái, lui, phải</td></tr>
          <tr><td>Kéo <b>chuột phải</b></td><td>Di chuyển (kéo cả bàn thí nghiệm)</td></tr>
          <tr><td>Kéo <b>chuột trái</b></td><td>Xoay quanh bàn</td></tr>
          <tr><td>Lăn <b>con lăn</b></td><td>Phóng to, thu nhỏ</td></tr>
          <tr><td><kbd>R</kbd></td><td>Về góc nhìn toàn cảnh</td></tr>
          <tr><td>🔍 Nhìn gần</td><td>Nhìn gần dụng cụ đang chọn (bấm lần nữa để trở lại)</td></tr>
        </table>
      </section>
      <section>
        <h3>🧪 Dụng cụ chứa</h3>
        <p>Bàn có 4 ống nghiệm, 1 cốc 100 mL và 1 bình nón 100 mL. <b>Bấm vào</b> một dụng cụ để chọn (hoặc phím <kbd>1</kbd>–<kbd>6</kbd>); bảng bên phải hiện nhiệt độ, pH, màu và các chất bên trong.</p>
      </section>
      <section>
        <h3>⚗️ Cho hóa chất</h3>
        <ol>
          <li>Mở <b>Kho hóa chất</b> bên trái, tìm theo tên (gõ được cả tên cũ như "natri", "axit") hoặc công thức.</li>
          <li>Nhập lượng (mL, giọt hoặc g).</li>
          <li><b>Kéo thả</b> lọ hoặc đĩa mẫu vào dụng cụ. Viền xanh lá hiện ra khi thả đúng chỗ.</li>
        </ol>
      </section>
      <section>
        <h3>🔧 Dụng cụ thí nghiệm</h3>
        <p>Cũng nằm trong kho, mục <b>Dụng cụ</b>. Kéo thả vào dụng cụ chứa:</p>
        <ul>
          <li><b>Que đóm, giấy quỳ ẩm</b>: đưa vào miệng ống để thử khí.</li>
          <li><b>Ống dẫn khí</b>: thả vào ống phát khí, rồi bấm vào nơi nhận khí (ống khác, cốc, hoặc xi lanh). Thả lần nữa để tháo.</li>
          <li><b>Xi lanh đo khí</b>: đậy nút dụng cụ và dẫn khí sang xi lanh; bảng đo hiện đồ thị thể tích theo thời gian.</li>
          <li><b>Cân điện tử</b>: đặt dụng cụ lên cân (hoặc chọn dụng cụ rồi bấm vào cân). Nút <b>Trừ bì</b> đưa số đọc về 0,00 g.</li>
        </ul>
        <p>Bảng đo ở góc phải dưới có đồ thị, bảng số mỗi 10 giây và nút tải về CSV.</p>
      </section>
      <section>
        <h3>🛠 Thanh công cụ dưới cùng</h3>
        <ul>
          <li><b>Khuấy</b>, <b>Đun</b> (hoặc bấm vào đèn cồn), <b>Đổ bỏ</b>, <b>Úp ống</b> (để thu khí nhẹ như H₂), <b>Nhìn gần</b>: tác dụng lên dụng cụ đang chọn.</li>
          <li>Tốc độ thời gian <b>1×</b> đến <b>60×</b> để tua nhanh phản ứng chậm; <kbd>Space</kbd> tạm dừng / chạy tiếp.</li>
        </ul>
      </section>
      <section>
        <h3>▶ Thí nghiệm mẫu</h3>
        <p>Tab <b>Thí nghiệm mẫu</b> có các bài dựa trên RSC Education, xếp theo chủ đề và lọc theo mức độ. Chương trình tự làm từng bước; dùng ⏸ tạm dừng, ⏭ tua nhanh bước hiện tại, ✕ dừng. Cuối bài có phần kết luận và phương trình.</p>
      </section>
      <section>
        <h3>📋 Nhật ký hiện tượng</h3>
        <p>Mọi thao tác và hiện tượng (sủi bọt, kết tủa, đổi màu, nóng lên…) được ghi lại ở bảng bên phải, kèm thời điểm.</p>
      </section>
    </div>
    <div class="help-foot"><span class="muted">Mở lại bất cứ lúc nào bằng nút ❓ hoặc phím <kbd>H</kbd>.</span><button class="help-ok">Bắt đầu</button></div>
  </div>`;

export class HelpOverlay {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'help';
    this.root.className = 'hidden';
    this.root.innerHTML = HTML;
    document.body.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.root || t.closest('.help-close, .help-ok')) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(): void {
    this.root.classList.remove('hidden');
    this.root.querySelector<HTMLButtonElement>('.help-ok')!.focus();
  }

  close(): void {
    this.root.classList.add('hidden');
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch { /* trình duyệt chặn lưu trữ: lần sau vẫn hiện, không sao */ }
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Lần đầu vào phòng thí nghiệm thì tự mở */
  openIfFirstVisit(): void {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch { /* bỏ qua */ }
    if (!seen) this.open();
  }
}
