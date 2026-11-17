/**
 * Thí nghiệm mẫu: chuỗi thao tác + lời thuyết minh, phát lại tự động cho học sinh xem.
 * Ống nghiệm đánh số 0–3, cốc là 4.
 */
import { Mixture } from '../src';

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
  | { kind: 'focus'; vessels: number[] | null };

export interface Recipe {
  id: string;
  title: string;
  level: string;
  topic: string;
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
const focus = (...vessels: number[]): Step => ({ kind: 'focus', vessels: vessels.length ? vessels : null });

export const RECIPES: Recipe[] = [
  {
    id: 'mg-hcl',
    title: 'Kim loại tác dụng với axit',
    level: 'Lớp 8–9', topic: 'Tính chất của axit',
    summary: 'Thả dải magie vào dung dịch HCl, quan sát khí thoát ra và sự tỏa nhiệt.',
    steps: [
      focus(TUBE1),
      say('Axit tác dụng với kim loại đứng trước H trong dãy hoạt động hóa học, giải phóng khí hiđro.'),
      add('hcl', 5, TUBE1),
      add('mg_strip', 0.05, TUBE1, 'Thả một dải magie (0,05 g) vào ống nghiệm.'),
      wait(12, { text: 'Quan sát: bọt khí thoát ra rất mạnh trên bề mặt dải Mg.' }),
      wait(120, { speed: 5, text: 'Tua nhanh: dải Mg tan dần, ống nghiệm nóng lên. Để ý nhiệt độ trên bảng bên phải.', until: (l) => l.mix(TUBE1).get('Mg') < 1e-5 }),
      say('Dải magie đã tan hết. Dung dịch thu được là MgCl₂, khí thoát ra là H₂.'),
    ],
    result: {
      phenomena: ['Sủi bọt khí không màu', 'Dải Mg tan dần rồi hết', 'Ống nghiệm nóng lên khoảng 15 °C'],
      equations: ['Mg + 2HCl → MgCl₂ + H₂↑'],
      explain: 'Mg đứng trước H trong dãy hoạt động hóa học nên đẩy được H ra khỏi axit. Phản ứng tỏa nhiệt mạnh. Tốc độ giảm dần vì dải Mg nhỏ lại và nồng độ axit giảm.',
    },
  },
  {
    id: 'surface-area',
    title: 'Diện tích bề mặt và tốc độ phản ứng',
    level: 'Lớp 10', topic: 'Tốc độ phản ứng',
    summary: 'So sánh magie dạng dải và dạng bột trong cùng một dung dịch axit.',
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
    level: 'Lớp 9, 11', topic: 'Axit – bazơ – pH',
    summary: 'Nhỏ từ từ HCl vào NaOH có phenolphtalein cho tới khi mất màu hồng.',
    steps: [
      focus(BEAKER),
      add('naoh', 5, BEAKER),
      add('water', 20, BEAKER, 'Pha loãng bằng 20 mL nước cất.'),
      add('phenol', 2, BEAKER, 'Nhỏ 2 giọt phenolphtalein: dung dịch bazơ chuyển màu hồng.'),
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
      wait(2, { text: 'Dung dịch mất màu: lượng axit vừa đủ trung hòa lượng bazơ, pH ≈ 7.' }),
    ],
    result: {
      phenomena: ['Dung dịch NaOH + phenolphtalein có màu hồng', 'Khi thêm đủ 5 mL HCl 1M, dung dịch mất màu', 'Dung dịch hơi ấm lên'],
      equations: ['NaOH + HCl → NaCl + H₂O', 'H⁺ + OH⁻ → H₂O'],
      explain: 'Phenolphtalein có màu hồng khi pH > 8,2 và không màu trong môi trường trung tính hoặc axit. 5 mmol HCl trung hòa vừa đủ 5 mmol NaOH. Gần điểm tương đương, chỉ một giọt axit cũng làm pH giảm rất mạnh (bước nhảy pH).',
    },
  },
  {
    id: 'cuoh2',
    title: 'Điều chế và hòa tan Cu(OH)₂',
    level: 'Lớp 9', topic: 'Bazơ không tan',
    summary: 'Cho NaOH vào CuSO₄ tạo kết tủa xanh lơ, sau đó hòa tan kết tủa bằng axit.',
    steps: [
      focus(TUBE2),
      add('cuso4', 2, TUBE2, 'Lấy 2 mL dung dịch CuSO₄ màu xanh lam.'),
      add('naoh', 2, TUBE2, 'Nhỏ thêm 2 mL NaOH.'),
      wait(4, { text: 'Xuất hiện kết tủa xanh lơ Cu(OH)₂, dung dịch mất màu xanh lam.' }),
      wait(150, { speed: 20, text: 'Để yên: kết tủa lắng dần xuống đáy ống.' }),
      say('Cu(OH)₂ là bazơ không tan, nhưng vẫn tác dụng được với axit. Thử thêm HCl.'),
      add('hcl', 3, TUBE2),
      stir(TUBE2),
      wait(5, { text: 'Kết tủa tan hết, dung dịch trở lại màu xanh lam của ion Cu²⁺.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa xanh lơ', 'Kết tủa lắng dần khi để yên', 'Thêm HCl: kết tủa tan, dung dịch xanh lam'],
      equations: ['CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄', 'Cu(OH)₂ + 2HCl → CuCl₂ + 2H₂O'],
      explain: 'Ion Cu²⁺ kết hợp với OH⁻ tạo Cu(OH)₂ rất ít tan (Ksp ≈ 2·10⁻²⁰). Trong axit, H⁺ lấy đi OH⁻ nên kết tủa tan trở lại.',
    },
  },
  {
    id: 'fe-cu',
    title: 'Sắt đẩy đồng ra khỏi dung dịch muối',
    level: 'Lớp 9', topic: 'Dãy hoạt động hóa học',
    summary: 'Ngâm đinh sắt trong CuSO₄, quan sát đồng đỏ bám lên đinh.',
    steps: [
      focus(TUBE3),
      add('cuso4', 5, TUBE3),
      add('fe', 2, TUBE3, 'Thả một chiếc đinh sắt sạch vào dung dịch CuSO₄.'),
      wait(5, { text: 'Phản ứng xảy ra chậm, cần thời gian để thấy rõ.' }),
      wait(1800, { speed: 60, text: 'Tua nhanh 30 phút: đinh sắt phủ dần một lớp đồng màu đỏ, màu xanh của dung dịch nhạt đi.' }),
      say('Đồng bám trên đinh, dung dịch chuyển từ xanh lam sang xanh lục nhạt do có ion Fe²⁺.'),
    ],
    result: {
      phenomena: ['Có lớp kim loại màu đỏ bám trên đinh sắt', 'Màu xanh lam của dung dịch nhạt dần'],
      equations: ['Fe + CuSO₄ → FeSO₄ + Cu↓'],
      explain: 'Fe hoạt động hóa học mạnh hơn Cu nên đẩy được Cu ra khỏi dung dịch muối. Ion Cu²⁺ (xanh lam) bị thay bằng Fe²⁺ (xanh lục rất nhạt).',
    },
  },
  {
    id: 'na-water',
    title: 'Natri tác dụng với nước',
    level: 'Lớp 9, 12', topic: 'Kim loại kiềm',
    summary: 'Thả mẩu natri vào nước có phenolphtalein.',
    steps: [
      focus(BEAKER),
      add('water', 40, BEAKER),
      add('phenol', 2, BEAKER, 'Nhỏ 2 giọt phenolphtalein: nước trung tính nên không màu.'),
      say('Natri được bảo quản trong dầu hỏa vì phản ứng mạnh với nước và không khí. Chỉ dùng mẩu nhỏ bằng hạt đỗ.'),
      add('na', 0.1, BEAKER),
      wait(30, { text: 'Mẩu Na nổi, chạy trên mặt nước, có khí thoát ra. Dung dịch chuyển hồng vì tạo NaOH.', until: (l) => l.mix(BEAKER).get('Na') < 1e-5 }),
      say('Natri đã phản ứng hết. Dung dịch có màu hồng: đây là dung dịch bazơ NaOH.'),
    ],
    result: {
      phenomena: ['Mẩu Na nổi và chạy trên mặt nước', 'Có khí không màu thoát ra', 'Dung dịch chuyển màu hồng'],
      equations: ['2Na + 2H₂O → 2NaOH + H₂↑'],
      explain: 'Na là kim loại rất mạnh, khử nước ở nhiệt độ thường. Na nhẹ hơn nước nên nổi; khí H₂ sinh ra đẩy mẩu Na chạy trên mặt nước. NaOH tạo thành làm phenolphtalein chuyển hồng.',
    },
  },
  {
    id: 'h2o2',
    title: 'Chất xúc tác: phân hủy H₂O₂',
    level: 'Lớp 8, 10', topic: 'Chất xúc tác',
    summary: 'So sánh H₂O₂ có và không có xúc tác MnO₂.',
    steps: [
      focus(TUBE1, TUBE2),
      add('h2o2', 5, TUBE1),
      add('h2o2', 5, TUBE2),
      wait(4, { text: 'Hai ống chứa nước oxi già 3%. Không có hiện tượng gì: H₂O₂ phân hủy rất chậm.' }),
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
    level: 'Lớp 11–12', topic: 'Độ tan và nhiệt độ',
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
    title: 'Nhận biết ion clorua',
    level: 'Lớp 9, 11', topic: 'Nhận biết ion',
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
      explain: 'AgCl rất ít tan (Ksp ≈ 1,8·10⁻¹⁰) nên dung dịch AgNO₃ là thuốc thử nhận biết ion Cl⁻. Kết tủa không tan trong axit HNO₃.',
    },
  },
  {
    id: 'sulfate-test',
    title: 'Nhận biết ion sunfat',
    level: 'Lớp 9, 10', topic: 'Nhận biết ion',
    summary: 'Dùng BaCl₂ nhận biết axit sunfuric và muối sunfat.',
    steps: [
      focus(TUBE2),
      add('h2so4', 2, TUBE2),
      add('bacl2', 2, TUBE2),
      wait(4, { text: 'Xuất hiện kết tủa trắng BaSO₄.' }),
      wait(120, { speed: 20, text: 'Để yên: kết tủa lắng xuống.' }),
    ],
    result: {
      phenomena: ['Xuất hiện kết tủa trắng, không tan trong axit'],
      equations: ['H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl', 'Ba²⁺ + SO₄²⁻ → BaSO₄↓'],
      explain: 'BaSO₄ gần như không tan, kể cả trong axit mạnh, nên ion Ba²⁺ dùng để nhận biết gốc sunfat.',
    },
  },
  {
    id: 'caco3-hcl',
    title: 'Đá vôi tác dụng với axit',
    level: 'Lớp 9', topic: 'Muối cacbonat',
    summary: 'Cho đá vôi vào axit clohiđric, quan sát khí CO₂.',
    steps: [
      focus(TUBE1),
      add('hcl', 5, TUBE1),
      add('caco3', 0.5, TUBE1, 'Cho một viên đá vôi nhỏ vào.'),
      wait(10, { text: 'Viên đá vôi sủi bọt khí CO₂.' }),
      wait(240, { speed: 10, text: 'Tua nhanh: viên đá vôi nhỏ dần, bọt khí thưa dần khi axit cạn.' }),
    ],
    result: {
      phenomena: ['Sủi bọt khí không màu trên bề mặt đá vôi', 'Viên đá vôi tan dần'],
      equations: ['CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑'],
      explain: 'Axit mạnh đẩy axit cacbonic yếu ra khỏi muối; H₂CO₃ không bền, phân hủy thành CO₂ và H₂O. Khí CO₂ làm vẩn đục nước vôi trong.',
    },
  },
  {
    id: 'feoh3',
    title: 'Sắt(III) hiđroxit nâu đỏ',
    level: 'Lớp 9, 12', topic: 'Hợp chất của sắt',
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
];
