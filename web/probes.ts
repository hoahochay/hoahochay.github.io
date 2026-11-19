/** Mô hình 3D các dụng cụ thử: que đóm (tàn đỏ / đang cháy), giấy quỳ, nam châm */
import * as THREE from 'three';
import { RGB } from '../src';
import { setRGB, softCircleTexture } from './materials';

/** litmus: giấy quỳ ẩm thử khí ở miệng ống; litmus_sol: giấy quỳ thử dung dịch (nhúng đầu mẩu quỳ vào dung dịch) */
/** xcard: tờ giấy kẻ chữ X đặt sau ống, kèm đồng hồ bấm giờ (xem xcard.ts) */
/** dye_paper: mẩu giấy màu ẩm thử tính tẩy màu của khí chlorine */
export type ToolKind = 'glowing' | 'burning' | 'litmus' | 'litmus_sol' | 'ph_paper' | 'ph_moist' | 'magnet' | 'xcard' | 'dye_paper';
/** Màu ban đầu của mẩu giấy màu ẩm */
export const DYE_PAPER_COLOR: RGB = [0.86, 0.16, 0.3];

/** Màu giấy pH (chất chỉ thị vạn năng) theo bảng màu chuẩn pH 1 – 14 */
const PH_SCALE: RGB[] = [
  [0.86, 0.11, 0.15], [0.93, 0.27, 0.16], [0.97, 0.49, 0.16], [0.99, 0.7, 0.18], [0.98, 0.86, 0.22],
  [0.8, 0.85, 0.25], [0.45, 0.74, 0.28], [0.18, 0.62, 0.38], [0.12, 0.55, 0.55], [0.16, 0.42, 0.7],
  [0.22, 0.3, 0.7], [0.33, 0.22, 0.62], [0.4, 0.16, 0.52], [0.38, 0.1, 0.42],
];
/** Giấy pH khô (chưa thử) */
export const PH_PAPER_DRY: RGB = [0.97, 0.8, 0.36];
export function phPaperColor(pH: number): RGB {
  const x = Math.min(13, Math.max(0, pH - 1));
  const i = Math.min(12, Math.floor(x));
  const t = x - i;
  return PH_SCALE[i].map((c, k) => c + (PH_SCALE[i + 1][k] - c) * t) as RGB;
}
export type FlameMode = 'none' | 'ember' | 'normal' | 'bright';

const TILT = 0.45;
const glowTex = softCircleTexture();

export class ProbeView {
  readonly group = new THREE.Group();
  /** Phần vẫn giữ hướng thẳng đứng ở đầu que (lửa luôn bốc lên) */
  private readonly tip = new THREE.Group();
  private readonly ember?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly flame?: THREE.Group;
  private readonly glow?: THREE.Sprite;
  private readonly paper?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private readonly body?: THREE.Group;
  private mode: FlameMode = 'none';
  private flameScale = 0;
  private t = Math.random() * 10;

