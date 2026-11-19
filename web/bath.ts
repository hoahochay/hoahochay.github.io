/**
 * Cốc nước đá / cốc nước nóng nhỏ đặt quanh đáy ống nghiệm để ngâm ống
 * (SGK Hóa 11 Bài 1: ảnh hưởng của nhiệt độ đến cân bằng hóa học).
 */
import * as THREE from 'three';
import { glassMaterial, softCircleTexture } from './materials';

export type BathKind = 'ice' | 'warm' | 'hot';

/** Nhiệt độ nước trong cốc, °C */
export const BATH_TEMP_C: Record<BathKind, number> = { ice: 0, warm: 50, hot: 80 };

/** Công cụ trong kho tương ứng với từng loại cốc */
export const BATH_TOOL = { ice_bath: 'ice', warm_bath: 'warm', hot_bath: 'hot' } as const;

const R = 1.5;
const H = 4.6;
const WATER_H = 3.7;
const steamTex = softCircleTexture();

interface Wisp { sprite: THREE.Sprite; age: number; life: number }

export class BathView {
  readonly group = new THREE.Group();
  private readonly wisps: Wisp[] = [];
  private acc = 0;

  constructor(readonly kind: BathKind) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 0.05, H, 36, 1, true).translate(0, H / 2, 0), glassMaterial(0xffffff, 0.22));
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.08, 36).translate(0, 0.04, 0), glassMaterial(0xffffff, 0.22));
    glass.renderOrder = bottom.renderOrder = 5;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(R - 0.08, R - 0.1, WATER_H, 36).translate(0, 0.08 + WATER_H / 2, 0),
      new THREE.MeshStandardMaterial({
        color: kind === 'ice' ? 0xd6ecff : 0xcfe4ee, transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false,
      }),
    );
    water.renderOrder = 4;
    this.group.add(glass, bottom, water);
    if (kind === 'ice') {
      // Vài viên đá nổi quanh ống nghiệm
      const ice = new THREE.MeshStandardMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.8, roughness: 0.25 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), ice);
        cube.position.set(Math.cos(a) * 1.12, 0.08 + WATER_H - 0.1 - (i % 2) * 0.5, Math.sin(a) * 1.12);
        cube.rotation.set(0.3 * i, a, 0.2 * (i % 3));
        cube.renderOrder = 4;
        this.group.add(cube);
      }
    }
  }

  /** Hơi nước bốc lên từ cốc nước nóng */
  update(dt: number): void {
    if (this.kind === 'ice') return;
    this.acc += dt * (this.kind === 'hot' ? 3 : 1);
    while (this.acc >= 1) {
      this.acc -= 1;
      let w = this.wisps.find((x) => !x.sprite.visible);
      if (!w && this.wisps.length < 12) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
        sprite.renderOrder = 6;
        this.group.add(sprite);
        w = { sprite, age: 0, life: 2 };
        this.wisps.push(w);
      }
      if (!w) break;
      const a = Math.random() * Math.PI * 2;
      w.sprite.visible = true;
      w.sprite.position.set(Math.cos(a) * 1.15, WATER_H + 0.2, Math.sin(a) * 1.15);
      w.age = 0;
      w.life = 1.6 + Math.random();
    }
    for (const w of this.wisps) {
      if (!w.sprite.visible) continue;
      w.age += dt;
      const t = w.age / w.life;
      if (t >= 1) { w.sprite.visible = false; continue; }
      w.sprite.position.y += dt * 0.9;
      w.sprite.scale.setScalar(0.5 + t * 1.2);
      w.sprite.material.opacity = 0.35 * Math.sin(Math.PI * t);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) o.geometry.dispose();
    });
  }
}
