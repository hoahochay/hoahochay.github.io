/** Hướng dẫn thao tác trong phòng thí nghiệm: tự mở ở lần đầu, mở lại bằng nút ❓ hoặc phím H */

import { isPhone } from './layout';

const SEEN_KEY = 'lab-help-seen-v1';

/** Nội dung hướng dẫn: máy tính (chuột, bàn phím) hoặc điện thoại (cảm ứng) */
function helpHtml(phone: boolean): string {
  const pick = (pc: string, ph: string) => (phone ? ph : pc);
  const view = phone
    ? `<tr><td>Một ngón vuốt chỗ trống</td><td>Di chuyển cảnh</td></tr>
          <tr><td>Hai ngón chụm / mở</td><td>Phóng to, thu nhỏ</td></tr>
          <tr><td>Hai ngón xoay</td><td>Đổi góc nhìn quanh bàn</td></tr>
          <tr><td>🔍 Nhìn gần</td><td>Nhìn gần dụng cụ đang chọn (chạm lần nữa để trở lại)</td></tr>`
    : `<tr><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> hoặc <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></td><td>Di chuyển tới, trái, lui, phải</td></tr>
          <tr><td>Kéo <b>chuột phải</b></td><td>Di chuyển (kéo cả bàn thí nghiệm)</td></tr>
          <tr><td>Kéo <b>chuột trái</b></td><td>Xoay quanh bàn</td></tr>
          <tr><td>Lăn <b>con lăn</b></td><td>Phóng to, thu nhỏ</td></tr>
          <tr><td><kbd>R</kbd></td><td>Về góc nhìn toàn cảnh</td></tr>
          <tr><td>🔍 Nhìn gần</td><td>Nhìn gần dụng cụ đang chọn (bấm lần nữa để trở lại)</td></tr>`;
  return `
  <div class="help-box card" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <div class="help-head">
      <h2 id="help-title">Hướng dẫn thao tác</h2>
      <button class="help-close" title="Đóng (Esc)">✕</button>
    </div>
    <div class="help-body">
      <section>
        <h3>🎥 Góc nhìn</h3>
        <table class="keys">
          ${view}
        </table>${pick('', `
        <p>Xoay ngang điện thoại để có màn hình rộng hơn: kho mở bên trái, thông tin mở bên phải.</p>`)}
      </section>
      <section>
        <h3>🧪 Dụng cụ chứa</h3>
        <p>Bàn có 4 ống nghiệm, 1 cốc 100 mL và 1 bình nón 100 mL. ${pick(
    '<b>Bấm vào</b> một dụng cụ để chọn (hoặc phím <kbd>1</kbd>–<kbd>6</kbd>); bảng bên phải hiện nhiệt độ, pH, màu và các chất bên trong.',
    '<b>Chạm vào</b> một dụng cụ để chọn; nút <b>ℹ️ Thông tin</b> ở thanh dưới cùng hiện nhiệt độ, pH, màu và các chất bên trong.')}</p>
      </section>
      <section>
        <h3>⚗️ Cho hóa chất</h3>
        <ol>
          <li>${pick('Mở <b>Kho hóa chất</b> bên trái', 'Chạm nút <b>🧪 Kho</b> ở thanh dưới cùng')}, tìm theo tên (gõ được cả tên cũ như "natri", "axit") hoặc công thức.</li>
          <li>Nhập lượng (mL, giọt hoặc g).</li>
          <li>${pick(
    '<b>Kéo thả</b> lọ hoặc đĩa mẫu vào dụng cụ (viền xanh lá hiện ra khi thả đúng chỗ), hoặc <b>bấm chọn</b> lọ rồi bấm vào dụng cụ.',
    '<b>Chạm chọn</b> lọ (kho tự đóng lại) rồi chạm vào dụng cụ. Hoặc <b>giữ ngón tay</b> trên lọ (hay kéo sang ngang) để nhấc lên, rồi kéo thả vào dụng cụ: kho mờ đi để thấy dụng cụ phía sau.')}</li>
        </ol>
      </section>
      <section>
        <h3>🔧 Dụng cụ thí nghiệm</h3>
        <p>Cũng nằm trong kho, mục <b>Dụng cụ</b>. ${pick('Kéo thả', 'Kéo thả hoặc chạm chọn rồi chạm')} vào dụng cụ chứa:</p>
        <ul>
          <li><b>Que đóm, giấy quỳ ẩm</b>: đưa vào miệng ống để thử khí.</li>
          <li><b>Mẩu giấy màu ẩm</b>: đưa vào trong dụng cụ chứa khí; giấy mất màu nếu có khí chlorine (chlorine ẩm có tính tẩy màu).</li>
          <li><b>Giấy quỳ tím</b> (thử dung dịch): thả vào dụng cụ để nhúng đầu mẩu quỳ vào dung dịch; quỳ hóa đỏ với acid, hóa xanh với base. Mẩu quỳ để luôn trong dụng cụ và tiếp tục đổi màu khi dung dịch thay đổi; đổ bỏ dung dịch thì quỳ cũng được bỏ đi.</li>
          <li><b>Giấy pH</b>: dùng như giấy quỳ, giấy đổi màu theo bảng màu chuẩn pH 1 – 14; nhật ký ghi số pH đọc được.</li>
          <li><b>Tờ giấy kẻ chữ X</b>: thả vào ống để đặt tờ giấy phía sau ống; đồng hồ trên tờ giấy bắt đầu chạy khi rót chất tiếp theo vào và dừng lại khi dung dịch đục che khuất chữ X.</li>
          <li><b>Ống dẫn khí</b>: thả vào ống phát khí, rồi ${pick('bấm', 'chạm')} vào nơi nhận khí (ống khác, cốc, hoặc xi lanh). Thả lần nữa để tháo.</li>
          <li><b>Xi lanh đo khí</b>: đậy nút dụng cụ và dẫn khí sang xi lanh; bảng đo hiện đồ thị thể tích theo thời gian.</li>
          <li><b>Cân điện tử</b>: đặt dụng cụ lên cân (hoặc chọn dụng cụ rồi ${pick('bấm', 'chạm')} vào cân). Đĩa cân đặt được một cốc / bình, hoặc hai ống nghiệm cùng lúc. Cân chỉ khối lượng các chất bên trong, không tính khối lượng dụng cụ.</li>
        </ul>
        <p>Bảng đo có đồ thị, bảng số mỗi 10 giây và nút tải về CSV.</p>
      </section>
      <section>
        <h3>🛠 Thanh công cụ dưới cùng</h3>
        <ul>
          <li><b>${pick('Kéo', 'Dùng một ngón kéo')} ống nghiệm, cốc, bình</b> trên bàn: thả vào <b>đèn cồn</b> để đun, thả lên <b>cân</b> để cân, thả lên <b>dụng cụ chứa khác</b> để đổ hết chất lỏng sang đó, thả chỗ khác để cất về chỗ cũ.</li>
          <li><b>Khuấy</b>, <b>Đun</b> (hoặc ${pick('bấm', 'chạm')} vào đèn cồn), <b>Đổ bỏ</b>, <b>Úp ống</b> (để thu khí nhẹ như H₂), <b>Nhìn gần</b>: tác dụng lên dụng cụ đang chọn.</li>
          <li><b>↺ Làm lại</b> (${pick('bấm', 'chạm')} hai lần): xóa sạch phòng thí nghiệm, gồm dụng cụ, hóa chất, nhật ký, đồng hồ và lượng đã nhập trong kho.</li>
          <li>Kéo mẩu kim loại (dải magnesium, dây đồng, đinh sắt…) thả vào <b>đèn cồn</b>: kẹp sắt sẽ giữ mẫu đốt trên ngọn lửa. Dùng <b>nam châm</b> để thử xem trong ống còn sắt không.</li>
          <li>Tốc độ thời gian <b>1×</b> đến <b>60×</b> để tua nhanh phản ứng chậm; ${pick('<kbd>Space</kbd>', 'nút <b>⏸</b>')} tạm dừng / chạy tiếp.</li>
        </ul>
      </section>
      <section>
        <h3>▶ Thí nghiệm mẫu</h3>
        <p>Tab <b>Thí nghiệm mẫu</b>${pick('', ' trong <b>🧪 Kho</b>')} có các thí nghiệm chia theo mục: Lớp 10, Lớp 11, Lớp 12 (theo sách giáo khoa) và Khám phá (các thí nghiệm cơ bản để làm quen với hóa học), xếp theo chủ đề. Chương trình tự làm từng bước, trong lúc đó phòng thí nghiệm chỉ để xem; dùng ⏸ tạm dừng, ⏭ tua nhanh bước hiện tại, ✕ dừng. Lời thuyết minh được đọc thành tiếng; ${pick('bấm', 'chạm')} 🔊 để tắt hoặc bật giọng đọc. Cuối bài có phần kết luận và phương trình. Nút 🔗 sao chép link tới bài để gửi cho bạn bè hoặc học sinh.</p>
      </section>
      <section>
        <h3>🎬 Thí nghiệm của em</h3>
        <p>Trong tab <b>Thí nghiệm mẫu</b>, ${pick('bấm', 'chạm')} <b>⏺ Ghi thí nghiệm mới</b>: bàn được dọn sạch và mọi thao tác của em được ghi lại. Muốn đố bạn, ${pick('bấm', 'chạm')} <b>🤔 Đố bạn đoán</b> ngay trước thao tác quan trọng: người xem sẽ được hỏi đoán hiện tượng rồi mới thấy kết quả. ${pick('Bấm', 'Chạm')} <b>⏹ Xong</b>, đặt tên rồi tạo link để gửi cho bạn bè. Thí nghiệm nằm ngay trong link (không lưu trên máy chủ nào); người mở link sẽ thấy máy của mình làm lại đúng các thao tác đó.</p>
      </section>
      <section>
        <h3>📋 Nhật ký hiện tượng</h3>
        <p>Mọi thao tác và hiện tượng (sủi bọt, kết tủa, đổi màu, nóng lên…) được ghi lại ${pick('ở bảng bên phải', 'trong <b>ℹ️ Thông tin</b>')}, kèm thời điểm.</p>
      </section>
      <section>
        <h3>📬 Liên hệ, góp ý</h3>
        <ul>
          <li>Mã nguồn: <a href="https://github.com/hoahochay/hoahochay.github.io" target="_blank" rel="noopener">github.com/hoahochay/hoahochay.github.io</a></li>
          <li>Email: <a href="mailto:huynq23091@gmail.com">huynq23091@gmail.com</a></li>
        </ul>
      </section>
    </div>
    <div class="help-foot"><span class="muted">Mở lại bất cứ lúc nào bằng nút ❓${pick(' hoặc phím <kbd>H</kbd>', '')}.</span><button class="help-ok">Bắt đầu</button></div>
  </div>`;
}

export class HelpOverlay {
  private readonly root: HTMLElement;
  /** Nội dung đang dựng cho điện thoại hay máy tính (null: chưa dựng) */
  private phone: boolean | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'help';
    this.root.className = 'hidden';
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
    // Dựng lại theo bố cục hiện tại (điện thoại có thể vừa xoay ngang / dọc)
    const phone = isPhone();
    if (this.phone !== phone) {
      this.phone = phone;
      this.root.innerHTML = helpHtml(phone);
    }
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
