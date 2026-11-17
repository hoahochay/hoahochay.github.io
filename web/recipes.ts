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
  /** Số đọc trên cân điện tử (đã trừ bì), g */
  balanceG(): number;
}

export type Step =
  | { kind: 'say'; text: string; hold?: number }
  | { kind: 'add'; chem: string; amount: number; vessel: number; text?: string }
  | { kind: 'wait'; seconds: number; speed?: number; text?: string; until?: (lab: LabState) => boolean }
  | { kind: 'heat'; vessel: number; on: boolean; text?: string }
  | { kind: 'stir'; vessel: number; text?: string }
  | { kind: 'probe'; tool: ToolKind; vessel: number; text?: string }
  | { kind: 'connect'; src: number; dst: number | null; text?: string }
  | { kind: 'invert'; vessel: number; text?: string }
  | { kind: 'weigh'; vessel: number | null; text?: string }
  | { kind: 'tare'; text?: string }
  | { kind: 'focus'; vessels: number[] | null };

/** Bài học trong SGK mà thí nghiệm thuộc về; thứ tự ở đây là thứ tự hiện trong danh sách */
export const LESSONS = {
  'khtn8-b2': 'KHTN 8 · Bài 2. Phản ứng hóa học',
  'khtn8-b4': 'KHTN 8 · Bài 4. Dung dịch và nồng độ',
  'khtn8-b5': 'KHTN 8 · Bài 5. Định luật bảo toàn khối lượng',
  'khtn8-b7': 'KHTN 8 · Bài 7. Tốc độ phản ứng và chất xúc tác',
  'khtn8-b8': 'KHTN 8 · Bài 8. Acid',
  'khtn8-b9': 'KHTN 8 · Bài 9. Base. Thang pH',
  'khtn8-b10': 'KHTN 8 · Bài 10. Oxide',
  'khtn8-b11': 'KHTN 8 · Bài 11. Muối',
} as const;
export type LessonId = keyof typeof LESSONS;

/** Mức độ theo lớp: lớp 8–9 / lớp 10–11 / lớp 12 */
export const LEVELS = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' } as const;
export const LEVEL_GRADES = { basic: 'lớp 8–9', intermediate: 'lớp 10–11', advanced: 'lớp 12' } as const;
export type Level = keyof typeof LEVELS;

export interface Recipe {
  id: string;
  title: string;
  lesson: LessonId;
  level: Level;
  /** Khái niệm chính, hiện dưới dạng thẻ */
  concepts: string[];
  /** Trang trong SGK có thí nghiệm này */
  page?: number;
  summary: string;
  steps: Step[];
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
const weigh = (vessel: number | null, text?: string): Step => ({ kind: 'weigh', vessel, text });
const tare = (text?: string): Step => ({ kind: 'tare', text });
const focus = (...vessels: number[]): Step => ({ kind: 'focus', vessels: vessels.length ? vessels : null });

export const RECIPES: Recipe[] = [
  {
    id: 'dau-hieu-chat-moi',
    title: 'Dấu hiệu nhận biết có chất mới tạo thành',
    lesson: 'khtn8-b2', level: 'basic', page: 14,
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
];
