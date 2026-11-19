/**
 * Burette 25 mL kẹp trên giá, đầu vòi ngay trên miệng bình (SGK Hóa 11 Bài 2, Hình 2.6).
 * Gốc tọa độ của group là đầu vòi burette.
 */
import * as THREE from 'three';
import type { Burette } from '../src';
import { glassMaterial } from './materials';

const R = 0.32;
/** Chiều dài phần chia vạch 0 – 25 mL */
const SCALE_L = 15;
const TUBE_BOTTOM = 1.9;
const TOP = TUBE_BOTTOM + SCALE_L + 1.2;
const ML_TO_Y = SCALE_L / 25;

interface Drop { mesh: THREE.Mesh; v: number }

export class BuretteView {
  readonly group = new THREE.Group();
  private readonly liquid: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private readonly stream: THREE.Mesh;
  private readonly drops: Drop[] = [];
  private readonly dropGeo = new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.3, 1);
  private readonly liquidMat = new THREE.MeshStandardMaterial({ color: 0xe4eef4, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });

  /** tipAboveBench: độ cao đầu vòi so với mặt bàn (để chân giá chạm bàn) */
  constructor(tipAboveBench: number) {
    const glass = glassMaterial(0xffffff, 0.25);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TOP - TUBE_BOTTOM, 20, 1, true).translate(0, (TOP + TUBE_BOTTOM) / 2, 0), glass);
    tube.renderOrder = 5;
    // Phần thuôn và vòi nhỏ dưới khóa
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(R, 0.1, 0.5, 16, 1, true).translate(0, TUBE_BOTTOM - 0.25, 0), glass);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, TUBE_BOTTOM - 0.5, 10, 1, true).translate(0, (TUBE_BOTTOM - 0.5) / 2, 0), glass);
    neck.renderOrder = tip.renderOrder = 5;
    // Khóa burette (màu đỏ cam như hình SGK)
    const tap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.22).translate(0, 1.0, 0), new THREE.MeshStandardMaterial({ color: 0xd2401f, roughness: 0.5 }));
    const tapBody = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10).translate(0, 1.0, 0), glass);
    this.group.add(tube, neck, tip, tap, tapBody);
    // Vạch chia mỗi 1 mL, vạch dài mỗi 5 mL (vạch 0 ở trên)
    const markMat = new THREE.MeshBasicMaterial({ color: 0x2b3440 });
    for (let i = 0; i <= 25; i++) {
      const long = i % 5 === 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.3 : 0.16, 0.025, 0.02), markMat);
      m.position.set(-R * 0.55 + (long ? 0 : -0.07), TUBE_BOTTOM + SCALE_L - i * ML_TO_Y, R * 0.86);
      this.group.add(m);
    }
    this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, 1, 20).translate(0, 0.5, 0), this.liquidMat);
    this.liquid.renderOrder = 4;
    this.liquid.position.y = TUBE_BOTTOM - 0.4;
    this.group.add(this.liquid);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, -0.5, 0), this.liquidMat);
    this.stream.visible = false;
    this.group.add(this.stream);
    // Giá đỡ: chân đế trên bàn, thanh đứng, kẹp burette
    const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.6, roughness: 0.4 });
    const rodX = -2.4;
    const rodTop = TOP + 0.5;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, rodTop + tipAboveBench, 10).translate(rodX, (rodTop - tipAboveBench) / 2, 0), iron);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 2.4).translate(rodX + 0.6, -tipAboveBench + 0.125, -0.9), new THREE.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.6 }));
    const clampY = TUBE_BOTTOM + SCALE_L * 0.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16).translate(rodX / 2, clampY, 0), iron);
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0, clampY, 0), iron);
    this.group.add(rod, base, arm, jaw);
  }

  /** surfaceY: độ cao mặt chất lỏng trong bình, theo tọa độ của group (âm: dưới đầu vòi) */
  update(dt: number, b: Burette, dispensedML: number, surfaceY: number): void {
    const level = TUBE_BOTTOM + SCALE_L - b.usedML * ML_TO_Y;
    this.liquid.scale.y = Math.max(0.01, level - (TUBE_BOTTOM - 0.4));
    this.liquid.visible = b.leftML > 0.01;
    this.stream.visible = b.mode === 'stream' && b.leftML > 0;
    if (this.stream.visible) this.stream.scale.y = Math.max(0.1, -surfaceY);
    // Mỗi giọt nhỏ xuống là một hạt rơi
    if (b.mode !== 'stream') {
      for (let n = Math.round(dispensedML / 0.05); n > 0; n--) this.spawnDrop();
    }
    for (const d of this.drops) {
      if (!d.mesh.visible) continue;
      d.v += 30 * dt;
      d.mesh.position.y -= d.v * dt;
      if (d.mesh.position.y < surfaceY) d.mesh.visible = false;
    }
  }

  private spawnDrop(): void {
    let d = this.drops.find((x) => !x.mesh.visible);
    if (!d) {
      if (this.drops.length > 8) return;
      d = { mesh: new THREE.Mesh(this.dropGeo, this.liquidMat), v: 0 };
      this.group.add(d.mesh);
      this.drops.push(d);
    }
    d.mesh.visible = true;
    d.mesh.position.set(0, -0.1, 0);
    d.v = 0;
  }

  dispose(): void {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}
