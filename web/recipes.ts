/**
 * Thí nghiệm mẫu: chuỗi thao tác + lời thuyết minh, phát lại tự động cho học sinh xem.
 * Ống nghiệm đánh số 0–3, cốc là 4, bình nón là 5; xi lanh đo khí là SYRINGE.
 */
import { Mixture } from '../src';
import type { ToolKind } from './probes';

export const TUBE1 = 0, TUBE2 = 1, TUBE3 = 2, TUBE4 = 3, BEAKER = 4, FLASK = 5;
/** Đích của bước `connect`: xi lanh đo khí (không phải dụng cụ chứa) */
export const SYRINGE = -1;

/** Trạng thái phòng thí nghiệm mà điều kiện `until` có thể đọc */
export interface LabState {
  mix(vessel: number): Mixture;
  tempC(vessel: number): number;
  /** Số đọc trên xi lanh đo khí, mL */
  syringeML(): number;
  /** Số đọc trên cân điện tử (khối lượng các chất, không tính dụng cụ), g */
  balanceG(): number;
}

export type Step =
  | { kind: 'say'; text: string; hold?: number }
  | { kind: 'add'; chem: string; amount: number; vessel: number; text?: string }
  | { kind: 'wait'; seconds: number; speed?: number; text?: string; until?: (lab: LabState) => boolean }
  | { kind: 'heat'; vessel: number; on: boolean; text?: string }
  | { kind: 'stir'; vessel: number; text?: string }
  | { kind: 'probe'; tool: ToolKind; vessel: number; text?: string }
  /** Dùng kẹp sắt giữ mẩu chất rắn đốt trên ngọn lửa đèn cồn */
  | { kind: 'burn'; chem: string; text?: string }
  | { kind: 'connect'; src: number; dst: number | null; text?: string }
  | { kind: 'invert'; vessel: number; text?: string }
  /** Đặt dụng cụ lên cân; `off`: lấy dụng cụ đó xuống; vessel null: lấy tất cả xuống */
  | { kind: 'weigh'; vessel: number | null; off?: boolean; text?: string }
  /** Đổ bỏ chất trong dụng cụ, tráng sạch */
  | { kind: 'empty'; vessel: number; text?: string }
  /** Dừng lại cho người xem đoán bước tiếp theo sẽ có hiện tượng gì */
  | { kind: 'predict'; text?: string }
  /** Đổ hết chất lỏng từ dụng cụ src sang dụng cụ dst */
  | { kind: 'pour'; src: number; dst: number; text?: string }
  | { kind: 'focus'; vessels: number[] | null };

/** Các bộ SGK có trong ứng dụng */
export const BOOKS = {
  kntt: 'Kết nối tri thức',
  ctst: 'Chân trời sáng tạo',
} as const;
export type BookId = keyof typeof BOOKS;

/** Bài học trong SGK mà thí nghiệm thuộc về; thứ tự ở đây là thứ tự hiện trong danh sách */
export const LESSONS = {
  // KHTN 8 – Kết nối tri thức
  'khtn8-b2': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 2. Phản ứng hóa học' },
  'khtn8-b4': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 4. Dung dịch và nồng độ' },
  'khtn8-b5': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 5. Định luật bảo toàn khối lượng' },
  'khtn8-b7': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 7. Tốc độ phản ứng và chất xúc tác' },
  'khtn8-b8': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 8. Acid' },
  'khtn8-b9': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 9. Base. Thang pH' },
  'khtn8-b10': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 10. Oxide' },
  'khtn8-b11': { book: 'kntt', grade: 8, title: 'KHTN 8 · Bài 11. Muối' },
  // KHTN 8 – Chân trời sáng tạo
  'ctst8-b2': { book: 'ctst', grade: 8, title: 'KHTN 8 · Bài 2. Biến đổi vật lí và biến đổi hóa học' },
} as const satisfies Record<string, { book: BookId; grade: number; title: string }>;
export type LessonId = keyof typeof LESSONS;

/** Lớp học của một thí nghiệm (theo bài trong SGK) */
export const gradeOf = (r: Recipe): number => LESSONS[r.lesson].grade;


/** Những gì trình phát cần để chạy: thí nghiệm mẫu, hoặc thí nghiệm tự làm được chia sẻ bằng link */
export interface PlayScript {
  id: string;
  title: string;
  steps: Step[];
  /** Thí nghiệm tự làm: dữ liệu trong link (#/chia-se/<data>) */
  shared?: { data: string };
}

