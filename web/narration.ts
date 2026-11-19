/**
 * Lời thuyết minh hiển thị cho từng bước của thí nghiệm mẫu.
 * Là hàm thuần (không phụ thuộc cảnh 3D) để script tạo giọng đọc (scripts/tts-plan.ts) dùng chung.
 */
import { CHEMICALS } from './catalog';
import type { ToolKind } from './probes';
import { BEAKER, FLASK, Step, SYRINGE } from './recipes';

const PROBE_NAME: Record<ToolKind, string> = {
  glowing: 'que đóm còn tàn đỏ',
  burning: 'que đóm đang cháy',
  litmus: 'mẩu giấy quỳ tím ẩm',
  litmus_sol: 'mẩu giấy quỳ tím',
  ph_paper: 'mẩu giấy pH',
  ph_moist: 'mẩu giấy pH ẩm',
  ice_bath: 'cốc nước đá',
  warm_bath: 'cốc nước ấm',
  hot_bath: 'cốc nước nóng',
  no2_tube: 'khí NO₂',
  spoon_s: 'muôi sắt đựng lưu huỳnh',
  dish_burn: 'bát sứ',
  burette: 'burette chứa dung dịch NaOH',
  burette_kmno4: 'burette chứa dung dịch thuốc tím',
  magnet: 'nam châm',
  xcard: 'tờ giấy kẻ chữ X',
  dye_paper: 'mẩu giấy màu ẩm',
};

/** Tên dụng cụ theo số thứ tự dùng trong kịch bản (khớp với tên trong cảnh 3D) */
export function vesselName(i: number): string {
  if (i === SYRINGE) return 'Xi lanh đo khí';
  if (i === BEAKER) return 'Cốc 100 mL';
  if (i === FLASK) return 'Bình nón 100 mL';
  return `Ống nghiệm ${i + 1}`;
}

const fmt = (x: number) => String(+x.toFixed(2)).replace('.', ',');

/** "2 mL HCl 1M", "0,05 g Mg" */
export function chemLabel(key: string, amount: number): string {
  const c = CHEMICALS.find((x) => x.key === key);
  if (!c) throw new Error(`Không có hóa chất "${key}"`);
  return `${fmt(amount)} ${c.unit} ${c.formula}${c.kind === 'solution' && c.key !== 'water' && c.sub ? ' ' + c.sub : ''}`;
}

export function describeStep(s: Step): string {
  const vn = (i: number) => vesselName(i).toLowerCase();
  switch (s.kind) {
    case 'say': return s.text;
    case 'add': return s.text ?? `Cho ${chemLabel(s.chem, s.amount)} vào ${vn(s.vessel)}.`;
    case 'wait': return s.text ?? 'Quan sát…';
    case 'heat': return s.text ?? (s.on ? 'Đun nóng bằng đèn cồn.' : 'Tắt đèn cồn.');
    case 'stir': return s.text ?? 'Lắc nhẹ cho dung dịch trộn đều.';
    case 'burette': return s.text ?? (s.action === 'stream' ? 'Mở khóa burette cho dung dịch chảy xuống.'
      : s.action === 'drip' ? 'Vặn khóa burette cho dung dịch nhỏ từng giọt.'
      : s.action === 'drop' ? 'Nhỏ thêm một giọt từ burette.' : 'Đóng khóa burette.');
    case 'connect': return s.text ?? (s.dst === null
      ? 'Tháo ống dẫn khí.'
      : `Lắp ống dẫn khí từ ${vn(s.src)} sang ${vn(s.dst)}.`);
    case 'invert': return s.text ?? `Úp ngược ${vn(s.vessel)}.`;
    case 'probe': return s.text ?? (s.tool === 'ice_bath' || s.tool === 'warm_bath' || s.tool === 'hot_bath'
      ? `Ngâm ${vn(s.vessel)} vào ${PROBE_NAME[s.tool]}.`
      : s.tool === 'dish_burn'
      ? `Rót khoảng 1 mL chất lỏng từ ${vn(s.vessel)} vào bát sứ nhỏ, đưa que đóm đang cháy vào bề mặt chất lỏng.`
      : s.tool === 'spoon_s'
      ? `Đốt lưu huỳnh trên muôi sắt rồi đưa vào ${vn(s.vessel)}.`
      : s.tool === 'no2_tube'
      ? `Nạp khí NO₂ vào ${vn(s.vessel)} rồi đậy nút kín.`
      : s.tool === 'xcard'
      ? `Đặt tờ giấy kẻ chữ X phía sau ${vn(s.vessel)}.`
      : s.tool === 'magnet'
      ? `Đưa nam châm lại gần đáy ${vn(s.vessel)}.`
      : s.tool === 'litmus_sol' || s.tool === 'ph_paper' ? `Nhúng đầu ${PROBE_NAME[s.tool]} vào dung dịch trong ${vn(s.vessel)}.`
      : `Đưa ${PROBE_NAME[s.tool]} vào miệng ${vn(s.vessel)}.`);
    case 'burn': {
      const c = CHEMICALS.find((x) => x.key === s.chem);
      return s.text ?? `Dùng kẹp sắt giữ ${c?.formula ?? s.chem} đốt trên ngọn lửa đèn cồn.`;
    }
    case 'weigh': return s.text ?? (s.vessel === null ? 'Lấy dụng cụ khỏi cân.'
      : s.off ? `Lấy ${vn(s.vessel)} khỏi cân.` : `Đặt ${vn(s.vessel)} lên cân điện tử.`);
    case 'empty': return s.text ?? `Đổ bỏ chất trong ${vn(s.vessel)}, tráng sạch.`;
    case 'predict': return s.text ?? 'Em đoán xem bước tiếp theo sẽ có hiện tượng gì?';
    case 'pour': return s.text ?? (s.mL ? `Rót khoảng ${fmt(s.mL)} mL từ ${vn(s.src)} sang ${vn(s.dst)}.` : `Đổ ${vn(s.src)} vào ${vn(s.dst)}.`);
    case 'focus': return '';
  }
}
