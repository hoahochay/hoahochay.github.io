/**
 * Thí nghiệm mẫu: chuỗi thao tác + lời thuyết minh, phát lại tự động cho học sinh xem.
 * Ống nghiệm đánh số 0–3, cốc là 4.
 */
import { Mixture } from '../src';
import type { ToolKind } from './probes';

export const TUBE1 = 0, TUBE2 = 1, TUBE3 = 2, TUBE4 = 3, BEAKER = 4;

/** Trạng thái phòng thí nghiệm mà điều kiện `until` có thể đọc */
export interface LabState {
  mix(vessel: number): Mixture;
  tempC(vessel: number): number;
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
  | { kind: 'focus'; vessels: number[] | null };

/** 12 chủ đề theo danh mục docs/thi-nghiem-rsc.md */
export const TOPICS = {
  acids: 'Acid, base và pH',
  salts: 'Muối, kết tủa và nhận biết ion',
  metals: 'Kim loại và dãy hoạt động',
  groups: 'Các nhóm nguyên tố',
  gases: 'Chất khí',
  rates: 'Tốc độ phản ứng và xúc tác',
  energy: 'Năng lượng hóa học',
  equilibrium: 'Cân bằng hóa học',
  redox: 'Oxi hóa – khử và điện hóa',
  quantitative: 'Định lượng',
  separation: 'Tách chất và tinh chế',
  organic: 'Hóa hữu cơ và polime',
} as const;
export type TopicId = keyof typeof TOPICS;

/** Mức độ, ứng với độ tuổi RSC 11–14 / 14–16 / 16–18 */
export const LEVELS = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' } as const;
export type Level = keyof typeof LEVELS;

export interface Recipe {
  id: string;
  title: string;
  topic: TopicId;
  level: Level;
  /** Khái niệm chính, hiện dưới dạng thẻ */
  concepts: string[];
  /** Bài gốc trên RSC Education */
  source: { title: string; url: string };
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
const focus = (...vessels: number[]): Step => ({ kind: 'focus', vessels: vessels.length ? vessels : null });

export const RECIPES: Recipe[] = [
  {
    id: 'mg-hcl',
    title: 'Kim loại tác dụng với acid',
    topic: 'metals', level: 'intermediate',
    concepts: ['kim loại + acid', 'khí hydrogen', 'phản ứng tỏa nhiệt'],
    source: { title: 'Reactions of metals with acids producing salts', url: 'https://edu.rsc.org/experiments/reactions-of-metals-with-acids-producing-salts/446.article' },
    summary: 'Thả dải magnesium vào dung dịch HCl, quan sát khí thoát ra và sự tỏa nhiệt.',
    steps: [
      focus(TUBE1),
      say('Acid tác dụng với kim loại đứng trước H trong dãy hoạt động hóa học, giải phóng khí hydrogen.'),
      add('hcl', 5, TUBE1),
      add('mg_strip', 0.05, TUBE1, 'Thả một dải magnesium (0,05 g) vào ống nghiệm.'),
      wait(12, { text: 'Quan sát: bọt khí thoát ra rất mạnh trên bề mặt dải Mg.' }),
      wait(120, { speed: 5, text: 'Tua nhanh: dải Mg tan dần, ống nghiệm nóng lên. Để ý nhiệt độ trên bảng bên phải.', until: (l) => l.mix(TUBE1).get('Mg') < 1e-5 }),
      say('Dải magnesium đã tan hết. Dung dịch thu được là MgCl₂, khí thoát ra là H₂.'),
    ],
    result: {
      phenomena: ['Sủi bọt khí không màu', 'Dải Mg tan dần rồi hết', 'Ống nghiệm nóng lên khoảng 15 °C'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑'],
      explain: 'Mg đứng trước H trong dãy hoạt động hóa học nên đẩy được H ra khỏi acid. Phản ứng tỏa nhiệt mạnh. Tốc độ giảm dần vì dải Mg nhỏ lại và nồng độ acid giảm.',
    },
  },
  {
    id: 'surface-area',
    title: 'Diện tích bề mặt và tốc độ phản ứng',
    topic: 'rates', level: 'intermediate',
    concepts: ['tốc độ phản ứng', 'diện tích bề mặt'],
    source: { title: 'The rate of reaction of magnesium with hydrochloric acid', url: 'https://edu.rsc.org/experiments/the-rate-of-reaction-of-magnesium-with-hydrochloric-acid/1916.article' },
    summary: 'So sánh magnesium dạng dải và dạng bột trong cùng một dung dịch acid.',
    steps: [
      focus(TUBE1, TUBE2),
      say('Hai ống nghiệm chứa cùng một lượng HCl. Ống 1 cho Mg dạng dải, ống 2 cho cùng khối lượng Mg dạng bột.'),
      add('hcl', 5, TUBE1),
      add('hcl', 5, TUBE2),
      add('mg_strip', 0.05, TUBE1),
      add('mg_powder', 0.05, TUBE2),
      wait(8, { text: 'Ống 2 (bột) sủi bọt dữ dội và hết gần như ngay lập tức; ống 1 (dải) sủi đều và lâu hơn.' }),
      wait(180, { speed: 5, text: 'Tua nhanh cho tới khi dải Mg ở ống 1 tan hết.', until: (l) => l.mix(TUBE1).get('Mg') < 1e-5 }),
      say('Cùng lượng chất, nhưng dạng bột có diện tích tiếp xúc lớn hơn rất nhiều nên phản ứng nhanh hơn.'),
    ],
    result: {
      phenomena: ['Ống 2 (bột Mg): sủi bọt rất mạnh, kết thúc sau vài giây', 'Ống 1 (dải Mg): sủi bọt đều, kéo dài khoảng 1 phút'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑'],
      explain: 'Phản ứng xảy ra trên bề mặt chất rắn. Chia nhỏ chất rắn làm tăng diện tích bề mặt, nhiều nguyên tử Mg tiếp xúc với H⁺ cùng lúc hơn, nên tốc độ phản ứng tăng.',
    },
  },
  {
    id: 'neutralization',
    title: 'Phản ứng trung hòa và chất chỉ thị',
    topic: 'acids', level: 'intermediate',
    concepts: ['trung hòa', 'pH', 'chất chỉ thị'],
    source: { title: 'Titrating sodium hydroxide with hydrochloric acid', url: 'https://edu.rsc.org/concentration-of-solutions-and-titration/titrating-sodium-hydroxide-with-hydrochloric-acid/697.article' },
    summary: 'Nhỏ từ từ HCl vào NaOH có phenolphthalein cho tới khi mất màu hồng.',
    steps: [
      focus(BEAKER),
      add('naoh', 5, BEAKER),
      add('water', 20, BEAKER, 'Pha loãng bằng 20 mL nước cất.'),
      add('phenol', 2, BEAKER, 'Nhỏ 2 giọt phenolphthalein: dung dịch base chuyển màu hồng.'),
      wait(2),
      say('Bây giờ thêm từ từ dung dịch HCl 1M. Theo dõi pH ở bảng bên phải.'),
      add('hcl', 3, BEAKER),
      stir(BEAKER),
      say('Vẫn còn màu hồng: NaOH còn dư, pH vẫn lớn hơn 12.'),
      add('hcl', 1.5, BEAKER),
      stir(BEAKER),
      add('hcl', 0.4, BEAKER, 'Gần tới điểm tương đương: chỉ thêm 0,4 mL.'),
      stir(BEAKER),
      say('Màu hồng vẫn còn. Thêm từng giọt cuối cùng…'),
      add('hcl', 0.1, BEAKER, 'Thêm 2 giọt HCl cuối cùng.'),
      stir(BEAKER),
      wait(2, { text: 'Dung dịch mất màu: lượng acid vừa đủ trung hòa lượng base, pH ≈ 7.' }),
    ],
    result: {
      phenomena: ['Dung dịch NaOH + phenolphthalein có màu hồng', 'Khi thêm đủ 5 mL HCl 1M, dung dịch mất màu', 'Dung dịch hơi ấm lên'],
      equations: ['NaOH + HCl → NaCl + H₂O', 'H⁺ + OH⁻ → H₂O'],
      explain: 'Phenolphthalein có màu hồng khi pH > 8,2 và không màu trong môi trường trung tính hoặc acid. 5 mmol HCl trung hòa vừa đủ 5 mmol NaOH. Gần điểm tương đương, chỉ một giọt acid cũng làm pH giảm rất mạnh (bước nhảy pH).',
    },
  },
  {
    id: 'cuoh2',
    title: 'Điều chế và hòa tan Cu(OH)₂',
    topic: 'salts', level: 'intermediate',
    concepts: ['kết tủa', 'Ksp', 'base không tan'],
    source: { title: 'Microscale reactions of positive ions with sodium hydroxide', url: 'https://edu.rsc.org/experiments/microscale-reactions-of-positive-ions-with-sodium-hydroxide/757.article' },
    summary: 'Cho NaOH vào CuSO₄ tạo kết tủa xanh lơ, sau đó hòa tan kết tủa bằng acid.',
    steps: [
      focus(TUBE2),
      add('cuso4', 2, TUBE2, 'Lấy 2 mL dung dịch CuSO₄ màu xanh lam.'),
      add('naoh', 2, TUBE2, 'Nhỏ thêm 2 mL NaOH.'),
      wait(4, { text: 'Xuất hiện kết tủa xanh lơ Cu(OH)₂, dung dịch mất màu xanh lam.' }),
      wait(150, { speed: 20, text: 'Để yên: kết tủa lắng dần xuống đáy ống.' }),
      say('Cu(OH)₂ là base không tan, nhưng vẫn tác dụng được với acid. Thử thêm HCl.'),
      add('hcl', 3, TUBE2),
      stir(TUBE2),
      wait(5, { text: 'Kết tủa tan hết, dung dịch trở lại màu xanh lam của ion Cu²⁺.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa xanh lơ', 'Kết tủa lắng dần khi để yên', 'Thêm HCl: kết tủa tan, dung dịch xanh lam'],
      equations: ['CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄', 'Cu(OH)₂ + 2HCl → CuCl₂ + 2H₂O'],
      explain: 'Ion Cu²⁺ kết hợp với OH⁻ tạo Cu(OH)₂ rất ít tan (Ksp ≈ 2·10⁻²⁰). Trong acid, H⁺ lấy đi OH⁻ nên kết tủa tan trở lại.',
    },
  },
  {
    id: 'fe-cu',
    title: 'Iron đẩy copper ra khỏi dung dịch muối',
    topic: 'metals', level: 'intermediate',
    concepts: ['phản ứng thế', 'dãy hoạt động'],
    source: { title: 'Displacement reactions between metals and their salts', url: 'https://edu.rsc.org/experiments/displacement-reactions-between-metals-and-their-salts/720.article' },
    summary: 'Ngâm đinh sắt (iron) trong CuSO₄, quan sát copper màu đỏ bám lên đinh.',
    steps: [
      focus(TUBE3),
      add('cuso4', 5, TUBE3),
      add('fe', 2, TUBE3, 'Thả một chiếc đinh sắt sạch vào dung dịch CuSO₄.'),
      wait(5, { text: 'Phản ứng xảy ra chậm, cần thời gian để thấy rõ.' }),
      wait(1800, { speed: 60, text: 'Tua nhanh 30 phút: đinh sắt phủ dần một lớp copper màu đỏ, màu xanh của dung dịch nhạt đi.' }),
      say('Copper bám trên đinh, dung dịch chuyển từ xanh lam sang xanh lục nhạt do có ion Fe²⁺.'),
    ],
    result: {
      phenomena: ['Có lớp kim loại màu đỏ bám trên đinh sắt', 'Màu xanh lam của dung dịch nhạt dần'],
      equations: ['Fe + CuSO₄ → FeSO₄ + Cu↓'],
      explain: 'Fe hoạt động hóa học mạnh hơn Cu nên đẩy được Cu ra khỏi dung dịch muối. Ion Cu²⁺ (xanh lam) bị thay bằng Fe²⁺ (xanh lục rất nhạt).',
    },
  },
  {
    id: 'na-water',
    title: 'Sodium tác dụng với nước',
    topic: 'groups', level: 'basic',
    concepts: ['kim loại kiềm', 'base'],
    source: { title: 'Reactivity trends of the alkali metals', url: 'https://edu.rsc.org/experiments/reactivity-trends-of-the-alkali-metals/731.article' },
    summary: 'Thả mẩu sodium vào nước có phenolphthalein.',
    steps: [
      focus(BEAKER),
      add('water', 40, BEAKER),
      add('phenol', 2, BEAKER, 'Nhỏ 2 giọt phenolphthalein: nước trung tính nên không màu.'),
      say('Sodium được bảo quản trong dầu hỏa vì phản ứng mạnh với nước và không khí. Chỉ dùng mẩu nhỏ bằng hạt đỗ.'),
      add('na', 0.1, BEAKER),
      wait(30, { text: 'Mẩu Na nổi, chạy trên mặt nước, có khí thoát ra. Dung dịch chuyển hồng vì tạo NaOH.', until: (l) => l.mix(BEAKER).get('Na') < 1e-5 }),
      say('Sodium đã phản ứng hết. Dung dịch có màu hồng: đây là dung dịch base NaOH.'),
    ],
    result: {
      phenomena: ['Mẩu Na nổi và chạy trên mặt nước', 'Có khí không màu thoát ra', 'Dung dịch chuyển màu hồng'],
      equations: ['2Na + 2H₂O → 2NaOH + H₂↑'],
      explain: 'Na là kim loại rất mạnh, khử nước ở nhiệt độ thường. Na nhẹ hơn nước nên nổi; khí H₂ sinh ra đẩy mẩu Na chạy trên mặt nước. NaOH tạo thành làm phenolphthalein chuyển hồng.',
    },
  },
  {
    id: 'h2o2',
    title: 'Chất xúc tác: phân hủy H₂O₂',
    topic: 'rates', level: 'intermediate',
    concepts: ['chất xúc tác'],
    source: { title: 'Hydrogen peroxide decomposition using different catalysts', url: 'https://edu.rsc.org/experiments/hydrogen-peroxide-decomposition-using-different-catalysts/831.article' },
    summary: 'So sánh H₂O₂ có và không có xúc tác MnO₂.',
    steps: [
      focus(TUBE1, TUBE2),
      add('h2o2', 5, TUBE1),
      add('h2o2', 5, TUBE2),
      wait(4, { text: 'Hai ống chứa hydrogen peroxide 3%. Không có hiện tượng gì: H₂O₂ phân hủy rất chậm.' }),
      add('mno2', 0.1, TUBE2, 'Cho một ít bột MnO₂ vào ống 2.'),
      wait(25, { text: 'Ống 2 sủi bọt khí O₂ mạnh, ống 1 vẫn yên lặng.' }),
      wait(60, { speed: 5, text: 'Tua nhanh: phản ứng ở ống 2 chậm dần rồi dừng. Lượng MnO₂ không đổi.' }),
    ],
    result: {
      phenomena: ['Ống không có MnO₂: không thấy hiện tượng', 'Ống có MnO₂: sủi bọt khí mạnh, ống hơi nóng lên', 'Bột MnO₂ còn nguyên sau phản ứng'],
      equations: ['2H₂O₂ —MnO₂→ 2H₂O + O₂↑'],
      explain: 'MnO₂ là chất xúc tác: làm phản ứng xảy ra nhanh hơn rất nhiều nhưng không bị tiêu hao. Có thể thử khí O₂ bằng que đóm còn tàn đỏ: que đóm bùng cháy.',
    },
  },
  {
    id: 'golden-rain',
    title: '"Mưa vàng" PbI₂',
    topic: 'salts', level: 'intermediate',
    concepts: ['độ tan', 'kết tinh lại', 'Ksp theo nhiệt độ'],
    source: { title: 'Investigating the solubility of lead halides', url: 'https://edu.rsc.org/experiments/investigating-the-solubility-of-lead-halides/473.article' },
    summary: 'Kết tủa vàng PbI₂ tan khi đun nóng và kết tinh lại khi để nguội.',
    steps: [
      focus(TUBE4),
      add('pbno3', 5, TUBE4),
      add('ki', 5, TUBE4),
      wait(3, { text: 'Xuất hiện kết tủa màu vàng tươi PbI₂.' }),
      heat(TUBE4, true, 'Đun ống nghiệm trên ngọn lửa đèn cồn.'),
      wait(400, { speed: 5, text: 'Nhiệt độ tăng, độ tan của PbI₂ tăng mạnh: kết tủa tan dần.', until: (l) => l.mix(TUBE4).get('PbI2') < 1e-6 && l.tempC(TUBE4) > 80 }),
      say('Kết tủa đã tan hết, dung dịch trong suốt.'),
      heat(TUBE4, false, 'Tắt đèn cồn, để ống nghiệm nguội tự nhiên.'),
      wait(1500, { speed: 20, text: 'Khi nguội, PbI₂ kết tinh trở lại thành những tinh thể vàng lấp lánh: "mưa vàng".', until: (l) => l.tempC(TUBE4) < 33 }),
    ],
    result: {
      phenomena: ['Kết tủa vàng xuất hiện ngay khi trộn', 'Đun nóng: kết tủa tan, dung dịch trong suốt', 'Để nguội: tinh thể vàng xuất hiện trở lại'],
      equations: ['Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃'],
      explain: 'Quá trình hòa tan PbI₂ thu nhiệt nên độ tan tăng mạnh theo nhiệt độ (Ksp ở 90 °C lớn gấp khoảng 100 lần ở 25 °C). Khi nguội, dung dịch trở nên quá bão hòa và PbI₂ kết tinh lại.',
    },
  },
  {
    id: 'chloride-test',
    title: 'Nhận biết ion chloride',
    topic: 'salts', level: 'intermediate',
    concepts: ['nhận biết ion', 'kết tủa'],
    source: { title: 'Testing salts for anions and cations', url: 'https://edu.rsc.org/experiments/testing-salts-for-anions-and-cations/464.article' },
    summary: 'Dùng AgNO₃ nhận biết ion Cl⁻.',
    steps: [
      focus(TUBE1),
      add('nacl', 2, TUBE1),
      add('agno3', 1, TUBE1, 'Nhỏ vài giọt AgNO₃ vào dung dịch NaCl.'),
      wait(4, { text: 'Xuất hiện kết tủa trắng AgCl.' }),
      wait(120, { speed: 20, text: 'Để yên: kết tủa lắng xuống đáy.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa trắng'],
      equations: ['AgNO₃ + NaCl → AgCl↓ + NaNO₃', 'Ag⁺ + Cl⁻ → AgCl↓'],
      explain: 'AgCl rất ít tan (Ksp ≈ 1,8·10⁻¹⁰) nên dung dịch AgNO₃ là thuốc thử nhận biết ion Cl⁻. Kết tủa không tan trong acid HNO₃.',
    },
  },
  {
    id: 'sulfate-test',
    title: 'Nhận biết ion sulfate',
    topic: 'salts', level: 'intermediate',
    concepts: ['nhận biết ion', 'kết tủa'],
    source: { title: 'Testing salts for anions and cations', url: 'https://edu.rsc.org/experiments/testing-salts-for-anions-and-cations/464.article' },
    summary: 'Dùng BaCl₂ nhận biết sulfuric acid và muối sulfate.',
    steps: [
      focus(TUBE2),
      add('h2so4', 2, TUBE2),
      add('bacl2', 2, TUBE2),
      wait(4, { text: 'Xuất hiện kết tủa trắng BaSO₄.' }),
      wait(120, { speed: 20, text: 'Để yên: kết tủa lắng xuống.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa trắng, không tan trong acid'],
      equations: ['H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl', 'Ba²⁺ + SO₄²⁻ → BaSO₄↓'],
      explain: 'BaSO₄ gần như không tan, kể cả trong acid mạnh, nên ion Ba²⁺ dùng để nhận biết gốc sulfate.',
    },
  },
  {
    id: 'caco3-hcl',
    title: 'Đá vôi tác dụng với acid',
    topic: 'acids', level: 'basic',
    concepts: ['acid + carbonate', 'khí carbon dioxide'],
    source: { title: 'Some reactions of carbon dioxide', url: 'https://edu.rsc.org/resources/microscale-chemistry-some-reactions-of-carbon-dioxide/529.article' },
    summary: 'Cho đá vôi vào hydrochloric acid, quan sát khí CO₂.',
    steps: [
      focus(TUBE1),
      add('hcl', 5, TUBE1),
      add('caco3', 0.5, TUBE1, 'Cho một viên đá vôi nhỏ vào.'),
      wait(10, { text: 'Viên đá vôi sủi bọt khí CO₂.' }),
      wait(240, { speed: 10, text: 'Tua nhanh: viên đá vôi nhỏ dần, bọt khí thưa dần khi acid cạn.' }),
    ],
    result: {
      phenomena: ['Sủi bọt khí không màu trên bề mặt đá vôi', 'Viên đá vôi tan dần'],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑'],
      explain: 'Acid mạnh đẩy carbonic acid yếu ra khỏi muối; H₂CO₃ không bền, phân hủy thành CO₂ và H₂O. Khí CO₂ làm vẩn đục nước vôi trong.',
    },
  },
  {
    id: 'feoh3',
    title: 'Iron(III) hydroxide nâu đỏ',
    topic: 'salts', level: 'intermediate',
    concepts: ['kết tủa', 'nhận biết ion'],
    source: { title: 'Microscale reactions of positive ions with sodium hydroxide', url: 'https://edu.rsc.org/experiments/microscale-reactions-of-positive-ions-with-sodium-hydroxide/757.article' },
    summary: 'Cho NaOH vào FeCl₃ tạo kết tủa nâu đỏ.',
    steps: [
      focus(TUBE3),
      add('fecl3', 2, TUBE3, 'Lấy 2 mL dung dịch FeCl₃ màu vàng nâu.'),
      add('naoh', 1, TUBE3),
      wait(4, { text: 'Xuất hiện kết tủa màu nâu đỏ Fe(OH)₃.' }),
      wait(150, { speed: 20, text: 'Để yên: kết tủa lắng xuống.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa nâu đỏ', 'Dung dịch phía trên gần như không màu'],
      equations: ['FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl'],
      explain: 'Ion Fe³⁺ tạo với OH⁻ kết tủa Fe(OH)₃ màu nâu đỏ, cực kì ít tan. Đây là phản ứng nhận biết ion Fe³⁺.',
    },
  },
  {
    id: 'o2-test',
    title: 'Điều chế và nhận biết khí oxygen',
    topic: 'gases', level: 'basic',
    concepts: ['chất xúc tác', 'nhận biết khí'],
    source: { title: 'Generating, collecting and testing gases', url: 'https://edu.rsc.org/resources/collections/nuffield-practical-collection' },
    summary: 'Phân hủy H₂O₂ có xúc tác MnO₂, thử khí sinh ra bằng que đóm còn tàn đỏ.',
    steps: [
      focus(TUBE1, TUBE2),
      say('Cả hai ống chứa hydrogen peroxide. Chỉ ống 2 được thêm chất xúc tác MnO₂.'),
      add('h2o2', 5, TUBE1),
      add('h2o2', 5, TUBE2),
      add('mno2', 0.1, TUBE2),
      wait(8, { text: 'Ống 2 sủi bọt mạnh. Khí oxygen dồn đầy phần trên của ống, đẩy không khí ra ngoài.' }),
      probe('glowing', TUBE1, 'Thử ống 1 trước: đưa que đóm còn tàn đỏ vào miệng ống.'),
      say('Ống 1 chỉ có không khí (21% oxygen): que đóm không bùng cháy.'),
      probe('glowing', TUBE2, 'Bây giờ thử ống 2.'),
      say('Que đóm bùng cháy: khí trong ống 2 giàu oxygen hơn hẳn không khí.'),
    ],
    result: {
      phenomena: ['Ống có MnO₂ sủi bọt khí mạnh', 'Que đóm còn tàn đỏ bùng cháy ở miệng ống 2', 'Ở ống 1 que đóm không bùng cháy'],
      equations: ['2H₂O₂ —MnO₂→ 2H₂O + O₂↑'],
      explain: 'Oxygen duy trì sự cháy. Không khí chỉ có khoảng 21% oxygen nên không đủ làm tàn đỏ bùng lên; khí oxygen gần như nguyên chất thì làm que đóm cháy trở lại. Đây là cách nhận biết khí oxygen.',
    },
  },
  {
    id: 'h2-test',
    title: 'Nhận biết khí hydrogen',
    topic: 'gases', level: 'basic',
    concepts: ['nhận biết khí', 'khí hydrogen'],
    source: { title: 'Generating, collecting and testing gases', url: 'https://edu.rsc.org/resources/collections/nuffield-practical-collection' },
    summary: 'Thử khí sinh ra từ Mg + HCl bằng que đóm đang cháy.',
    steps: [
      focus(TUBE1),
      add('hcl', 5, TUBE1),
      add('mg_strip', 0.05, TUBE1),
      wait(5, { text: 'Khí hydrogen thoát ra, trộn lẫn với không khí ở phần trên ống nghiệm.' }),
      probe('burning', TUBE1, 'Đưa que đóm đang cháy lại gần miệng ống.'),
      say('Nghe tiếng nổ nhỏ "bụp": hỗn hợp hydrogen và không khí cháy rất nhanh.'),
      wait(180, { speed: 5, text: 'Chờ phản ứng kết thúc rồi thử lại.', until: (l) => l.mix(TUBE1).get('Mg') < 1e-5 }),
      wait(10, { text: 'Hydrogen rất nhẹ nên bay ra khỏi ống nghiệm chỉ trong vài giây.' }),
      probe('burning', TUBE1, 'Thử lại bằng que đóm đang cháy.'),
      say('Không còn tiếng nổ: hydrogen đã bay hết khỏi ống nghiệm.'),
    ],
    result: {
      phenomena: ['Khi đang sủi bọt: que đóm cháy gây tiếng nổ nhỏ "bụp"', 'Sau khi hết phản ứng vài giây: không còn hiện tượng'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑', '2H₂ + O₂ —t°→ 2H₂O'],
      explain: 'Hỗn hợp hydrogen với không khí (từ 4% đến 75% H₂) cháy rất nhanh, gây tiếng nổ nhỏ. Hydrogen là khí nhẹ nhất nên thoát khỏi miệng ống rất nhanh; vì vậy khi thu khí hydrogen phải úp ngược ống nghiệm.',
    },
  },
  {
    id: 'co2-test',
    title: 'Khí carbon dioxide không duy trì sự cháy',
    topic: 'gases', level: 'basic',
    concepts: ['nhận biết khí', 'oxide acid'],
    source: { title: 'Generating, collecting and testing gases', url: 'https://edu.rsc.org/resources/collections/nuffield-practical-collection' },
    summary: 'Thu CO₂ từ đá vôi và acid, thử bằng que đóm đang cháy và giấy quỳ ẩm.',
    steps: [
      focus(TUBE1),
      add('hcl', 5, TUBE1),
      add('caco3', 0.5, TUBE1),
      wait(25, { text: 'CO₂ nặng hơn không khí nên đọng lại, dần chiếm chỗ không khí trong ống.' }),
      probe('burning', TUBE1, 'Đưa que đóm đang cháy vào miệng ống.'),
      say('Que đóm tắt: CO₂ không duy trì sự cháy.'),
      probe('litmus', TUBE1, 'Đưa giấy quỳ tím ẩm vào miệng ống.'),
      say('Giấy quỳ ẩm ngả sang đỏ: CO₂ tan vào nước trên giấy tạo carbonic acid yếu.'),
    ],
    result: {
      phenomena: ['Đá vôi sủi bọt khí', 'Que đóm đang cháy bị tắt ở miệng ống', 'Giấy quỳ tím ẩm chuyển sang màu đỏ'],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑', 'CO₂ + H₂O ⇌ H₂CO₃'],
      explain: 'CO₂ không cháy và không duy trì sự cháy; vì nặng hơn không khí (44 so với 29) nên đọng lại trong ống. CO₂ là oxide acid: tan trong nước tạo H₂CO₃ làm quỳ tím hóa đỏ. Ứng dụng: bình chữa cháy CO₂.',
    },
  },
  {
    id: 'nh3-test',
    title: 'Ammonia làm quỳ tím ẩm hóa xanh',
    topic: 'gases', level: 'intermediate',
    concepts: ['nhận biết khí', 'base yếu', 'định luật Henry'],
    source: { title: 'Making and testing ammonia', url: 'https://edu.rsc.org/experiments/making-and-testing-ammonia/433.article' },
    summary: 'Khí NH₃ bay lên từ dung dịch ammonia làm giấy quỳ ẩm đổi màu.',
    steps: [
      focus(TUBE3, TUBE4),
      add('nh3', 5, TUBE3, 'Ống 3: dung dịch ammonia.'),
      add('water', 5, TUBE4, 'Ống 4: nước cất để so sánh.'),
      wait(6, { text: 'Ammonia dễ bay hơi: khí NH₃ thoát ra khỏi dung dịch dù không sủi bọt.' }),
      probe('litmus', TUBE4, 'Đưa giấy quỳ tím ẩm vào miệng ống nước cất.'),
      say('Giấy quỳ không đổi màu.'),
      probe('litmus', TUBE3, 'Bây giờ đưa giấy quỳ ẩm vào miệng ống ammonia (không chạm vào dung dịch).'),
      say('Giấy quỳ chuyển xanh dù không chạm vào dung dịch: khí NH₃ đã tan vào lớp nước trên giấy.'),
    ],
    result: {
      phenomena: ['Giấy quỳ ẩm ở miệng ống nước cất không đổi màu', 'Giấy quỳ ẩm ở miệng ống ammonia chuyển xanh'],
      equations: ['NH₃ + H₂O ⇌ NH₄⁺ + OH⁻'],
      explain: 'NH₃ là khí tan rất nhiều trong nước và dễ bay hơi khỏi dung dịch. Khi gặp nước trên giấy quỳ, NH₃ nhận H⁺ của nước tạo OH⁻ nên có tính base, làm quỳ tím hóa xanh. Đây là cách nhận biết khí ammonia.',
    },
  },
  {
    id: 'co2-limewater',
    title: 'Dẫn khí CO₂ vào nước vôi trong',
    topic: 'gases', level: 'intermediate',
    concepts: ['nhận biết khí', 'kết tủa', 'CO₂ dư'],
    source: { title: 'Some reactions of carbon dioxide', url: 'https://edu.rsc.org/resources/microscale-chemistry-some-reactions-of-carbon-dioxide/529.article' },
    summary: 'Nước vôi trong vẩn đục rồi trong trở lại khi sục CO₂ dư.',
    steps: [
      focus(TUBE1, TUBE2),
      add('limewater', 5, TUBE2, 'Ống 2: nước vôi trong Ca(OH)₂.'),
      add('hcl', 5, TUBE1, 'Ống 1: hydrochloric acid để điều chế CO₂.'),
      add('caco3', 0.5, TUBE1),
      connect(TUBE1, TUBE2, 'Đậy nút ống 1, nhúng đầu ống dẫn khí ngập trong nước vôi trong.'),
      wait(6, { text: 'Lúc đầu chỉ có không khí trong ống 1 bị đẩy sang, nước vôi vẫn trong.' }),
      wait(14, { text: 'Khi CO₂ tới, nước vôi trong vẩn đục: CaCO₃ kết tủa trắng.' }),
      say('CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O'),
      wait(150, {
        speed: 5, text: 'Tiếp tục sục CO₂ dư: kết tủa tan dần, dung dịch trong trở lại.',
        until: (l) => l.mix(TUBE2).get('CaCO3') < 1e-7,
      }),
      connect(TUBE1, null),
      say('CaCO₃ tan trong nước có CO₂ tạo calcium hydrogencarbonate Ca(HCO₃)₂ tan được.'),
    ],
    result: {
      phenomena: ['Đầu ống dẫn sủi bọt khí trong nước vôi', 'Nước vôi trong vẩn đục (kết tủa trắng)', 'Sục CO₂ dư một lúc thì dung dịch trong trở lại'],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑', 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂'],
      explain: 'Nước vôi trong dùng để nhận biết CO₂. Khi CO₂ dư, kết tủa CaCO₃ tan thành Ca(HCO₃)₂. Đây cũng là cách nước mưa có CO₂ hòa tan đá vôi, tạo nên hang động và thạch nhũ.',
    },
  },
  {
    id: 'h2-collect',
    title: 'Thu khí hydrogen: ngửa ống hay úp ống?',
    topic: 'gases', level: 'basic',
    concepts: ['thu khí', 'khối lượng mol khí'],
    source: { title: 'Generating, collecting and testing gases', url: 'https://edu.rsc.org/resources/collections/nuffield-practical-collection' },
    summary: 'So sánh thu H₂ vào ống để ngửa và ống úp ngược, rồi thử bằng que đóm.',
    steps: [
      focus(TUBE1, TUBE2, TUBE3),
      invert(TUBE3, 'Úp ngược ống 3, miệng ống hướng xuống.'),
      add('hcl', 5, TUBE1),
      add('mg_strip', 0.05, TUBE1),
      connect(TUBE1, TUBE2, 'Đậy nút ống 1, dẫn khí vào ống 2 để ngửa.'),
      wait(15, { text: 'Khí hydrogen đi vào ống 2 nhưng nhẹ nên bốc lên, thoát ra khỏi miệng ống.' }),
      connect(TUBE1, TUBE3, 'Chuyển ống dẫn sang ống 3 đang úp ngược.'),
      wait(20, { text: 'Hydrogen nhẹ hơn không khí, dồn lên đáy ống 3 và đẩy không khí ra qua miệng ống phía dưới.' }),
      connect(TUBE1, null),
      probe('burning', TUBE2, 'Thử ống 2 (để ngửa) bằng que đóm đang cháy.'),
      say('Không có tiếng nổ: hydrogen trong ống ngửa đã bay đi hết.'),
      probe('burning', TUBE3, 'Thử ống 3 (úp ngược): đưa que đóm lên miệng ống.'),
      say('Nổ "bụp": ống úp ngược đã giữ được khí hydrogen.'),
    ],
    result: {
      phenomena: ['Ống để ngửa: que đóm cháy bình thường, không có hiện tượng', 'Ống úp ngược: có tiếng nổ nhỏ "bụp"'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑', '2H₂ + O₂ —t°→ 2H₂O'],
      explain: 'Hydrogen nhẹ hơn không khí rất nhiều (2 so với 29) nên phải thu bằng cách úp ngược ống (đẩy không khí). Ngược lại, khí nặng hơn không khí như CO₂, O₂ được thu bằng cách để ngửa bình.',
    },
  },
  {
    id: 'alkali-water',
    title: 'So sánh Li, Na, K tác dụng với nước',
    topic: 'groups', level: 'intermediate',
    concepts: ['kim loại kiềm', 'xu hướng trong nhóm'],
    source: { title: 'Reactivity trends of the alkali metals', url: 'https://edu.rsc.org/experiments/reactivity-trends-of-the-alkali-metals/731.article' },
    summary: 'Ba kim loại cùng nhóm IA: đi từ trên xuống, phản ứng với nước mạnh dần.',
    steps: [
      focus(TUBE1, TUBE2, TUBE3),
      add('water', 5, TUBE1),
      add('water', 5, TUBE2),
      add('water', 5, TUBE3),
      add('phenol', 1, TUBE1),
      add('phenol', 1, TUBE2),
      add('phenol', 1, TUBE3),
      say('Ống 1: lithium (chu kỳ 2), ống 2: sodium (chu kỳ 3), ống 3: potassium (chu kỳ 4). Cả ba đều thuộc nhóm IA.'),
      add('li', 0.01, TUBE1),
      add('na', 0.05, TUBE2),
      add('k', 0.05, TUBE3),
      wait(6, { text: 'Potassium phản ứng dữ dội, bốc cháy với ngọn lửa tím; sodium chạy nhanh trên mặt nước; lithium sủi bọt nhẹ nhàng.' }),
      wait(60, { speed: 5, text: 'Chờ lithium phản ứng hết.', until: (l) => l.mix(TUBE1).get('Li') < 1e-6 }),
      say('Cả ba dung dịch đều hồng: đều tạo ra base mạnh (LiOH, NaOH, KOH).'),
    ],
    result: {
      phenomena: ['Li: sủi bọt khí đều, tan chậm', 'Na: chạy nhanh trên mặt nước, tan trong vài giây', 'K: phản ứng mãnh liệt, bốc cháy với ngọn lửa màu tím hồng', 'Cả ba dung dịch làm phenolphthalein chuyển hồng'],
      equations: ['2Li + 2H₂O → 2LiOH + H₂↑', '2Na + 2H₂O → 2NaOH + H₂↑', '2K + 2H₂O → 2KOH + H₂↑'],
      explain: 'Trong một nhóm A, đi từ trên xuống bán kính nguyên tử tăng, electron lớp ngoài cùng ở xa hạt nhân hơn nên dễ bị tách ra: tính kim loại tăng dần từ Li đến K. Đây là một quy luật biến đổi tuần hoàn.',
    },
  },
  {
    id: 'metal-activity',
    title: 'Dãy hoạt động hóa học của kim loại',
    topic: 'metals', level: 'intermediate',
    concepts: ['dãy hoạt động', 'kim loại + acid'],
    source: { title: 'Microscale reactions of metals with acids', url: 'https://edu.rsc.org/experiments/microscale-reactions-of-metals-with-acids/509.article' },
    summary: 'Cho Mg, Zn, Fe, Cu vào cùng một loại acid và so sánh tốc độ sủi bọt.',
    steps: [
      focus(TUBE1, TUBE2, TUBE3, TUBE4),
      add('hcl', 4, TUBE1),
      add('hcl', 4, TUBE2),
      add('hcl', 4, TUBE3),
      add('hcl', 4, TUBE4),
      add('mg_strip', 0.05, TUBE1),
      add('zn', 0.5, TUBE2),
      add('fe', 2, TUBE3),
      add('cu', 1, TUBE4),
      wait(15, { text: 'Mg sủi bọt mạnh nhất, rồi đến Zn, Fe sủi bọt chậm. Cu không có hiện tượng gì.' }),
      say('Thứ tự mức độ phản ứng: Mg > Zn > Fe > Cu. Copper đứng sau hydrogen trong dãy hoạt động nên không đẩy được H₂ ra khỏi acid.'),
    ],
    result: {
      phenomena: ['Mg: sủi bọt rất mạnh, ống nóng lên', 'Zn: sủi bọt khá mạnh', 'Fe: sủi bọt chậm', 'Cu: không có hiện tượng'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑', 'Zn + 2HCl → ZnCl₂ + H₂↑', 'Fe + 2HCl → FeCl₂ + H₂↑', 'Cu + HCl: không phản ứng'],
      explain: 'Dãy hoạt động hóa học: K, Na, Mg, Al, Zn, Fe, Pb, (H), Cu, Ag, Au. Kim loại đứng trước H tác dụng với acid (HCl, H₂SO₄ loãng) giải phóng H₂; kim loại càng đứng trước thì phản ứng càng mạnh.',
    },
  },
];