export interface Recipe extends PlayScript {
  lesson: LessonId;
  /** Khái niệm chính, hiện dưới dạng thẻ */
  concepts: string[];
  /** Trang trong SGK có thí nghiệm này */
  page?: number;
  summary: string;
  result: { phenomena: string[]; equations: string[]; explain: string };
}

// ── Cú pháp ngắn gọn để viết kịch bản ────────────────────────────────────
const say = (text: string, hold?: number): Step => ({ kind: 'say', text, hold });
const add = (chem: string, amount: number, vessel: number, text?: string): Step => ({ kind: 'add', chem, amount, vessel, text });
const wait = (seconds: number, o: { speed?: number; text?: string; until?: (lab: LabState) => boolean } = {}): Step => ({ kind: 'wait', seconds, ...o });
const heat = (vessel: number, on: boolean, text?: string): Step => ({ kind: 'heat', vessel, on, text });
const stir = (vessel: number, text?: string): Step => ({ kind: 'stir', vessel, text });
const connect = (src: number, dst: number | null, text?: string): Step => ({ kind: 'connect', src, dst, text });
const invert = (vessel: number, text?: string): Step => ({ kind: 'invert', vessel, text });
const probe = (tool: ToolKind, vessel: number, text?: string): Step => ({ kind: 'probe', tool, vessel, text });
const burn = (chem: string, text?: string): Step => ({ kind: 'burn', chem, text });
const weigh = (vessel: number | null, text?: string): Step => ({ kind: 'weigh', vessel, text });
const pourInto = (src: number, dst: number, text?: string): Step => ({ kind: 'pour', src, dst, text });
const focus = (...vessels: number[]): Step => ({ kind: 'focus', vessels: vessels.length ? vessels : null });

