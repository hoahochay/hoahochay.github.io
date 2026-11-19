/**
 * Đốt một ít chất lỏng trong bát sứ bằng que đóm đang cháy (SGK Hóa 11 Bài 15: đốt cháy hexane).
 * Ngọn lửa tùy nhiên liệu: alkane cháy lửa vàng, arene nhiều carbon cháy có muội than,
 * cồn cháy lửa xanh nhạt; dung dịch nước không cháy.
 */
import { Mixture } from './mixture';
import { species } from './species';

export type LiquidFlame = 'luminous' | 'sooty' | 'blue' | 'none';

export interface LiquidBurn {
  flame: LiquidFlame;
  /** Chất cháy chính (id), nếu có */
  fuel?: string;
  equation?: string;
}

const FUELS: Record<string, { flame: LiquidFlame; equation: string }> = {
  C6H14: { flame: 'luminous', equation: '2C₆H₁₄ + 19O₂ →(t°) 12CO₂ + 14H₂O' },
  C6H6: { flame: 'sooty', equation: '2C₆H₆ + 15O₂ →(t°) 12CO₂ + 6H₂O' },
  C6H5CH3: { flame: 'sooty', equation: 'C₆H₅CH₃ + 9O₂ →(t°) 7CO₂ + 4H₂O' },
  C2H5OH: { flame: 'blue', equation: 'C₂H₅OH + 3O₂ →(t°) 2CO₂ + 3H₂O' },
};

/** Cồn có nồng độ từ khoảng 45° trở lên mới bắt lửa ở nhiệt độ phòng */
const ETHANOL_MIN_M = 7.5;

export function liquidBurn(m: Mixture): LiquidBurn {
  const total = m.liquidL();
  if (total <= 1e-7) return { flame: 'none' };
  // Lớp hữu cơ chiếm phần lớn: dung môi nhiều nhất quyết định ngọn lửa
  if (m.orgL() > 0.5 * total) {
    let best = '', v = 0;
    for (const [id, n] of m.moles) {
      const s = species(id);
      if (s.density && n * s.molarMass / s.density > v) { v = n * s.molarMass / s.density; best = id; }
    }
    const f = FUELS[best];
    return f ? { fuel: best, ...f } : { flame: 'none' };
  }
  if (m.conc('C2H5OH') >= ETHANOL_MIN_M) return { fuel: 'C2H5OH', ...FUELS.C2H5OH };
  return { flame: 'none' };
}
