import { H_VAP_WATER, M_WATER, R, T25, T_BOIL } from './constants';
import { equilibrate } from './equilibrium';
import { bubbleAbsorption, exchangeGases, GAS_INDEX, headspaceFractions, ventHeadspace } from './gas';
import { KineticReaction, runDissolution, runKinetics } from './kinetics';
import { Mixture, SETTLE_TIME, SolidForm } from './mixture';
import { solutionColor, turbidity } from './optics';
import { REACTIONS } from './reactions';
import { makeSolution } from './reagents';
import { GAS_IDS, pretty, RGB, species } from './species';
import { enthalpy, hydrogenAtoms, liquidHeatCapacity } from './thermo';

export interface VesselSpec {
  name: string;
  /** Nhiệt dung của thủy tinh, J/K */
  glassHeatCapacity: number;
  /** Đường kính trong ≈ độ dày lớp chất lỏng ánh sáng đi qua, cm */
  pathLengthCm: number;
  capacityL: number;
  /** Thể tích trong toàn bộ (cả khoảng khí), L */
  volumeL: number;
  /** Diện tích miệng, cm² */
  mouthAreaCm2: number;
}

export const VESSELS = {
  testTube: { name: 'Ống nghiệm', glassHeatCapacity: 12, pathLengthCm: 1.5, capacityL: 0.025, volumeL: 0.026, mouthAreaCm2: 1.77 },
  beaker100: { name: 'Cốc 100 mL', glassHeatCapacity: 45, pathLengthCm: 5, capacityL: 0.1, volumeL: 0.15, mouthAreaCm2: 21.2 },
  beaker250: { name: 'Cốc 250 mL', glassHeatCapacity: 90, pathLengthCm: 7, capacityL: 0.25, volumeL: 0.35, mouthAreaCm2: 38.5 },
  /** Cốc xốp cách nhiệt, dùng cho thí nghiệm đo nhiệt */
  foamCup: { name: 'Cốc xốp', glassHeatCapacity: 0, pathLengthCm: 7, capacityL: 0.25, volumeL: 0.3, mouthAreaCm2: 38.5 },
} satisfies Record<string, VesselSpec>;

export interface SolidObservation {
  id: string;
  formula: string;
  name: string;
  mol: number;
  grams: number;
  color: RGB;
  /** Phần đang lơ lửng (0..1); còn lại nằm dưới đáy */
  suspended: number;
}

export interface Observation {
  timeS: number;
  tempC: number;
  pH: number;
  volumeML: number;
  /** Màu dung dịch (không kể kết tủa) */
  solutionColor: RGB;
  /** Màu nhìn thấy, đã trộn với kết tủa lơ lửng */
  appearance: RGB;
  turbidity: number;
  solids: SolidObservation[];
  /** Tốc độ thoát khí, mL/s (ở nhiệt độ hiện tại, 1 atm) */
  gasRateML: Record<string, number>;
  /** Tổng lượng khí đã thoát ra khỏi dung dịch, mol */
  gasTotalMol: Record<string, number>;
  /** Phần mol các khí trong khoảng khí phía trên chất lỏng (phần còn lại là không khí) */
  headspace: Record<string, number>;
  /** Khí đi vào qua ống dẫn, mL/s (kể cả không khí bị đẩy sang) */
  inletRateML: number;
  /** Nồng độ các chất tan (M), bỏ qua lượng vết */
  dissolved: Record<string, number>;
  boiling: boolean;
}

/** Hệ số truyền nhiệt ra môi trường, W/K, theo thể tích (mL) */
function lossCoefficient(volumeML: number): number {
  return 0.03 * volumeML ** (2 / 3);
}

/**
 * Một dụng cụ chứa hóa chất: nơi mọi thứ xảy ra.
 * Mỗi bước thời gian: phản ứng chậm → hòa tan → cân bằng nhanh → bảo toàn H (nước)
 * → nhiệt phản ứng → khí thoát ra → đun nóng / tỏa nhiệt ra môi trường.
 */
