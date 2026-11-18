/** Phát hiện hiện tượng quan sát được (kiểu mô tả trong SGK) từ chuỗi Observation */
import { FORM_FACTOR, Observation, pretty, RateContext, RGB, SOLID_INDEX, species } from '../src';
import { SOLID_COLOR_NAME } from './catalog';
import { VesselView } from './VesselView';

export interface LogEntry {
  t: number;
  vessel: string;
  text: string;
  color?: RGB;
  equation?: string;
  kind?: 'action' | 'phenomenon' | 'warning';
}

interface State {
  solids: Set<string>;
  /** Muối dễ tan đã báo bão hòa */
  saturated?: Set<string>;
  gases: Set<string>;
  refColor: RGB;
  refTemp: number;
  boiling: boolean;
  hadLiquid: boolean;
  /** Chất rắn khô đang nóng đỏ */
  glowing: boolean;
}

/** Tên màu tiếng Việt gần đúng */
export function colorName(c: RGB): string {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max - min;
  if (s < 0.08) return l > 0.85 ? 'không màu' : l > 0.4 ? 'xám' : 'đen';
  let h = 0;
  if (max === r) h = ((g - b) / s + 6) % 6;
  else if (max === g) h = (b - r) / s + 2;
  else h = (r - g) / s + 4;
  h *= 60;
  const pale = l > 0.8 ? ' nhạt' : '';
  if (h < 15 || h >= 345) return (l < 0.35 ? 'đỏ nâu' : 'đỏ') + pale;
  if (h < 40) return (l < 0.45 ? 'nâu' : 'cam') + pale;
  if (h < 65) return 'vàng' + pale;
  if (h < 160) return 'xanh lục' + pale;
  if (h < 200) return 'xanh lơ' + pale;
  if (h < 255) return 'xanh lam' + pale;
  if (h < 290) return 'tím' + pale;
  return 'hồng' + pale;
}

export function precipitationEquation(solidId: string): string {
  const s = SOLID_INDEX.get(solidId);
  if (!s) return '';
  const left = Object.entries(s.ions)
    .map(([id, nu]) => (nu > 1 ? nu : '') + pretty(id))
    .join(' + ');
  return `${left} → ${pretty(solidId)}↓`;
}

/** Các phản ứng chậm đang xảy ra (tốc độ đáng kể) */
export function activeReactions(view: VesselView): string[] {
  const v = view.vessel;
  const mix = v.mix;
  const ctx: RateContext = {
    mix, T: mix.tempK, V: mix.volumeL,
    conc: (id) => mix.conc(id),
    surface: (id) => mix.surface(id),
  };
  const out: string[] = [];
  for (const r of v.reactions) {
    const ok = Object.keys(r.reactants).every((id) => id === 'H2O' || mix.get(id) > 0);
    if (ok && r.rate(ctx) > 2e-8) out.push(r.equation);
  }
  return out;
}

export class PhenomenaTracker {
  private readonly state = new Map<VesselView, State>();

  reset(view: VesselView): void {
    this.state.delete(view);
  }

