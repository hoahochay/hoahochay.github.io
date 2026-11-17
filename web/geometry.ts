import * as THREE from 'three';

/** Mặt cắt trong của dụng cụ: bán kính theo chiều cao (cm). 1 cm³ = 1 mL. */
export interface Profile {
  height: number;
  radius(y: number): number;
  /** Vùng đáy cong cần lấy mẫu dày hơn */
  bottomZone: number;
}

export function tubeProfile(r: number, h: number): Profile {
  return {
    height: h,
    bottomZone: r,
    radius: (y) => (y >= r ? r : Math.sqrt(Math.max(0, r * r - (r - y) * (r - y)))),
  };
}

export function beakerProfile(r: number, h: number): Profile {
  return { height: h, bottomZone: 0, radius: () => r };
}

/** Bình nón (Erlenmeyer): đáy rộng, thân côn, cổ hẹp */
export function flaskProfile(rBase: number, rNeck: number, hCone: number, h: number): Profile {
  const shoulder = 0.9;
  return {
    height: h,
    bottomZone: 0,
    radius: (y) => {
      if (y >= hCone) return rNeck;
      const r = rBase + (rNeck - rBase) * (y / hCone);
      // Bo tròn vai bình để chỗ nối thân côn với cổ không gãy khúc
      const k = Math.max(0, (y - (hCone - shoulder)) / shoulder);
      return r + (rNeck - r) * k * k * (3 - 2 * k) * 0.4;
    },
  };
}

/** Bảng tra thể tích ↔ chiều cao mực chất lỏng */
export class VolumeMap {
  private readonly ys: number[] = [];
  private readonly vs: number[] = [];

  constructor(readonly profile: Profile, n = 800) {
    const dy = profile.height / n;
    let v = 0;
    for (let i = 0; i <= n; i++) {
      const y = i * dy;
      if (i > 0) v += Math.PI * profile.radius(y - dy / 2) ** 2 * dy;
      this.ys.push(y);
      this.vs.push(v);
    }
  }

  get capacityML(): number {
    return this.vs[this.vs.length - 1];
  }

  heightFor(mL: number): number {
    if (mL <= 0) return 0;
    const { vs, ys } = this;
    if (mL >= vs[vs.length - 1]) return ys[ys.length - 1];
    let lo = 0;
    let hi = vs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (vs[mid] < mL) lo = mid;
      else hi = mid;
    }
    const f = (mL - vs[lo]) / (vs[hi] - vs[lo]);
    return ys[lo] + f * (ys[hi] - ys[lo]);
  }
}

function sampleYs(p: Profile, y0: number, y1: number, segs: number): number[] {
  const ys = new Set<number>();
  for (let i = 0; i <= segs; i++) ys.add(y0 + ((y1 - y0) * i) / segs);
  const zone = Math.min(y1, p.bottomZone);
  for (let y = y0; y < zone; y += 0.04) ys.add(y);
  return [...ys].sort((a, b) => a - b);
}

/** Khối tròn xoay lấp đầy mặt cắt từ y0 tới y1 (chất lỏng, lớp cặn) */
export function filledLathe(p: Profile, y0: number, y1: number, inset = 0, radial = 40): THREE.LatheGeometry {
  const pts = [new THREE.Vector2(0, y0)];
  for (const y of sampleYs(p, y0, y1, 12)) pts.push(new THREE.Vector2(Math.max(0.001, p.radius(y) - inset), y));
  pts.push(new THREE.Vector2(0, y1));
  return new THREE.LatheGeometry(pts, radial);
}

/** Thành thủy tinh (mặt ngoài, miệng hở) */
export function glassLathe(p: Profile, wall: number, radial = 40): THREE.LatheGeometry {
  const pts = [new THREE.Vector2(0, -wall)];
  for (const y of sampleYs(p, 0, p.height, 24)) pts.push(new THREE.Vector2(p.radius(y) + wall, y));
  return new THREE.LatheGeometry(pts, radial);
}