export class Vessel {
  readonly mix = new Mixture();
  time = 0;
  /** Công suất đun (W) truyền vào dung dịch; đèn cồn ≈ 30–60 W */
  heaterW = 0;
  roomK = T25;
  boiling = false;
  readonly gasRate = new Map<string, number>();
  /** Tổng khí đã thoát khỏi dung dịch (bọt khí), mol */
  readonly gasTotal = new Map<string, number>();
  /** Tổng khí đã bay ra khỏi miệng dụng cụ, mol */
  readonly gasEscaped = new Map<string, number>();
  /** Ống dẫn khí: nút kín miệng dụng cụ này, dẫn khí sang dụng cụ khác */
  outlet: Vessel | null = null;
  /** Úp ngược miệng xuống (để thu khí nhẹ) */
  inverted = false;
  /** Tốc độ khí đi vào từ ống dẫn, mol/s (làm mượt, để vẽ bọt khí ở đầu ống) */
  inletRate = 0;
  /** Khí nhận từ ống dẫn, chờ đưa vào ở bước kế tiếp */
  private inGas = new Map<string, number>();
  private inTotal = 0;
  private inAbsorb = new Map<string, number>();
  private inletAcc = 0;

  constructor(
    readonly spec: VesselSpec = VESSELS.testTube,
    readonly reactions: KineticReaction[] = REACTIONS,
  ) {
    this.mix.tempK = this.roomK;
  }

  heatCapacity(): number {
    return liquidHeatCapacity(this.mix) + this.spec.glassHeatCapacity;
  }

  /** Đổ một dung dịch (hoặc hỗn hợp lấy từ dụng cụ khác) vào */
  add(m: Mixture): this {
    const cSelf = this.heatCapacity();
    const cIn = liquidHeatCapacity(m);
    const T = cSelf + cIn > 0 ? (cSelf * this.mix.tempK + cIn * m.tempK) / (cSelf + cIn) : m.tempK;
    this.mix.merge(m);
    this.mix.tempK = T;
    this.process(0);
    return this;
  }

  addSolution(solutes: Record<string, number>, volumeL: number): this {
    return this.add(makeSolution(solutes, volumeL, this.roomK));
  }

  addSolid(id: string, mol: number, form: SolidForm = 'granule'): this {
    if (species(id).phase !== 's') throw new Error(`${id} không phải chất rắn`);
    this.mix.add(id, mol);
    this.mix.setForm(id, form);
    this.mix.suspended.set(id, 0); // chất rắn bỏ vào thì nằm dưới đáy
    this.process(0);
    return this;
  }

  /** Lấy ra một thể tích: dung dịch + phần kết tủa đang lơ lửng (chất rắn lớn ở lại) */
  take(volumeL: number): Mixture {
    const out = new Mixture();
    const m = this.mix;
    const f = m.volumeL > 0 ? Math.min(1, volumeL / m.volumeL) : 0;
    out.tempK = m.tempK;
    out.h = m.h;
    out.volumeL = m.volumeL * f;
    for (const [id, n] of [...m.moles]) {
      const s = species(id);
      let frac = f;
      if (s.phase === 's') {
        const isFine = (m.formFactor.get(id) ?? 0) >= 20000;
        frac = isFine ? f * (m.suspended.get(id) ?? 0) : 0;
        if (frac > 0) {
          out.formFactor.set(id, m.formFactor.get(id)!);
          out.suspended.set(id, 1);
          // phần lơ lửng còn lại trong cốc
          const left = n * (1 - frac);
          const suspLeft = n * (m.suspended.get(id) ?? 0) - n * frac;
          m.suspended.set(id, left > 0 ? Math.max(0, suspLeft / left) : 0);
        }
      }
      if (frac <= 0) continue;
      out.set(id, n * frac);
      m.set(id, n * (1 - frac));
    }
    m.volumeL -= out.volumeL;
    for (const [id, s] of m.saturation) out.saturation.set(id, s);
    return out;
  }

  pourInto(other: Vessel, volumeL: number): void {
    other.add(this.take(volumeL));
  }

  /** Khuấy: kết tủa lơ lửng trở lại */
  stir(): this {
    for (const id of this.mix.suspended.keys()) this.mix.suspended.set(id, 1);
    return this;
  }

