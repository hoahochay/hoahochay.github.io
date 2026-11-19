/**
 * Thử màu ngọn lửa (SGK Hóa 12 Bài 24, 25): nhúng dây platinum vào dung dịch muối rồi hơ trên ngọn lửa.
 * Ion kim loại nhóm IA, IIA (và Cu²⁺) làm ngọn lửa có màu đặc trưng.
 * Ion Na⁺ cho màu vàng rất mạnh, chỉ một lượng nhỏ cũng lấn át màu của các ion khác.
 */
import { Mixture } from './mixture';

export interface FlameColor {
  ion: string;
  /** Tên màu, ví dụ 'đỏ tía' */
  name: string;
  /** Màu ánh lửa (hex) */
  color: number;
}

const COLORS: Record<string, FlameColor & { weight: number }> = {
  'Na+': { ion: 'Na⁺', name: 'vàng', color: 0xffc21a, weight: 20 },
  'Li+': { ion: 'Li⁺', name: 'đỏ tía', color: 0xe8183c, weight: 3 },
  'Sr^2+': { ion: 'Sr²⁺', name: 'đỏ son', color: 0xff2a1a, weight: 3 },
  'Ca^2+': { ion: 'Ca²⁺', name: 'đỏ cam', color: 0xff6a1a, weight: 2 },
  'Ba^2+': { ion: 'Ba²⁺', name: 'lục', color: 0x9adf3a, weight: 1.5 },
  'Cu^2+': { ion: 'Cu²⁺', name: 'xanh lục', color: 0x2fd9a0, weight: 1.5 },
  'K+': { ion: 'K⁺', name: 'tím (tím hồng nhạt)', color: 0xb98cff, weight: 1 },
};

/** Màu ngọn lửa do dung dịch trong hỗn hợp; null nếu không có ion cho màu */
export function flameTest(m: Mixture): FlameColor | null {
  let best: string | null = null, score = 0;
  for (const [id, c] of Object.entries(COLORS)) {
    const s = m.get(id) * c.weight;
    if (s > score && m.conc(id) > 1e-3) { score = s; best = id; }
  }
  if (!best) return null;
  const { ion, name, color } = COLORS[best];
  return { ion, name, color };
}
