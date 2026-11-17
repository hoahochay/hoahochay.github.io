/** Mô hình 3D các dụng cụ thử khí: que đóm (tàn đỏ / đang cháy), giấy quỳ */
import * as THREE from 'three';
import { RGB } from '../src';
import { setRGB, softCircleTexture } from './materials';

export type ToolKind = 'glowing' | 'burning' | 'litmus';
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
  private mode: FlameMode = 'none';
  private flameScale = 0;
  private t = Math.random() * 10;

  constructor(readonly kind: ToolKind) {
    if (kind === 'litmus') {
      this.paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 3.4).translate(0, 1.7, 0),
        new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
      );
      const clip = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.25).translate(0, 3.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 }),
      );
      this.group.add(this.paper, clip);
      this.setPaperColor([0.56, 0.32, 0.62]);
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