export const RECIPES: Recipe[] = [
  {
    id: 'sat-luu-huynh',
    title: 'Biến đổi hóa học: sắt tác dụng với lưu huỳnh',
    lesson: 'khtn8-b2', page: 12,
    concepts: ['biến đổi hóa học', 'chất mới', 'phản ứng tỏa nhiệt'],
    summary: 'Trộn bột sắt với bột lưu huỳnh rồi thử bằng nam châm. Đun nóng hỗn hợp, để nguội và thử lại: nam châm còn hút không?',
    steps: [
      say('Trộn bột sắt (màu xám) với bột lưu huỳnh (màu vàng) theo tỉ lệ khối lượng 7 : 4, rồi chia vào hai ống nghiệm (1) và (2).'),
      focus(TUBE1, TUBE2),
      add('fe_powder', 0.7, TUBE1, 'Ống (1): cho 0,7 g bột sắt.'),
      add('s_powder', 0.4, TUBE1, 'Ống (1): thêm 0,4 g bột lưu huỳnh. Hỗn hợp có màu xám vàng.'),
      add('fe_powder', 0.7, TUBE2, 'Ống (2): cho 0,7 g bột sắt.'),
      add('s_powder', 0.4, TUBE2, 'Ống (2): thêm 0,4 g bột lưu huỳnh.'),
      probe('magnet', TUBE1, 'Đưa nam châm lại gần đáy ống (1).'),
      say('Hỗn hợp bị nam châm hút vì bột sắt vẫn còn nguyên. Khi chỉ trộn lẫn, sắt và lưu huỳnh giữ nguyên tính chất: chưa có chất mới.'),
      heat(TUBE2, true, 'Đun mạnh đáy ống (2) bằng đèn cồn.'),
      wait(60, { speed: 2, text: 'Đáy ống nóng dần. Để ý nhiệt độ trên bảng thông tin.', until: (l) => l.mix(TUBE2).get('FeS') > 0.009 }),
      wait(3, { text: 'Hỗn hợp bùng lên, nóng đỏ rực và lan khắp ống: phản ứng tỏa nhiều nhiệt.' }),
      heat(TUBE2, false, 'Ngừng đun. Phản ứng vẫn tự tiếp diễn nhờ nhiệt nó tỏa ra.'),
      wait(15, { text: 'Hỗn hợp vẫn đỏ rực một lúc rồi tối dần, còn lại chất rắn màu đen.' }),
      wait(900, { speed: 20, text: 'Tua nhanh: để ống (2) nguội.', until: (l) => l.tempC(TUBE2) < 40 }),
      probe('magnet', TUBE2, 'Đưa nam châm lại gần đáy ống (2).'),
      say('Chất rắn màu đen không bị nam châm hút: sắt và lưu huỳnh đã biến thành chất mới là iron(II) sulfide. Đây là biến đổi hóa học.'),
    ],
    result: {
      phenomena: [
        'Ống (1), chỉ trộn: hỗn hợp xám vàng bị nam châm hút',
        'Ống (2), khi đun: hỗn hợp bùng cháy đỏ rực, tiếp tục nóng đỏ cả khi đã ngừng đun',
        'Ống (2), sau khi nguội: chất rắn màu đen, không bị nam châm hút',
      ],
      equations: ['Fe + S → FeS'],
      explain: 'Trộn sắt với lưu huỳnh chỉ là biến đổi vật lí: mỗi chất giữ nguyên tính chất nên sắt vẫn bị nam châm hút. Khi đun nóng, sắt tác dụng với lưu huỳnh tạo thành iron(II) sulfide, một chất mới có màu đen và không bị nam châm hút. Đó là biến đổi hóa học. Phản ứng chỉ cần đun lúc đầu để khơi mào, sau đó tỏa nhiều nhiệt nên tự lan ra cả khối.',
    },
  },
  {
    id: 'dau-hieu-chat-moi',
    title: 'Dấu hiệu nhận biết có chất mới tạo thành',
    lesson: 'khtn8-b2', page: 14,
    concepts: ['phản ứng hóa học', 'chất khí', 'kết tủa'],
    summary: 'Cho hydrochloric acid vào kẽm viên và vào barium chloride, cho sodium hydroxide vào copper(II) sulfate. Ống nào có phản ứng hóa học?',
    steps: [
      say('Khi có chất mới tạo thành, ta thường thấy dấu hiệu: sủi bọt khí, xuất hiện kết tủa, đổi màu hoặc tỏa nhiệt. Cùng làm 3 ống nghiệm để kiểm tra.'),
      focus(TUBE1, TUBE2, TUBE3),
      add('zn', 0.5, TUBE1, 'Ống (1): cho vài viên kẽm vào ống nghiệm.'),
      add('bacl2', 2, TUBE2, 'Ống (2): lấy 2 mL dung dịch barium chloride.'),
      add('cuso4', 2, TUBE3, 'Ống (3): lấy 2 mL dung dịch copper(II) sulfate màu xanh lam.'),
      add('hcl', 3, TUBE1, 'Cho 3 mL dung dịch hydrochloric acid vào ống (1) chứa kẽm viên.'),
      wait(10, { text: 'Ống (1): bọt khí thoát ra trên bề mặt viên kẽm.' }),
      add('hcl', 3, TUBE2, 'Cho 3 mL dung dịch hydrochloric acid vào ống (2) chứa barium chloride.'),
      wait(6, { text: 'Ống (2): không thấy khí, không có kết tủa, dung dịch vẫn trong suốt.' }),
      add('naoh', 3, TUBE3, 'Cho 3 mL dung dịch sodium hydroxide vào ống (3) chứa copper(II) sulfate.'),
      wait(6, { text: 'Ống (3): xuất hiện kết tủa màu xanh lơ, màu xanh lam của dung dịch nhạt đi.' }),
      say('Ống (1) có khí, ống (3) có kết tủa: đó là dấu hiệu có chất mới, tức là có phản ứng hóa học. Ống (2) không có dấu hiệu gì nên không xảy ra phản ứng.'),
    ],
    result: {
      phenomena: [
        'Ống (1): sủi bọt khí không màu, viên kẽm tan dần',
        'Ống (2): không có hiện tượng',
        'Ống (3): xuất hiện kết tủa xanh lơ',
      ],
      equations: ['Zn + 2HCl → ZnCl₂ + H₂↑', 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄'],
      explain: 'Phản ứng xảy ra ở ống (1) và ống (3). Khí hydrogen và kết tủa copper(II) hydroxide là những chất mới, khác với các chất ban đầu. Ở ống (2), hydrochloric acid và barium chloride trộn lẫn nhưng không tạo ra chất mới nào.',
    },
  },
  {
    id: 'nhan-biet-dung-dich',
    title: 'Nhận biết dung dịch, chất tan và dung môi',
    lesson: 'khtn8-b4', page: 20,
    concepts: ['dung dịch', 'chất tan', 'dung môi', 'dung dịch bão hòa'],
    summary: 'Hòa muối ăn, copper(II) sulfate và bột gạo vào nước. Ống nào là dung dịch? Cho thật nhiều muối thì sao?',
    steps: [
      say('Sách làm với 4 cốc, mỗi cốc 20 mL nước. Ở đây dùng 4 ống nghiệm, mỗi ống 5 mL nước, lượng chất cũng giảm đi 4 lần.'),
      focus(TUBE1, TUBE2, TUBE3, TUBE4),
      add('water', 5, TUBE1, 'Rót 5 mL nước vào ống (1).'),
      add('water', 5, TUBE2, 'Rót 5 mL nước vào ống (2).'),
      add('water', 5, TUBE3, 'Rót 5 mL nước vào ống (3).'),
      add('water', 5, TUBE4, 'Rót 5 mL nước vào ống (4).'),
      add('salt', 0.75, TUBE1, 'Ống (1): thêm 0,75 g muối ăn.'),
      add('cuso4_solid', 0.75, TUBE2, 'Ống (2): thêm 0,75 g copper(II) sulfate.'),
      add('rice_flour', 0.75, TUBE3, 'Ống (3): thêm 0,75 g bột gạo.'),
      add('salt', 3, TUBE4, 'Ống (4): thêm 3 g muối ăn, gấp 4 lần ống (1).'),
      stir(TUBE1, 'Khuấy đều từng ống.'),
      stir(TUBE2, 'Khuấy đều từng ống.'),
      stir(TUBE3, 'Khuấy đều từng ống.'),
      stir(TUBE4, 'Khuấy đều từng ống.'),
      wait(300, {
        speed: 6, text: 'Tua nhanh: khuấy khoảng 2 phút rồi để yên.',
        // Đến khi muối ăn ở ống (1) và copper(II) sulfate ở ống (2) tan hết (còn dưới 1 mg)
        until: (l) => l.mix(TUBE1).get('NaCl') * 58.44 < 1e-3 && l.mix(TUBE2).get('CuSO4') * 249.69 < 1e-3,
      }),
      wait(20, { text: 'Quan sát 4 ống nghiệm.' }),
      say('Ống (1): muối ăn tan hết, chất lỏng trong suốt, đồng nhất. Ống (2): copper(II) sulfate tan hết, chất lỏng trong suốt, màu xanh lam đều.'),
      say('Ống (3): chất lỏng đục trắng, không đồng nhất. Để yên một lúc, bột gạo lắng dần xuống đáy.'),
      say('Ống (4): muối chỉ tan một phần rồi không tan thêm được nữa, đáy ống vẫn còn muối.'),
      say('Ống (1), (2) và (4) chứa dung dịch, ống (3) thì không. Dung dịch ở ống (4) không hòa tan thêm được muối: đó là dung dịch bão hòa.'),
    ],
    result: {
      phenomena: [
        'Ống (1), (2): chất rắn tan hết, thu được chất lỏng trong suốt, đồng nhất; ống (2) có màu xanh lam',
        'Ống (3): chất lỏng đục, không đồng nhất, để yên thì bột gạo lắng xuống',
        'Ống (4): muối ăn tan một phần, phần còn lại không tan nằm dưới đáy',
      ],
      equations: [],
      explain: 'Dung dịch là hỗn hợp đồng nhất của chất tan và dung môi. Ở ống (1) và (4), chất tan là muối ăn; ở ống (2), chất tan là copper(II) sulfate; dung môi đều là nước. Bột gạo không tan trong nước, chỉ lơ lửng làm đục rồi lắng xuống, nên ống (3) không phải dung dịch. Ở nhiệt độ phòng, 5 mL nước chỉ hòa tan được khoảng 1,8 g muối ăn, nên khi cho 3 g thì còn dư muối: dung dịch ở ống (4) là dung dịch bão hòa.',
    },
  },
  {
    id: 'pha-nuoc-muoi-sinh-li',
    title: 'Pha 100 g dung dịch muối ăn 0,9%',
    lesson: 'khtn8-b4', page: 22,
    concepts: ['nồng độ phần trăm', 'pha chế dung dịch', 'cân điện tử'],
    summary: 'Tính lượng muối ăn và nước cần dùng, cân muối và nước trên cân điện tử để pha nước muối sinh lí 0,9%.',
    steps: [
      say('Pha 100 g dung dịch muối ăn 0,9%. Tính trước: khối lượng muối là 100 nhân 0,9 chia 100, bằng 0,9 g; khối lượng nước là 100 trừ 0,9, bằng 99,1 g.'),
      focus(BEAKER),
      weigh(BEAKER, 'Đặt cốc 100 mL khô, sạch lên cân điện tử: cân chỉ 0,00 g (cân chỉ tính khối lượng chất trong cốc).'),
      add('salt', 0.9, BEAKER, 'Cho muối ăn khan vào cốc đến khi cân chỉ 0,90 g.'),
      add('water', 99.1, BEAKER, 'Rót thêm 99,1 mL nước cất (1 mL nước nặng khoảng 1 g), cân chỉ khoảng 100 g.'),
      stir(BEAKER, 'Khuấy đều cho muối tan hết.'),
      wait(180, {
        speed: 6, text: 'Tua nhanh: muối ăn tan dần.',
        until: (l) => l.mix(BEAKER).get('NaCl') * 58.44 < 1e-3,
      }),
      say('Muối đã tan hết, dung dịch trong suốt, không màu. Ta được 100 g dung dịch muối ăn 0,9%: đây là nồng độ của nước muối sinh lí.'),
    ],
    result: {
      phenomena: [
        'Cân chỉ 0,90 g sau khi cho muối, khoảng 100 g sau khi rót nước',
        'Muối ăn tan hết, dung dịch trong suốt, không màu',
      ],
      equations: [],
      explain: 'Nồng độ phần trăm cho biết số gam chất tan có trong 100 g dung dịch: C% = khối lượng chất tan : khối lượng dung dịch × 100%. Muốn có 100 g dung dịch 0,9% thì cần 0,9 g muối ăn và 99,1 g nước. Phải dùng muối khan vì muối ẩm có lẫn nước, cân 0,9 g muối ẩm thì lượng muối thật ít hơn. Dung dịch muối ăn 0,9% có nồng độ gần bằng dịch trong cơ thể, gọi là nước muối sinh lí, dùng để nhỏ mắt, rửa mũi, súc miệng, rửa vết thương.',
    },
  },
  {
    id: 'bao-toan-khoi-luong',
    title: 'Định luật bảo toàn khối lượng',
    lesson: 'khtn8-b5', page: 24,
    concepts: ['định luật bảo toàn khối lượng', 'kết tủa', 'cân điện tử'],
    summary: 'Cân hai ống dung dịch barium chloride và sodium sulfate, đổ vào nhau cho phản ứng rồi cân lại. Khối lượng có thay đổi không?',
    steps: [
      say('Khi phản ứng hóa học xảy ra, tổng khối lượng các chất có thay đổi không? Sách dùng 2 cốc; ở đây dùng 2 ống nghiệm, đặt cả hai lên cân.'),
      focus(TUBE1, TUBE2),
      add('bacl2', 4, TUBE1, 'Ống (1): lấy 4 mL dung dịch barium chloride.'),
      add('na2so4', 4, TUBE2, 'Ống (2): lấy 4 mL dung dịch sodium sulfate.'),
      weigh(TUBE1, 'Đặt ống (1) lên cân điện tử.'),
      weigh(TUBE2, 'Đặt tiếp ống (2) lên cân, cạnh ống (1).'),
      say('Ghi lại số chỉ của cân: đó là tổng khối lượng hai ống và các chất trước phản ứng.'),
      pourInto(TUBE1, TUBE2, 'Đổ ống (1) vào ống (2), rồi đặt ống (1) trở lại cân.'),
      wait(8, { text: 'Ống (2): xuất hiện kết tủa màu trắng.' }),
      say('Số chỉ của cân không thay đổi: tổng khối lượng các chất sau phản ứng bằng tổng khối lượng các chất trước phản ứng.'),
    ],
    result: {
      phenomena: [
        'Khi đổ hai dung dịch vào nhau: xuất hiện kết tủa trắng',
        'Số chỉ của cân trước và sau phản ứng bằng nhau',
      ],
      equations: ['BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl'],
      explain: 'Barium chloride tác dụng với sodium sulfate tạo thành barium sulfate (kết tủa trắng) và sodium chloride. Trong phản ứng hóa học, chỉ có liên kết giữa các nguyên tử thay đổi, còn số nguyên tử của mỗi nguyên tố giữ nguyên, nên tổng khối lượng các chất tham gia bằng tổng khối lượng các chất sản phẩm. Đó là định luật bảo toàn khối lượng (Lomonosov và Lavoisier). Phản ứng này không có chất khí thoát ra ngoài nên cân không đổi.',
    },
  },

  // ── KHTN 8 – Chân trời sáng tạo ───────────────────────────────────────
  {
    id: 'lam-duc-nuoc-voi-trong',
    title: 'Làm đục nước vôi trong',
    lesson: 'ctst8-b2', page: 17,
    concepts: ['biến đổi hóa học', 'khí carbon dioxide', 'nước vôi trong'],
    summary: 'Cho giấm ăn vào bột baking soda, dẫn khí sinh ra sang ống nghiệm chứa nước vôi trong. Nước vôi trong thay đổi thế nào?',
    steps: [
      say('Chuẩn bị 2 ống nghiệm, một ống dẫn khí hình chữ U có nút cao su, giấm ăn và bột baking soda (NaHCO₃).'),
      focus(TUBE1, TUBE2),
      add('baking_soda', 0.05, TUBE1, 'Ống (1): cho một ít bột baking soda.'),
      add('limewater', 5, TUBE2, 'Ống (2): cho 5 mL nước vôi trong.'),
      add('vinegar', 5, TUBE1, 'Thêm 5 mL giấm ăn vào ống (1).'),
      connect(TUBE1, TUBE2, 'Đậy ngay ống (1) bằng nút cao su có ống dẫn khí chữ U, đầu kia nhúng vào nước vôi trong ở ống (2).'),
      wait(25, { text: 'Ống (1) sủi bọt khí. Khí theo ống dẫn sang ống (2) và sủi lên trong nước vôi trong.', until: (l) => l.mix(TUBE2).get('CaCO3') > 1e-5 }),
      wait(4, { text: 'Nước vôi trong ở ống (2) bị vẩn đục.' }),
      connect(TUBE1, null, 'Nhấc ống dẫn khí ra khỏi ống (2).'),
      say('Giấm ăn tác dụng với baking soda tạo ra khí carbon dioxide. Khí này làm nước vôi trong vẩn đục vì tạo ra calcium carbonate không tan: đã có chất mới, đó là biến đổi hóa học.'),
    ],
    result: {
      phenomena: [
        'Ống (1): sủi bọt khí, bột baking soda tan dần',
        'Ống (2): có bọt khí sủi lên, nước vôi trong bị vẩn đục (màu trắng đục)',
      ],
      equations: [
        'NaHCO₃ + CH₃COOH → CH₃COONa + CO₂↑ + H₂O',
        'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O',
      ],
      explain: 'Khí carbon dioxide sinh ra ở ống (1) tác dụng với calcium hydroxide trong nước vôi trong, tạo calcium carbonate là chất rắn không tan nên nước vôi bị vẩn đục. Nước vôi trong đã bị biến đổi thành chất khác: đó là biến đổi hóa học. Đây cũng là cách nhận biết khí carbon dioxide. Nếu tiếp tục dẫn thật nhiều khí vào, nước vôi sẽ trong trở lại.',
    },
  },
  {
    id: 'dot-chay-magnesium',
    title: 'Đốt cháy kim loại magnesium',
    lesson: 'ctst8-b2', page: 18,
    concepts: ['biến đổi hóa học', 'sự cháy', 'oxide'],
    summary: 'Dùng kẹp sắt giữ mảnh magnesium đốt trên ngọn lửa đèn cồn. Sau khi cháy, mảnh magnesium biến thành chất gì?',
    steps: [
      say('Magnesium là kim loại màu trắng bạc, có ánh kim. Dùng kẹp sắt giữ mảnh magnesium đã làm sạch rồi đưa vào ngọn lửa đèn cồn.'),
      burn('mg_strip', 'Dùng kẹp sắt giữ mảnh magnesium, đốt trên ngọn lửa đèn cồn. Không nhìn thẳng vào ánh lửa quá lâu.'),
      say('Mảnh kim loại trắng bạc đã biến thành chất bột màu trắng, giòn, không còn ánh kim: magnesium đã biến đổi thành chất khác là magnesium oxide.'),
    ],
    result: {
      phenomena: [
        'Mảnh magnesium cháy với ngọn lửa sáng chói màu trắng, tỏa nhiều nhiệt',
        'Có khói trắng bay lên',
        'Sau khi cháy còn lại chất bột màu trắng, giòn, dễ vụn',
      ],
      equations: ['2Mg + O₂ → 2MgO'],
      explain: 'Khi đốt, magnesium tác dụng với khí oxygen trong không khí tạo thành magnesium oxide, chất bột màu trắng. Sản phẩm có tính chất khác hẳn kim loại ban đầu nên đây là biến đổi hóa học. Ánh sáng chói của magnesium cháy từng được dùng làm đèn chớp khi chụp ảnh và trong pháo hoa.',
    },
  },
];