  /** Một bước mô phỏng hóa học. dt = 0: chỉ cân bằng tức thời (vd. ngay sau khi trộn). */
  private process(dt: number): void {
    const m = this.mix;
    if (m.volumeL <= 1e-7) {
      for (const [id, n] of this.inAbsorb) this.inGas.set(id, (this.inGas.get(id) ?? 0) + n);
      this.inAbsorb.clear();
      if (dt > 0 && (m.headspace.size || this.inTotal > 0 || this.inletRate > 1e-12)) this.vent(dt, new Map());
      return;
    }
    let H0 = enthalpy(m);
    let A0 = hydrogenAtoms(m);
    // Khí sục qua dung dịch từ ống dẫn: phần bị hấp thụ tan vào (tính cả nhiệt hòa tan)
    for (const [id, n] of this.inAbsorb) {
      const g = GAS_INDEX.get(id)!;
      H0 += n * species(id).dHf * 1000;
      A0 += n * species(id).hCount;
      m.add(g.dissolved!.species, n);
    }
    this.inAbsorb.clear();
    if (dt > 0) {
      runKinetics(m, dt, this.reactions);
      runDissolution(m, dt);
      exchangeGases(m, this.spec, dt);
    }
    equilibrate(m);
    // Bảo toàn nguyên tố H: phần chênh lệch là nước sinh ra hoặc bị tiêu thụ
    m.add('H2O', (A0 - hydrogenAtoms(m)) / 2);
    // Định luật Hess: nhiệt tỏa ra = H_trước − H_sau
    m.tempK += (H0 - enthalpy(m)) / this.heatCapacity();

    // Bọt khí: khí sinh ra trong dung dịch đi vào khoảng khí phía trên
    const tau = 0.5; // làm mượt tốc độ thoát khí để hiển thị
    const dtEff = dt > 0 ? dt : 0.05;
    const inflow = new Map<string, number>();
    for (const id of GAS_IDS) {
      const n = m.get(id);
      if (n > 0) {
        m.set(id, 0);
        inflow.set(id, n);
        this.gasTotal.set(id, (this.gasTotal.get(id) ?? 0) + n);
      }
      const prev = this.gasRate.get(id) ?? 0;
      const next = prev + (n / dtEff - prev) * Math.min(1, dtEff / tau);
      if (next > 1e-12) this.gasRate.set(id, next);
      else this.gasRate.delete(id);
    }
    if (dt > 0 || inflow.size) this.vent(dt, inflow);
  }

  private vent(dt: number, inflow: Map<string, number>): void {
    let total = 0;
    for (const n of inflow.values()) total += n;
    for (const [id, n] of this.inGas) inflow.set(id, (inflow.get(id) ?? 0) + n);
    total += this.inTotal;
    this.inGas.clear();
    this.inTotal = 0;
    const sealed = this.outlet !== null;
    const out = ventHeadspace(this.mix, this.spec, dt, inflow, { inflowTotal: total, sealed, inverted: this.inverted });
    if (this.outlet) {
      // Dụng cụ nút kín: mọi khí bị đẩy ra (lúc đầu chủ yếu là không khí) đi qua ống dẫn
      this.outlet.receiveGas(out, Math.max(total, [...out.values()].reduce((a, b) => a + b, 0)));
    } else {
      for (const [id, n] of out) this.gasEscaped.set(id, (this.gasEscaped.get(id) ?? 0) + n);
    }
    const dtEff = dt > 0 ? dt : 0.05;
    this.inletRate += (this.inletAcc / dtEff - this.inletRate) * Math.min(1, dtEff / 0.5);
    this.inletAcc = 0;
  }