  constructor(readonly kind: ToolKind) {
    if (kind === 'magnet') {
      // Nam châm chữ U: thân đỏ, hai cực bạc, hai cực hướng về phía -z (về phía ống nghiệm)
      const red = new THREE.MeshStandardMaterial({ color: 0xd8262b, roughness: 0.45, metalness: 0.2 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xc9cdd3, roughness: 0.3, metalness: 0.8 });
      const R = 0.75, w = 0.42;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(R, w / 2, 12, 24, Math.PI), red);
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = Math.PI;
      arc.position.z = 1.6;
      const leg = (x: number) => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, w, 1.6).translate(0, 0, 0.8), red);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, w + 0.01, 0.45).translate(0, 0, -0.22), steel);
        body.position.x = tip.position.x = x;
        return [body, tip];
      };
      this.group.add(arc, ...leg(-R), ...leg(R));
      return;
    }
    if (kind === 'litmus_sol' || kind === 'ph_paper') {
      // Dải giấy quỳ dài, kẹp ở đầu trên; chỉ phần đầu dưới (nhúng vào dung dịch) đổi màu
      const L = 18, wet = 2.4;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, L - wet).translate(0, wet + (L - wet) / 2, 0),
        new THREE.MeshStandardMaterial({ color: 0x8f529e, roughness: 0.9, side: THREE.DoubleSide }),
      );
      this.paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, wet).translate(0, wet / 2, 0),
        new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
      );
      const clip = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.5, 0.25).translate(0, L + 0.1, 0),
        new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 }),
      );
      if (kind === 'ph_paper') setRGB(strip.material.color, PH_PAPER_DRY);
      this.group.add(strip, this.paper, clip);
      this.setPaperColor(kind === 'ph_paper' ? PH_PAPER_DRY : [0.56, 0.32, 0.62]);
      return;
    }
    if (kind === 'litmus' || kind === 'dye_paper' || kind === 'ph_moist') {
      this.paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 3.4).translate(0, 1.7, 0),
        new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
      );
      const clip = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.25).translate(0, 3.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 }),
      );
      this.group.add(this.paper, clip);
      this.setPaperColor(kind === 'dye_paper' ? DYE_PAPER_COLOR : kind === 'ph_moist' ? PH_PAPER_DRY : [0.56, 0.32, 0.62]);
      return;
    }
    // Que đóm: tâm ở đầu que, thân que chéo lên trên
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 9, 0.13).translate(0, 4.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xd9b27c, roughness: 0.85 }),
    );
    const charred = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.5, 0.135).translate(0, 0.25, 0),
      new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 1 }),
    );
    const body = new THREE.Group();
    body.add(stick, charred);
    body.rotation.z = TILT;
    this.body = body;
    this.group.add(body, this.tip);

    this.ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff4a10, emissiveIntensity: 2 }),
    );
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff6a20, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.glow.scale.setScalar(0.7);
    this.flame = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 10).scale(1, 2.6, 1).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffa133, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 8).scale(1, 2, 1).translate(0, 0.3, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    outer.renderOrder = inner.renderOrder = this.glow.renderOrder = 5;
    this.flame.add(outer, inner);
    this.tip.add(this.ember, this.glow, this.flame);
    this.setFlame(kind === 'glowing' ? 'ember' : 'normal', true);
  }

  setFlame(mode: FlameMode, instant = false): void {
    this.mode = mode;
    if (instant) this.flameScale = mode === 'normal' ? 1 : mode === 'bright' ? 1.7 : 0;
  }

  /** Cầm que hướng xuống (đưa từ dưới lên miệng ống đang úp); ngọn lửa vẫn bốc lên */
  holdFromBelow(): void {
    if (this.body) this.body.rotation.z = Math.PI - TILT;
  }

  setPaperColor(c: RGB): void {
    if (this.paper) setRGB(this.paper.material.color, c);
  }

  update(dt: number): void {
    if (!this.flame || !this.ember || !this.glow) return;
    this.t += dt;
    const target = this.mode === 'normal' ? 1 : this.mode === 'bright' ? 1.7 : 0;
    this.flameScale += (target - this.flameScale) * Math.min(1, dt * 6);
    const flick = 1 + 0.1 * Math.sin(this.t * 25) + 0.06 * Math.sin(this.t * 41);
    this.flame.visible = this.flameScale > 0.02;
    this.flame.scale.set(this.flameScale / Math.sqrt(flick), this.flameScale * flick, this.flameScale / Math.sqrt(flick));
    const burning = this.mode !== 'none';
    this.ember.material.emissiveIntensity = burning ? 1.6 + 0.6 * Math.sin(this.t * 7) : 0;
    this.glow.visible = burning;
    this.glow.material.opacity = this.mode === 'ember' ? 0.55 + 0.25 * Math.sin(this.t * 5) : 0.35;
  }
}

/** Chớp sáng của tiếng nổ nhỏ H2 */
export function popFlash(): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.renderOrder = 6;
  return s;
}

/** Ngọn lửa xanh nhạt của H2 cháy ở miệng ống */
export function blueFlame(): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 10).scale(1, 1.8, 1).translate(0, 0.8, 0),
    new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  m.renderOrder = 5;
  return m;
}

/** Khói nhỏ khi que đóm tắt */
export function smokePuff(): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x888888, transparent: true, opacity: 0.5, depthWrite: false }));
  s.renderOrder = 6;
  return s;
}
