import { T25 } from './constants';
import { species } from './species';

/** Hình dạng chất rắn quyết định diện tích bề mặt → tốc độ phản ứng */
export type SolidForm = 'strip' | 'granule' | 'powder' | 'precipitate';

/** Diện tích bề mặt S (cm²) = hệ số × n^(2/3), n tính bằng mol */
export const FORM_FACTOR: Record<SolidForm, number> = {
  granule: 30, // viên, cục (đá vôi, mẩu sodium)
  strip: 110, // dải, lá, đinh
  powder: 5000, // bột
  precipitate: 20000, // kết tủa mịn
};

/** Thời gian đặc trưng để kết tủa lắng xuống đáy, s */
export const SETTLE_TIME = 60;

/**
 * Trạng thái hóa học của một dụng cụ chứa: số mol từng chất, thể tích, nhiệt độ.
 * Chất tan được lưu dưới dạng ion; các cân bằng do equilibrium.ts xử lý.
 */
export class Mixture {
  readonly moles = new Map<string, number>();
  volumeL = 0;
  tempK = T25;
  /** Hệ số hình dạng của từng chất rắn */
  readonly formFactor = new Map<string, number>();
  /** Phần kết tủa còn lơ lửng (0..1), phần còn lại đã lắng */
  readonly suspended = new Map<string, number>();
  /** Q/Ksp của mỗi chất ít tan, sau lần cân bằng gần nhất */
  readonly saturation = new Map<string, number>();
  /** [H+] sau lần cân bằng gần nhất */
  h = 1e-7;
  /** Khí trong khoảng trống phía trên chất lỏng, mol (không tính không khí) */
  readonly headspace = new Map<string, number>();

  get(id: string): number {
    return this.moles.get(id) ?? 0;
  }

  set(id: string, n: number): void {
    species(id); // kiểm tra id hợp lệ
    if (n > 0) this.moles.set(id, n);
    else this.moles.delete(id);
  }

  add(id: string, n: number): void {
    this.set(id, this.get(id) + n);
  }

  /** Nồng độ mol (M) của chất tan */
  conc(id: string): number {
    return this.volumeL > 0 ? this.get(id) / this.volumeL : 0;
  }

  /** Diện tích bề mặt của chất rắn, cm² */
  surface(id: string): number {
    const n = this.get(id);
    if (n <= 0) return 0;
    return (this.formFactor.get(id) ?? FORM_FACTOR.granule) * Math.cbrt(n * n);
  }

  setForm(id: string, form: SolidForm): void {
    this.formFactor.set(id, Math.max(this.formFactor.get(id) ?? 0, FORM_FACTOR[form]));
  }

  /** Thêm kết tủa mới tạo thành: mịn và lơ lửng */
  addPrecipitate(id: string, n: number): void {
    const old = this.get(id);
    const s = this.suspended.get(id) ?? 1;
    this.add(id, n);
    if (!this.formFactor.has(id)) this.setForm(id, 'precipitate');
    this.suspended.set(id, (s * old + n) / (old + n));
  }

  merge(other: Mixture): void {
    for (const [id, n] of other.moles) {
      const old = this.get(id);
      const sOld = this.suspended.get(id) ?? 1;
      const sNew = other.suspended.get(id) ?? 1;
      this.add(id, n);
      if (species(id).phase === 's') {
        this.suspended.set(id, (sOld * old + sNew * n) / (old + n));
      }
    }
    for (const [id, f] of other.formFactor) {
      this.formFactor.set(id, Math.max(this.formFactor.get(id) ?? 0, f));
    }
    this.volumeL += other.volumeL;
  }

  clone(): Mixture {
    const m = new Mixture();
    for (const [id, n] of this.moles) m.moles.set(id, n);
    for (const [id, f] of this.formFactor) m.formFactor.set(id, f);
    for (const [id, s] of this.suspended) m.suspended.set(id, s);
    for (const [id, s] of this.saturation) m.saturation.set(id, s);
    for (const [id, n] of this.headspace) m.headspace.set(id, n);
    m.volumeL = this.volumeL;
    m.tempK = this.tempK;
    m.h = this.h;
    return m;
  }
}

/** Khối lượng mol trung bình của không khí, g/mol */
const M_AIR = 28.96;

/**
 * Khối lượng các chất trong dụng cụ, g, như cân đọc được.
 * Khí trong khoảng trống phía trên chỉ tính phần nặng (nhẹ) hơn lượng không khí nó chiếm chỗ,
 * vì cân đặt trong không khí: CO₂ đọng lại làm số đọc tăng nhẹ, H₂ làm giảm nhẹ.
 */
export function contentsMassG(mix: Mixture): number {
  let g = 0;
  for (const [id, n] of mix.moles) g += n * species(id).molarMass;
  for (const [id, n] of mix.headspace) g += n * (species(id).molarMass - M_AIR);
  return g;
}