  /**
   * Nhận khí từ ống dẫn của dụng cụ khác. `total` gồm cả không khí đi kèm.
   * Đầu ống ngập trong chất lỏng: khí sục qua, khí tan được (CO2, NH3) bị hấp thụ một phần.
   */
  receiveGas(gases: Map<string, number>, total: number): void {
    if (total <= 0) return;
    this.inletAcc += total;
    let left = total;
    for (const [id, n] of gases) {
      const absorbed = this.inverted ? 0 : n * bubbleAbsorption(this.mix, id, n / total);
      if (absorbed > 0) this.inAbsorb.set(id, (this.inAbsorb.get(id) ?? 0) + absorbed);
      if (n - absorbed > 0) this.inGas.set(id, (this.inGas.get(id) ?? 0) + n - absorbed);
      left -= absorbed;
    }
    this.inTotal += left;
  }

  step(dt: number): this {
    this.process(dt);
    const m = this.mix;
    const C = this.heatCapacity();
    if (C > 0) {
      const loss = lossCoefficient(m.volumeL * 1000) * (m.tempK - this.roomK);
      m.tempK += ((this.heaterW - loss) * dt) / C;
    }
    // Sôi: nhiệt dư làm bay hơi nước, dung dịch đặc lại
    this.boiling = false;
    if (m.tempK > T_BOIL && m.get('H2O') > 0) {
      const nEvap = Math.min(m.get('H2O'), ((m.tempK - T_BOIL) * C) / H_VAP_WATER);
      m.add('H2O', -nEvap);
      m.volumeL = Math.max(0, m.volumeL - (nEvap * M_WATER) / 1000);
      m.tempK = T_BOIL;
      this.boiling = true;
    }
    const settle = Math.exp(-dt / SETTLE_TIME);
    for (const [id, s] of m.suspended) m.suspended.set(id, s * settle);
    this.time += dt;
    return this;
  }

  /** Chạy mô phỏng trong `seconds` giây; gọi onTick sau mỗi `every` giây */
  run(seconds: number, opts: { dt?: number; every?: number; onTick?: (o: Observation) => void } = {}): this {
    const dt = opts.dt ?? 0.05;
    const steps = Math.round(seconds / dt);
    const every = opts.every ? Math.max(1, Math.round(opts.every / dt)) : 0;
    for (let i = 1; i <= steps; i++) {
      this.step(dt);
      if (every && opts.onTick && i % every === 0) opts.onTick(this.observe());
    }
    return this;
  }

  /** Chạy cho tới khi điều kiện đúng (hoặc hết thời gian tối đa) */
  runUntil(pred: (v: Vessel) => boolean, maxSeconds: number, dt = 0.05): this {
    const end = this.time + maxSeconds;
    while (this.time < end && !pred(this)) this.step(dt);
    return this;
  }

  observe(): Observation {
    const m = this.mix;
    const L = this.spec.pathLengthCm;
    const sol = solutionColor(m, L);
    const tb = turbidity(m, L);
    const appearance = sol.map((c, i) => c * (1 - tb.turbidity) + tb.color[i] * Math.sqrt(c) * tb.turbidity) as RGB;
    const solids: SolidObservation[] = [];
    const dissolved: Record<string, number> = {};
    for (const [id, n] of m.moles) {
      const s = species(id);
      if (s.phase === 's') {
        solids.push({
          id, formula: pretty(id), name: s.name, mol: n, grams: n * s.molarMass,
          color: s.color ?? [1, 1, 1], suspended: m.suspended.get(id) ?? 0,
        });
      } else if (s.phase === 'aq' && m.volumeL > 0 && n / m.volumeL > 1e-9) {
        dissolved[id] = n / m.volumeL;
      }
    }
    const molarVolumeML = (R * m.tempK) / 101325 * 1e6;
    const gasRateML: Record<string, number> = {};
    for (const [id, r] of this.gasRate) gasRateML[id] = r * molarVolumeML;
    return {
      timeS: this.time,
      tempC: m.tempK - 273.15,
      pH: m.volumeL > 0 ? -Math.log10(m.h) : NaN,
      volumeML: m.volumeL * 1000,
      solutionColor: sol,
      appearance,
      turbidity: tb.turbidity,
      solids,
      gasRateML,
      gasTotalMol: Object.fromEntries(this.gasTotal),
      headspace: headspaceFractions(m, this.spec),
      inletRateML: this.inletRate * molarVolumeML,
      dissolved,
      boiling: this.boiling,
    };
  }
}
