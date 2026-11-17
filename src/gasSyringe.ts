/**
 * Xi lanh đo khí: nhận khí qua ống dẫn, pít-tông bị đẩy ra theo thể tích khí (ở nhiệt độ phòng, 1 atm).
 * Khí đi vào gồm cả không khí bị đẩy ra khỏi dụng cụ phát khí, nên số đọc chính là thể tích khí sinh ra.
 */
import { T25 } from './constants';
import type { GasReceiver } from './vessel';

const R_LATM = 0.082057;
/** Khóa dùng cho không khí trong `gas` */
export const SYRINGE_AIR = 'air';

export class GasSyringe implements GasReceiver {
  /** Lượng từng khí trong xi lanh, mol (không khí dưới khóa `SYRINGE_AIR`) */
  readonly gas = new Map<string, number>();
  /** Khí đã rò ra ngoài khi pít-tông chạm vạch cuối, mol */
  leakedMol = 0;
  tempK = T25;

  constructor(readonly capacityML = 100) {}

  get totalMol(): number {
    let n = 0;
    for (const v of this.gas.values()) n += v;
    return n;
  }

  /** Số đọc trên thân xi lanh, mL */
  get volumeML(): number {
    return this.totalMol * R_LATM * this.tempK * 1000;
  }

  get full(): boolean {
    return this.volumeML >= this.capacityML - 1e-9;
  }

  receiveGas(gases: Map<string, number>, total: number): void {
    if (total <= 0) return;
    let named = 0;
    for (const [id, n] of gases) {
      this.gas.set(id, (this.gas.get(id) ?? 0) + n);
      named += n;
    }
    if (total > named) this.gas.set(SYRINGE_AIR, (this.gas.get(SYRINGE_AIR) ?? 0) + total - named);
    // Pít-tông chạm vạch cuối: khí thừa rò ra qua khe pít-tông, thành phần không đổi
    const cap = this.capacityML / (R_LATM * this.tempK * 1000);
    const n = this.totalMol;
    if (n > cap) {
      const k = cap / n;
      for (const [id, v] of this.gas) this.gas.set(id, v * k);
      this.leakedMol += n - cap;
    }
  }

  /** Phần mol từng khí (kể cả không khí) */
  fractions(): Record<string, number> {
    const n = this.totalMol;
    const out: Record<string, number> = {};
    if (n <= 0) return out;
    for (const [id, v] of this.gas) out[id] = v / n;
    return out;
  }

  /** Đẩy pít-tông về vạch 0 */
  reset(): void {
    this.gas.clear();
    this.leakedMol = 0;
  }
}
