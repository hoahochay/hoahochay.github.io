/**
 * Burette 25 mL kẹp trên giá, đầu vòi đặt trên miệng bình tam giác (SGK Hóa 11 Bài 2: chuẩn độ acid – base).
 * Khóa burette có ba vị trí: đóng, mở cho chảy thành dòng, vặn nhẹ cho nhỏ từng giọt.
 */
import { makeSolution } from './reagents';
import type { Vessel } from './vessel';

export type BuretteMode = 'closed' | 'stream' | 'drip';

/** Thể tích một giọt, mL */
export const DROP_ML = 0.05;
/** Tốc độ chảy, mL/s */
export const BURETTE_RATE: Record<BuretteMode, number> = { closed: 0, stream: 0.5, drip: DROP_ML };

export class Burette {
  readonly capacityML = 25;
  /** Thể tích đã chảy ra (số đọc trên burette khi bắt đầu ở vạch 0), mL */
  usedML = 0;
  mode: BuretteMode = 'closed';
  /** Phần lẻ chưa đủ một giọt khi nhỏ giọt */
  private acc = 0;

  constructor(readonly target: Vessel, readonly solutes: Record<string, number>) {}

  get leftML(): number {
    return this.capacityML - this.usedML;
  }

  /** Cho chảy dt giây theo vị trí khóa; trả về thể tích vừa chảy ra, mL */
  step(dt: number): number {
    if (this.mode === 'closed') return 0;
    let mL = BURETTE_RATE[this.mode] * dt;
    if (this.mode === 'drip') {
      // Nhỏ từng giọt rời rạc
      this.acc += mL;
      const drops = Math.floor(this.acc / DROP_ML + 1e-9);
      this.acc -= drops * DROP_ML;
      mL = drops * DROP_ML;
    }
    return this.dispense(mL);
  }

  /** Nhỏ đúng một giọt */
  drop(): number {
    return this.dispense(DROP_ML);
  }

  private dispense(mL: number): number {
    mL = Math.min(mL, this.leftML);
    if (mL <= 0) {
      if (this.leftML <= 0) this.mode = 'closed';
      return 0;
    }
    this.usedML += mL;
    this.target.add(makeSolution(this.solutes, mL / 1000, this.target.roomK));
    return mL;
  }
}