  check(view: VesselView, o: Observation): LogEntry[] {
    const out: LogEntry[] = [];
    const mix = view.vessel.mix;
    const log = (text: string, extra: Partial<LogEntry> = {}) =>
      out.push({ t: o.timeS, vessel: view.name, text, kind: 'phenomenon', ...extra });
    let st = this.state.get(view);
    if (!st) {
      st = { solids: new Set(), gases: new Set(), refColor: o.solutionColor, refTemp: o.tempC, boiling: false, hadLiquid: false, glowing: false };
      this.state.set(view, st);
    }
    const hasLiquid = o.volumeML > 0.01;
    if (hasLiquid && !st.hadLiquid) {
      st.refColor = o.solutionColor;
      st.refTemp = o.tempC;
    }
    st.hadLiquid = hasLiquid;

    // Chất rắn xuất hiện / biến mất
    const now = new Set(o.solids.filter((s) => s.grams > 3e-4).map((s) => s.id));
    for (const id of now) {
      if (st.solids.has(id)) continue;
      const fine = (mix.formFactor.get(id) ?? 0) >= FORM_FACTOR.precipitate;
      const name = SOLID_COLOR_NAME[id];
      if (fine) {
        log(`Xuất hiện kết tủa ${name ?? ''} ${pretty(id)}`.replace('  ', ' '), {
          color: species(id).color, equation: precipitationEquation(id),
        });
      } else if ((id === 'Cu' || id === 'Ag') && !view.hasSolidVisual(id)) {
        log(`Có ${species(id).name} (${name}) bám trên bề mặt kim loại`, { color: species(id).color });
      } else if (!hasLiquid && !view.hasSolidVisual(id)) {
        // Phản ứng giữa các chất rắn khi đun (vd. Fe + S → FeS)
        const r = view.vessel.reactions.find((x) => id in x.products);
        log(`Tạo thành chất rắn màu ${name ?? colorName(species(id).color ?? [0.5, 0.5, 0.5])} ${pretty(id)}`, {
          color: species(id).color, equation: r?.equation,
        });
      }
    }
    for (const id of st.solids) {
      if (now.has(id)) continue;
      const fine = (mix.formFactor.get(id) ?? 0) >= FORM_FACTOR.precipitate;
      // Muối dễ tan cho vào ở dạng rắn (muối ăn, CuSO₄…): tan hết vào nước
      const soluble = !fine && (SOLID_INDEX.get(id)?.Ksp ?? 0) > 0.1;
      log(fine ? `Kết tủa ${pretty(id)} tan hết` : soluble ? `${pretty(id)} tan hết trong nước` : `${capital(species(id).name)} đã phản ứng hết`);
    }
    // Dung dịch bão hòa: muối dễ tan không tan thêm được, còn dư dưới đáy
    for (const id of now) {
      const soluble = (SOLID_INDEX.get(id)?.Ksp ?? 0) > 0.1;
      if (!soluble || !hasLiquid || st.saturated?.has(id)) continue;
      if ((mix.saturation.get(id) ?? 0) > 0.98) {
        (st.saturated ??= new Set()).add(id);
        log(`${pretty(id)} không tan thêm được, còn dư dưới đáy: dung dịch đã bão hòa`);
      }
    }
    st.solids = now;

    // Khí
    for (const [id, rate] of Object.entries(o.gasRateML)) {
      if (!st.gases.has(id) && rate > 0.04) {
        st.gases.add(id);
        log(`Sủi bọt khí ${pretty(id)}`);
      }
    }
    for (const id of [...st.gases]) {
      if ((o.gasRateML[id] ?? 0) < 0.004) {
        st.gases.delete(id);
        log(`Ngừng thoát khí ${pretty(id)}`);
      }
    }

    // Màu dung dịch
    if (hasLiquid) {
      const d = Math.hypot(...o.solutionColor.map((c, i) => c - st!.refColor[i]));
      if (d > 0.2) {
        log(`Dung dịch chuyển sang màu ${colorName(o.solutionColor)}`, { color: o.solutionColor });
        st.refColor = o.solutionColor;
      }
      // Nhiệt độ
      if (o.tempC - st.refTemp >= 8) {
        log(`Dung dịch nóng lên (${o.tempC.toFixed(0)} °C)`);
        st.refTemp = o.tempC;
      } else if (st.refTemp - o.tempC >= 15) {
        log(`Dung dịch nguội dần (${o.tempC.toFixed(0)} °C)`);
        st.refTemp = o.tempC;
      }
    }
    // Chất rắn khô nóng đỏ
    if (!hasLiquid && o.solids.length) {
      if (!st.glowing && o.tempC > 450) {
        st.glowing = true;
        log(`Hỗn hợp nóng đỏ rực lên (${o.tempC.toFixed(0)} °C)`, { color: [1, 0.35, 0.08] });
      } else if (st.glowing && o.tempC < 400) {
        st.glowing = false;
        log(`Hỗn hợp hết nóng đỏ, nguội dần (${o.tempC.toFixed(0)} °C)`);
      }
    }
    if (o.boiling && !st.boiling) log('Dung dịch sôi, nước bay hơi');
    st.boiling = o.boiling;
    return out;
  }
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
