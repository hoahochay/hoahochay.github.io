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

  {
    id: 'nong-do-toc-do-phan-ung',
    title: 'Ảnh hưởng của nồng độ đến tốc độ phản ứng',
    lesson: 'khtn8-b7', page: 32,
    concepts: ['tốc độ phản ứng', 'nồng độ', 'khí hydrogen'],
    summary: 'Thả hai đinh sắt giống nhau vào dung dịch hydrochloric acid 0,1M và 1M. Ống nào sủi bọt khí nhanh hơn?',
    steps: [
      say('Phản ứng của sắt với hydrochloric acid sinh ra khí hydrogen. Ta so sánh tốc độ phản ứng ở hai nồng độ acid khác nhau.'),
      focus(TUBE1, TUBE2),
      add('hcl01', 5, TUBE1, 'Ống (1): khoảng 5 mL dung dịch hydrochloric acid 0,1M.'),
      add('hcl', 5, TUBE2, 'Ống (2): khoảng 5 mL dung dịch hydrochloric acid 1M.'),
      add('fe', 1, TUBE1, 'Nhẹ nhàng thả một đinh sắt nhỏ vào ống (1).'),
      add('fe', 1, TUBE2, 'Thả một đinh sắt giống hệt vào ống (2).'),
      wait(40, { speed: 2, text: 'Ống (2) có nhiều bọt khí thoát ra hơn ống (1).' }),
      say('Phản ứng ở ống (2), nơi acid có nồng độ lớn hơn, xảy ra nhanh hơn.'),
    ],
    result: {
      phenomena: [
        'Cả hai ống đều có bọt khí thoát ra trên bề mặt đinh sắt',
        'Ống (2) dùng acid 1M sủi bọt khí nhiều và nhanh hơn ống (1) dùng acid 0,1M',
      ],
      equations: ['Fe + 2HCl → FeCl₂ + H₂↑'],
      explain: 'Sắt tác dụng với hydrochloric acid tạo thành iron(II) chloride và khí hydrogen. Khi nồng độ acid lớn hơn, trong cùng một thể tích có nhiều hạt acid hơn, chúng va chạm với bề mặt sắt nhiều hơn, nên phản ứng xảy ra nhanh hơn. Nồng độ chất phản ứng càng lớn, tốc độ phản ứng càng tăng.',
    },
  },
  {
    id: 'nhiet-do-toc-do-phan-ung',
    title: 'Ảnh hưởng của nhiệt độ đến tốc độ phản ứng',
    lesson: 'khtn8-b7', page: 32,
    concepts: ['tốc độ phản ứng', 'nhiệt độ', 'khí carbon dioxide'],
    summary: 'Thả hai mẩu viên vitamin C sủi giống nhau vào nước nguội và nước nóng. Ở đâu viên sủi tan và sủi bọt nhanh hơn?',
    steps: [
      say('Viên vitamin C sủi chứa citric acid và sodium hydrogencarbonate. Khi gặp nước, chúng phản ứng với nhau tạo ra khí carbon dioxide. Sách dùng hai cốc nước nóng và nước lạnh; ở đây dùng hai ống nghiệm.'),
      focus(TUBE1, TUBE2),
      add('water', 5, TUBE1, 'Ống (1): 5 mL nước ở nhiệt độ phòng.'),
      add('water', 5, TUBE2, 'Ống (2): 5 mL nước.'),
      heat(TUBE2, true, 'Đun nóng ống (2) bằng đèn cồn.'),
      wait(240, { speed: 20, text: 'Chờ nước ở ống (2) nóng lên khoảng 70 °C.', until: (l) => l.tempC(TUBE2) > 70 }),
      heat(TUBE2, false, 'Tắt đèn cồn, đặt ống (2) về giá.'),
      add('vitc', 0.25, TUBE1, 'Thả một mẩu viên vitamin C sủi (khoảng 0,25 g) vào ống (1).'),
      add('vitc', 0.25, TUBE2, 'Thả một mẩu giống hệt vào ống (2).'),
      wait(30, { text: 'Ống (2) nước nóng sủi bọt mạnh, mẩu viên sủi tan rất nhanh. Ống (1) sủi chậm hơn.' }),
      say('Phản ứng trong nước nóng xảy ra nhanh hơn trong nước nguội.'),
    ],
    result: {
      phenomena: [
        'Ống nước nóng: sủi bọt khí mạnh ngay, mẩu viên sủi tan hết sau thời gian ngắn',
        'Ống nước nguội: sủi bọt chậm hơn, mẩu viên sủi tan lâu hơn',
      ],
      equations: [],
      explain: 'Trong viên sủi, citric acid tác dụng với sodium hydrogencarbonate khi có nước, tạo ra khí carbon dioxide. Ở nhiệt độ cao, các hạt chuyển động nhanh hơn, va chạm nhiều hơn và mạnh hơn, nên phản ứng xảy ra nhanh hơn. Nhiệt độ càng cao, tốc độ phản ứng càng tăng; vì vậy ta bảo quản thực phẩm trong tủ lạnh để làm chậm sự hư hỏng.',
    },
  },
  {
    id: 'be-mat-toc-do-phan-ung',
    title: 'Ảnh hưởng của diện tích bề mặt tiếp xúc đến tốc độ phản ứng',
    lesson: 'khtn8-b7', page: 33,
    concepts: ['tốc độ phản ứng', 'diện tích bề mặt tiếp xúc', 'đá vôi'],
    summary: 'Cho cùng một lượng đá vôi dạng bột và dạng viên vào dung dịch hydrochloric acid. Ống nào sủi bọt khí nhanh hơn?',
    steps: [
      say('Đá vôi tác dụng với hydrochloric acid sinh ra khí carbon dioxide. Ta so sánh đá vôi đập nhỏ thành bột với đá vôi dạng viên, cùng khối lượng.'),
      focus(TUBE1, TUBE2),
      add('caco3_powder', 1, TUBE1, 'Ống (1): khoảng 1 g đá vôi dạng bột.'),
      add('caco3', 1, TUBE2, 'Ống (2): khoảng 1 g đá vôi dạng viên.'),
      add('hcl01', 3, TUBE1, 'Cho khoảng 3 mL dung dịch hydrochloric acid 0,1M vào ống (1).'),
      add('hcl01', 3, TUBE2, 'Cho khoảng 3 mL dung dịch hydrochloric acid 0,1M vào ống (2).'),
      wait(30, { text: 'Ống (1) đá vôi bột sủi bọt khí mạnh hơn ống (2) đá vôi viên.' }),
      say('Phản ứng ở ống (1), đá vôi dạng bột, xảy ra nhanh hơn.'),
    ],
    result: {
      phenomena: [
        'Ống đá vôi bột: sủi bọt khí mạnh ngay khi cho acid vào',
        'Ống đá vôi viên: sủi bọt khí ít và chậm hơn',
      ],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O'],
      explain: 'Phản ứng chỉ xảy ra ở bề mặt chất rắn, nơi acid tiếp xúc với đá vôi. Đập nhỏ đá vôi thành bột làm diện tích bề mặt tiếp xúc tăng lên rất nhiều, nên nhiều hạt acid va chạm với đá vôi cùng lúc và phản ứng xảy ra nhanh hơn. Diện tích bề mặt tiếp xúc càng lớn, tốc độ phản ứng càng tăng; vì vậy củi chẻ nhỏ cháy nhanh hơn khúc gỗ to.',
    },
  },
  {
    id: 'xuc-tac-toc-do-phan-ung',
    title: 'Ảnh hưởng của chất xúc tác đến tốc độ phản ứng',
    lesson: 'khtn8-b7', page: 33,
    concepts: ['tốc độ phản ứng', 'chất xúc tác', 'khí oxygen'],
    summary: 'Cho một ít bột manganese dioxide vào một trong hai ống nước oxy già. Ống nào thoát khí nhanh hơn?',
    steps: [
      say('Nước oxy già (hydrogen peroxide) tự phân hủy rất chậm thành nước và khí oxygen. Ta xem manganese dioxide ảnh hưởng thế nào đến phản ứng này.'),
      focus(TUBE1, TUBE2),
      add('h2o2', 3, TUBE1, 'Ống (1): khoảng 3 mL nước oxy già 3%.'),
      add('h2o2', 3, TUBE2, 'Ống (2): khoảng 3 mL nước oxy già 3%.'),
      add('mno2', 0.1, TUBE2, 'Cho một ít bột manganese dioxide vào ống (2).'),
      wait(6, { text: 'Ống (2) sủi bọt khí rất mạnh; ống (1) hầu như không thấy bọt khí.' }),
      probe('glowing', TUBE2, 'Đưa que đóm còn tàn đỏ vào miệng ống (2): que đóm bùng cháy, khí thoát ra là oxygen.'),
      wait(20, { text: 'Phản ứng ở ống (2) dần dừng lại; bột manganese dioxide màu đen vẫn còn nguyên dưới đáy ống.' }),
      say('Manganese dioxide làm phản ứng phân hủy nước oxy già xảy ra nhanh hơn, và sau phản ứng nó vẫn còn nguyên: đó là chất xúc tác.'),
    ],
    result: {
      phenomena: [
        'Ống (1) chỉ có nước oxy già: hầu như không thấy khí thoát ra',
        'Ống (2) có thêm manganese dioxide: sủi bọt khí rất mạnh, khí làm que đóm còn tàn đỏ bùng cháy',
        'Sau phản ứng, bột manganese dioxide màu đen vẫn còn ở đáy ống (2)',
      ],
      equations: ['2H₂O₂ → 2H₂O + O₂↑ (xúc tác MnO₂)'],
      explain: 'Hydrogen peroxide phân hủy thành nước và khí oxygen. Khi không có chất xúc tác, phản ứng xảy ra rất chậm. Manganese dioxide làm tăng tốc độ phản ứng nhưng không bị mất đi: sau phản ứng, khối lượng và tính chất hóa học của nó không đổi. Chất như vậy gọi là chất xúc tác. Trong cơ thể, các enzyme cũng là chất xúc tác giúp quá trình tiêu hóa thức ăn diễn ra nhanh.',
    },
  },

  {
    id: 'tinh-chat-hydrochloric-acid',
    title: 'Tính chất của dung dịch hydrochloric acid',
    lesson: 'khtn8-b8', page: 36,
    concepts: ['acid', 'giấy quỳ tím', 'acid tác dụng với kim loại', 'khí hydrogen'],
    summary: 'Thử dung dịch hydrochloric acid bằng giấy quỳ tím, rồi cho acid vào hai ống đựng sắt và kẽm. Có hiện tượng gì?',
    steps: [
      say('Ta tìm hiểu hai tính chất của dung dịch hydrochloric acid: làm đổi màu giấy quỳ tím và tác dụng với kim loại.'),
      focus(TUBE1, TUBE2, TUBE3),
      add('hcl', 2, TUBE1, 'Ống (1): lấy 2 mL dung dịch hydrochloric acid 1M.'),
      probe('litmus_sol', TUBE1, 'Thử dung dịch ở ống (1) bằng giấy quỳ tím: sách nhỏ 1 – 2 giọt acid lên mẩu quỳ, ở đây ta nhúng đầu mẩu quỳ vào dung dịch.'),
      say('Giấy quỳ tím chuyển sang màu đỏ: dung dịch acid làm quỳ tím hóa đỏ.'),
      add('fe', 2, TUBE2, 'Ống (2): một đinh sắt.'),
      add('zn', 0.5, TUBE3, 'Ống (3): một viên kẽm.'),
      add('hcl', 3, TUBE2, 'Cho khoảng 3 mL dung dịch hydrochloric acid vào ống (2).'),
      add('hcl', 3, TUBE3, 'Cho khoảng 3 mL dung dịch hydrochloric acid vào ống (3).'),
      wait(30, { text: 'Cả hai ống đều có bọt khí thoát ra trên bề mặt kim loại; ống (3) đựng kẽm sủi bọt mạnh hơn.' }),
      say('Hydrochloric acid tác dụng với sắt và kẽm, giải phóng khí hydrogen.'),
    ],
    result: {
      phenomena: [
        'Giấy quỳ tím chuyển sang màu đỏ',
        'Ống đựng sắt và ống đựng kẽm đều sủi bọt khí; kẽm phản ứng mạnh hơn sắt',
      ],
      equations: ['Fe + 2HCl → FeCl₂ + H₂↑', 'Zn + 2HCl → ZnCl₂ + H₂↑'],
      explain: 'Khi tan trong nước, hydrochloric acid tạo ra ion H⁺; chính ion H⁺ làm giấy quỳ tím chuyển sang màu đỏ. Dung dịch acid tác dụng với một số kim loại như sắt, kẽm, magnesium: nguyên tử hydrogen trong acid được thay thế bằng nguyên tử kim loại, tạo thành muối và giải phóng khí hydrogen. Sắt tạo muối iron(II) chloride, kẽm tạo muối zinc chloride.',
    },
  },

  {
    id: 'tinh-chat-base',
    title: 'Tính chất hóa học của base',
    lesson: 'khtn8-b9', page: 40,
    concepts: ['base', 'giấy quỳ tím', 'phenolphthalein', 'phản ứng trung hòa'],
    summary: 'Thử dung dịch sodium hydroxide bằng giấy quỳ tím và phenolphthalein, rồi nhỏ từ từ hydrochloric acid vào. Màu thay đổi thế nào?',
    steps: [
      say('Ta tìm hiểu tính chất của dung dịch base: làm đổi màu chất chỉ thị và tác dụng với acid.'),
      focus(TUBE1, TUBE2),
      say('Thí nghiệm 1: thử dung dịch sodium hydroxide bằng giấy quỳ tím.'),
      add('naoh', 2, TUBE1, 'Ống (1): lấy 2 mL dung dịch sodium hydroxide.'),
      probe('litmus_sol', TUBE1, 'Thử dung dịch ở ống (1) bằng giấy quỳ tím: sách nhỏ 1 – 2 giọt lên mẩu quỳ, ở đây ta nhúng đầu mẩu quỳ vào dung dịch.'),
      say('Giấy quỳ tím chuyển sang màu xanh.'),
      say('Thí nghiệm 2: dùng phenolphthalein và hydrochloric acid.'),
      add('naoh', 1, TUBE2, 'Ống (2): khoảng 1 mL dung dịch sodium hydroxide.'),
      add('phenol', 3, TUBE2, 'Nhỏ 3 giọt dung dịch phenolphthalein vào ống (2): dung dịch chuyển sang màu hồng.'),
      add('hcl', 0.4, TUBE2, 'Dùng ống hút nhỏ từ từ dung dịch hydrochloric acid vào ống (2).'),
      stir(TUBE2, 'Vừa nhỏ vừa lắc nhẹ: dung dịch vẫn còn màu hồng.'),
      add('hcl', 0.4, TUBE2, 'Nhỏ tiếp acid vào ống (2).'),
      stir(TUBE2, 'Lắc nhẹ: màu hồng nhạt dần nhưng vẫn còn.'),
      add('hcl', 0.3, TUBE2, 'Nhỏ thêm vài giọt acid nữa.'),
      stir(TUBE2, 'Lắc nhẹ: dung dịch mất màu hồng, trở nên không màu.'),
      say('Acid đã phản ứng hết với base trong ống (2), nên phenolphthalein không còn màu hồng.'),
    ],
    result: {
      phenomena: [
        'Dung dịch sodium hydroxide làm giấy quỳ tím chuyển sang màu xanh',
        'Nhỏ phenolphthalein vào dung dịch sodium hydroxide: dung dịch có màu hồng',
        'Nhỏ từ từ hydrochloric acid vào: màu hồng nhạt dần rồi mất hẳn',
      ],
      equations: ['NaOH + HCl → NaCl + H₂O'],
      explain: 'Khi tan trong nước, sodium hydroxide tạo ra ion OH⁻; ion OH⁻ làm giấy quỳ tím hóa xanh và làm dung dịch phenolphthalein không màu chuyển sang màu hồng. Khi thêm hydrochloric acid, ion H⁺ của acid kết hợp với ion OH⁻ của base tạo thành nước, sản phẩm còn lại là muối sodium chloride. Khi base đã phản ứng hết, dung dịch không còn tính base nên màu hồng biến mất. Phản ứng giữa acid và base tạo thành muối và nước gọi là phản ứng trung hòa.',
    },
  },

  {
    id: 'xac-dinh-ph',
    title: 'Xác định pH của một số dung dịch bằng giấy pH',
    lesson: 'khtn8-b9', page: 42,
    concepts: ['thang pH', 'giấy pH', 'acid', 'base', 'đồ dùng hằng ngày'],
    summary: 'Dùng giấy pH đo pH của nước lọc, nước chanh, nước ngọt có gas, nước rửa bát, giấm ăn và dung dịch baking soda. Dung dịch nào có tính acid, dung dịch nào có tính base?',
    steps: [
      say('Giấy pH chuyển màu khác nhau tùy độ acid hay base của dung dịch. So màu giấy với bảng màu chuẩn, ta đọc được pH. Sách nhỏ dung dịch lên mẩu giấy pH; ở đây ta nhúng đầu mẩu giấy vào dung dịch. Ta thử 6 loại, chia làm 2 lượt.'),
      say('Lượt 1: bốn ống nghiệm.'),
      focus(TUBE1, TUBE2, TUBE3, TUBE4),
      add('water', 3, TUBE1, 'Ống (1): 3 mL nước lọc.'),
      add('lemon', 3, TUBE2, 'Ống (2): 3 mL nước chanh.'),
      add('soda', 3, TUBE3, 'Ống (3): 3 mL nước ngọt có gas.'),
      add('dishsoap', 3, TUBE4, 'Ống (4): 3 mL nước rửa bát.'),
      probe('ph_paper', TUBE1, 'Nhúng giấy pH vào ống (1): giấy có màu xanh lá, pH bằng 7.'),
      probe('ph_paper', TUBE2, 'Ống (2): giấy có màu đỏ, pH khoảng 2.'),
      probe('ph_paper', TUBE3, 'Ống (3): giấy có màu cam, pH khoảng 3.'),
      probe('ph_paper', TUBE4, 'Ống (4): giấy có màu xanh lam nhạt, pH khoảng 9.'),
      say('Nước lọc trung tính; nước chanh và nước ngọt có gas có tính acid; nước rửa bát có tính base.'),
      say('Lượt 2: đổ bỏ dung dịch ở ống (1) và ống (2), tráng sạch để dùng lại.'),
      focus(TUBE1, TUBE2),
      { kind: 'empty', vessel: TUBE1 },
      { kind: 'empty', vessel: TUBE2 },
      add('vinegar', 3, TUBE1, 'Ống (1): 3 mL giấm ăn.'),
      add('water', 3, TUBE2, 'Ống (2): 3 mL nước, rồi pha dung dịch baking soda.'),
      add('baking_soda', 0.2, TUBE2, 'Cho một ít bột baking soda vào ống (2).'),
      stir(TUBE2, 'Lắc cho baking soda tan hết.'),
      wait(20, { text: 'Chờ bột baking soda tan hết.', until: (l) => l.mix(TUBE2).get('NaHCO3') * 84.01 < 1e-3 }),
      probe('ph_paper', TUBE1, 'Nhúng giấy pH vào ống (1): giấy có màu đỏ, pH khoảng 2.'),
      probe('ph_paper', TUBE2, 'Ống (2): giấy có màu xanh lá đậm, pH khoảng 8.'),
      say('Giấm ăn có tính acid; dung dịch baking soda có tính base yếu.'),
    ],
    result: {
      phenomena: [
        'Nước lọc: pH = 7, trung tính',
        'Nước chanh: pH ≈ 2; giấm ăn: pH ≈ 2; nước ngọt có gas: pH ≈ 3 (có tính acid)',
        'Nước rửa bát: pH ≈ 9; dung dịch baking soda: pH ≈ 8 (có tính base)',
      ],
      equations: [],
      explain: 'Thang pH đánh giá độ acid hay base của dung dịch: pH nhỏ hơn 7 là môi trường acid, pH bằng 7 là môi trường trung tính, pH lớn hơn 7 là môi trường base. pH càng nhỏ, tính acid càng mạnh; pH càng lớn, tính base càng mạnh. Các dung dịch có tính acid như nước chanh, giấm ăn, nước ngọt có gas đều chứa acid (citric acid, acetic acid, carbonic acid). Nước rửa bát và baking soda có tính base. Giá trị pH ở đây là gần đúng; mỗi loại nước chanh, nước rửa bát ngoài đời có thể cho pH hơi khác.',
    },
  },

  {
    id: 'tinh-chat-oxide-acid',
    title: 'Tính chất hóa học của oxide acid',
    lesson: 'khtn8-b10', page: 45,
    concepts: ['oxide acid', 'carbon dioxide', 'nước vôi trong', 'ống dẫn khí'],
    summary: 'Điều chế khí carbon dioxide từ đá vôi và hydrochloric acid, dẫn vào nước vôi trong. Lúc mới dẫn khí và khi dẫn khí lâu, nước vôi trong thay đổi thế nào?',
    steps: [
      say('Carbon dioxide là một oxide acid. Ta điều chế khí này từ đá vôi và hydrochloric acid, rồi dẫn vào nước vôi trong, là dung dịch calcium hydroxide. Sách dùng acid 0,1M; ở đây dùng acid 1M để khí thoát ra nhiều, dễ quan sát hơn.'),
      focus(TUBE1, TUBE2),
      add('limewater', 5, TUBE2, 'Ống (2): khoảng 5 mL nước vôi trong.'),
      add('caco3', 1, TUBE1, 'Ống (1): vài mẩu đá vôi đập nhỏ.'),
      add('hcl', 5, TUBE1, 'Cho khoảng 5 mL dung dịch hydrochloric acid vào ống (1).'),
      connect(TUBE1, TUBE2, 'Đậy ngay ống (1) bằng nút cao su có ống dẫn khí chữ L, đầu kia nhúng vào nước vôi trong ở ống (2).'),
      wait(30, { text: 'Lúc mới dẫn khí: nước vôi trong ở ống (2) vẩn đục.', until: (l) => l.mix(TUBE2).get('CaCO3') > 1e-5 }),
      wait(120, { speed: 3, text: 'Tiếp tục dẫn khí carbon dioxide một thời gian: ống (2) trong dần trở lại.', until: (l) => l.mix(TUBE2).get('CaCO3') < 5e-7 }),
      connect(TUBE1, null, 'Nhấc ống dẫn khí ra khỏi ống (2).'),
      say('Lúc đầu carbon dioxide tác dụng với calcium hydroxide tạo kết tủa calcium carbonate làm nước vôi vẩn đục. Khi dẫn khí lâu, kết tủa tan dần vì carbon dioxide dư tiếp tục phản ứng với calcium carbonate.'),
    ],
    result: {
      phenomena: [
        'Ống (1): đá vôi sủi bọt khí',
        'Lúc mới dẫn khí carbon dioxide vào: nước vôi trong vẩn đục',
        'Dẫn khí carbon dioxide một thời gian: nước vôi trong dần trở lại',
      ],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O', 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂'],
      explain: 'Carbon dioxide là oxide acid: nó tác dụng với dung dịch base calcium hydroxide tạo thành muối calcium carbonate và nước. Calcium carbonate không tan nên làm nước vôi trong vẩn đục; đây là cách nhận biết khí carbon dioxide. Khi carbon dioxide còn tiếp tục được dẫn vào, nó cùng với nước chuyển calcium carbonate thành calcium hydrogencarbonate tan được, nên dung dịch trong trở lại. Các oxide acid khác như SO₂, SO₃, P₂O₅ cũng tác dụng với dung dịch base tạo thành muối và nước.',
    },
  },
  {
    id: 'tinh-chat-oxide-base',
    title: 'Tính chất hóa học của oxide base',
    lesson: 'khtn8-b10', page: 46,
    concepts: ['oxide base', 'copper(II) oxide', 'acid', 'muối'],
    summary: 'Cho bột copper(II) oxide màu đen vào dung dịch sulfuric acid loãng rồi lắc đều. Có hiện tượng gì?',
    steps: [
      say('Copper(II) oxide là một oxide base, dạng bột màu đen. Ta cho nó vào dung dịch sulfuric acid loãng.'),
      focus(TUBE1),
      add('cuo', 0.08, TUBE1, 'Ống nghiệm: 1 thìa nhỏ bột copper(II) oxide.'),
      add('h2so4', 3, TUBE1, 'Thêm khoảng 3 mL dung dịch sulfuric acid loãng.'),
      stir(TUBE1, 'Lắc đều ống nghiệm.'),
      wait(60, { speed: 2, text: 'Bột màu đen tan dần, dung dịch chuyển sang màu xanh lam.' }),
      say('Copper(II) oxide tác dụng với sulfuric acid tạo thành dung dịch copper(II) sulfate màu xanh lam.'),
    ],
    result: {
      phenomena: [
        'Bột copper(II) oxide màu đen tan dần',
        'Dung dịch từ không màu chuyển sang màu xanh lam',
      ],
      equations: ['CuO + H₂SO₄ → CuSO₄ + H₂O'],
      explain: 'Copper(II) oxide là oxide base: nó tác dụng với dung dịch acid tạo thành muối và nước. Muối copper(II) sulfate tan trong nước tạo dung dịch màu xanh lam. Các oxide base khác như Na₂O, CaO, Fe₂O₃ cũng tác dụng với dung dịch acid tạo thành muối và nước, ví dụ gỉ sắt Fe₂O₃ tan trong hydrochloric acid; vì vậy acid được dùng để tẩy gỉ thép.',
    },
  },

  {
    id: 'tinh-chat-muoi',
    title: 'Tính chất hóa học của muối',
    lesson: 'khtn8-b11', page: 50,
    concepts: ['muối', 'kim loại', 'acid', 'base', 'phản ứng trao đổi', 'kết tủa'],
    summary: 'Bốn ống nghiệm: muối copper(II) sulfate với đinh sắt, muối barium chloride với acid và với muối khác, muối copper(II) sulfate với base. Ống nào có phản ứng, dấu hiệu là gì?',
    steps: [
      say('Ta tìm hiểu muối tác dụng với kim loại, với acid, với muối khác và với base, trong bốn ống nghiệm.'),
      focus(TUBE1, TUBE2, TUBE3, TUBE4),
      add('fe', 2, TUBE1, 'Ống (1): một đinh sắt đã làm sạch.'),
      add('bacl2', 1, TUBE2, 'Ống (2): khoảng 1 mL dung dịch barium chloride.'),
      add('bacl2', 1, TUBE3, 'Ống (3): khoảng 1 mL dung dịch barium chloride.'),
      add('cuso4', 1, TUBE4, 'Ống (4): khoảng 1 mL dung dịch copper(II) sulfate.'),
      add('cuso4', 2, TUBE1, 'Cho khoảng 2 mL dung dịch copper(II) sulfate vào ống (1).'),
      add('h2so4', 1, TUBE2, 'Cho khoảng 1 mL dung dịch sulfuric acid loãng vào ống (2).'),
      say('Ống (2) xuất hiện kết tủa trắng.'),
      add('na2so4', 1, TUBE3, 'Cho khoảng 1 mL dung dịch sodium sulfate vào ống (3).'),
      say('Ống (3) cũng xuất hiện kết tủa trắng.'),
      add('naoh', 1, TUBE4, 'Cho khoảng 1 mL dung dịch sodium hydroxide vào ống (4).'),
      say('Ống (4) xuất hiện kết tủa màu xanh lam.'),
      wait(120, { speed: 4, text: 'Quan sát đinh sắt ở ống (1): có lớp kim loại màu đỏ bám trên đinh, màu xanh của dung dịch nhạt dần.' }),
      say('Sắt đẩy đồng ra khỏi dung dịch muối. Barium chloride tạo kết tủa barium sulfate với sulfuric acid và với sodium sulfate. Copper(II) sulfate tạo kết tủa copper(II) hydroxide với sodium hydroxide.'),
    ],
    result: {
      phenomena: [
        'Ống (1): có lớp kim loại màu đỏ (đồng) bám trên đinh sắt, màu xanh của dung dịch nhạt dần',
        'Ống (2) và ống (3): xuất hiện kết tủa trắng',
        'Ống (4): xuất hiện kết tủa màu xanh lam',
      ],
      equations: [
        'Fe + CuSO₄ → FeSO₄ + Cu',
        'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
        'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',
        'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
      ],
      explain: 'Muối có các tính chất hóa học: dung dịch muối tác dụng với kim loại tạo muối mới và kim loại mới (sắt hoạt động mạnh hơn đồng nên đẩy được đồng ra); muối tác dụng với acid tạo muối mới và acid mới; hai dung dịch muối tác dụng với nhau tạo hai muối mới; dung dịch muối tác dụng với dung dịch base tạo muối mới và base mới. Các phản ứng ở ống (2), (3), (4) là phản ứng trao đổi: chúng xảy ra được vì sản phẩm có chất không tan (barium sulfate, copper(II) hydroxide).',
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
