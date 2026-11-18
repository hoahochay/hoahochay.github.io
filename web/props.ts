import * as THREE from 'three';
import { ReagentDef, SolidItem } from './catalog';
import { darkMetal, darkWood, glassMaterial, labelTexture, metal, setRGB, wood } from './materials';

// ── Lọ hóa chất ──────────────────────────────────────────────────────────

export class BottleView {
  readonly group = new THREE.Group();
  readonly home = new THREE.Vector3();
  /** Miệng lọ, tọa độ cục bộ */
  readonly mouthLocal: THREE.Vector3;
  readonly isDropper: boolean;

  constructor(readonly def: ReagentDef) {
    this.isDropper = !!def.indicator;
    const r = this.isDropper ? 0.8 : 1.25;
    const h = this.isDropper ? 2.8 : 4.2;
    this.group.userData = { kind: 'bottle', bottle: this };

    const tint = def.amber ? 0x7a3d0c : 0xffffff;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28).translate(0, h / 2, 0), glassMaterial(tint, def.amber ? 0.55 : 0.2));
    body.renderOrder = 3;
    this.group.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.45, r, 0.7, 28).translate(0, h + 0.35, 0), glassMaterial(tint, def.amber ? 0.55 : 0.2));
    shoulder.renderOrder = 3;
    this.group.add(shoulder);

    const liqCol = new THREE.Color();
    setRGB(liqCol, def.color);
    const strength = 1 - Math.min(...def.color);
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(r - 0.06, r - 0.06, h * 0.62, 24).translate(0, h * 0.31 + 0.04, 0),
      new THREE.MeshPhysicalMaterial({ color: liqCol, transparent: true, opacity: 0.35 + 0.5 * strength, roughness: 0.1, depthWrite: false }),
    );
    liquid.renderOrder = 2;
    this.group.add(liquid);

    let top = h + 0.7;
    if (this.isDropper) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 20).translate(0, top + 0.25, 0),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12).scale(1, 1.5, 1).translate(0, top + 0.9, 0),
        new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.5 }));
      this.group.add(cap, bulb);
      top += 0.5;
    } else {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 20, 1, true).translate(0, top + 0.3, 0), glassMaterial(tint, 0.3));
      neck.renderOrder = 3;
      const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.55, 20).translate(0, top + 0.75, 0),
        new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.4 }));
      this.group.add(neck, stopper);
      top += 0.6;
    }
    this.mouthLocal = new THREE.Vector3(0, top, 0);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 1.55, r * 1.0),
      new THREE.MeshStandardMaterial({
        map: labelTexture([
          { text: def.formula, size: def.formula.length > 9 ? 30 : 46, bold: true },
          { text: def.conc, size: 30, color: '#5a5f6a' },
        ]),
        roughness: 0.8,
      }),
    );
    label.position.set(0, h * 0.45, r + 0.02);
    this.group.add(label);
    this.group.traverse((o) => (o.castShadow = true));
  }
}

// ── Đèn cồn ──────────────────────────────────────────────────────────────

export class LampView {
  readonly group = new THREE.Group();
  readonly flame: THREE.Group;
  /** Đỉnh ngọn lửa (cục bộ) */
  readonly flameTip = new THREE.Vector3(0, 5.4, 0);
  lit = false;
  private t = 0;
  private readonly light: THREE.PointLight;

  constructor() {
    this.group.userData = { kind: 'lamp' };
    const pts = [
      [0, 0], [1.6, 0], [1.9, 0.6], [1.95, 1.4], [1.7, 2.3], [1.0, 2.9], [0.55, 3.1],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), glassMaterial(0xffffff, 0.3));
    body.renderOrder = 3;
    const alcohol = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0.05], [1.55, 0.05], [1.85, 0.6], [1.88, 1.3], [0, 1.3]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    alcohol.renderOrder = 2;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 20).translate(0, 3.3, 0), metal);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 10).translate(0, 3.85, 0),
      new THREE.MeshStandardMaterial({ color: 0x2b2118 }));
    this.group.add(body, alcohol, collar, wick);

    this.flame = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 12).scale(1, 2.6, 1).translate(0, 4.9, 0),
      new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12).scale(1, 2.2, 1).translate(0, 4.6, 0),
      new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    outer.renderOrder = inner.renderOrder = 5;
    this.flame.add(outer, inner);
    this.flame.visible = false;
    this.group.add(this.flame);
    this.light = new THREE.PointLight(0xffa040, 0, 14, 2);
    this.light.position.y = 5;
    this.group.add(this.light);
    this.group.traverse((o) => (o.castShadow = o !== this.flame && !(o.parent === this.flame)));
  }

  setLit(on: boolean): void {
    this.lit = on;
    this.flame.visible = on;
    this.light.intensity = on ? 30 : 0;
  }

  update(dt: number): void {
    if (!this.lit) return;
    this.t += dt;
    const f = 1 + 0.08 * Math.sin(this.t * 23) + 0.05 * Math.sin(this.t * 37);
    this.flame.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
    this.light.intensity = 26 + 8 * Math.sin(this.t * 31);
  }
}

/** Giá kẹp (cho ống nghiệm) và kiềng + lưới (cho cốc), đặt trên đèn cồn */
export function heatingStand(): { group: THREE.Group; clamp: THREE.Group; tripod: THREE.Group } {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 4).translate(0, 0.2, 0), darkMetal);
  base.position.set(-5.5, 0, -1);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 24, 12).translate(0, 12, 0), metal);
  rod.position.set(-6.5, 0, -1);
  group.add(base, rod);

  const clamp = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 0.25), metal);
  arm.position.set(-3.4, 20, -1);
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), darkMetal);
  jaw.rotation.x = Math.PI / 2;
  jaw.position.set(0, 20, 0);
  const link = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.0), metal);
  link.position.set(-0.3, 20, -0.6);
  clamp.add(arm, jaw, link);
  clamp.visible = false;

  const tripod = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.15, 8, 36), darkMetal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 7.2;
  const gauze = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.06, 6.4), new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.8, metalness: 0.5 }));
  gauze.position.y = 7.35;
  const center = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 1 }));
  center.position.y = 7.36;
  tripod.add(ring, gauze, center);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.6, 8), darkMetal);
    leg.position.set(Math.cos(a) * 3.4, 3.6, Math.sin(a) * 3.4);
    leg.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08);
    tripod.add(leg);
  }
  tripod.visible = false;
  group.add(clamp, tripod);
  group.traverse((o) => (o.castShadow = true));
  return { group, clamp, tripod };
}

// ── Giá ống nghiệm ───────────────────────────────────────────────────────

export function tubeRack(slots: number, spacing: number): THREE.Group {
  const g = new THREE.Group();
  const w = slots * spacing + 1.5;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 4).translate(0, 0.3, 0), wood);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 4).translate(0, 6, 0), wood);
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 4).translate(x, 3.1, 0), darkWood);
    g.add(side);
  }
  g.add(base, top);
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

// ── Mẫu chất rắn ─────────────────────────────────────────────────────────

/** Đĩa petri chứa mẫu chất rắn (dùng cho ảnh thu nhỏ trong kho hóa chất) */
export function dishModel(item: SolidItem): THREE.Group {
  const g = new THREE.Group();
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.5, 0.35, 32, 1, true).translate(0, 0.18, 0),
    glassMaterial(0xffffff, 0.3),
  );
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.05, 32), glassMaterial(0xffffff, 0.3));
  dish.renderOrder = bottom.renderOrder = 3;
  g.add(dish, bottom, dishSample(item));
  return g;
}

/** Mẫu chất rắn rời (dùng cho hoạt ảnh thả vào dụng cụ) */
export function solidPiece(item: SolidItem): THREE.Object3D {
  return dishSample(item);
}

function dishSample(item: SolidItem): THREE.Object3D {
  const col = new THREE.Color();
  const sp = { Mg: [0.78, 0.78, 0.78], Zn: [0.62, 0.64, 0.67], Fe: [0.4, 0.4, 0.42], Cu: [0.72, 0.42, 0.2], Na: [0.82, 0.82, 0.8], Li: [0.75, 0.75, 0.76], K: [0.8, 0.8, 0.84], CaCO3: [0.95, 0.95, 0.93], MnO2: [0.1, 0.1, 0.1], NaHCO3: [0.97, 0.97, 0.96], S: [0.96, 0.84, 0.18], NaCl: [0.97, 0.97, 0.97], CuSO4: [0.2, 0.45, 0.9], starch: [0.97, 0.96, 0.92] }[item.id] ?? [0.8, 0.8, 0.8];
  setRGB(col, sp as [number, number, number]);
  const metallic = !['CaCO3', 'MnO2', 'NaHCO3', 'S', 'NaCl', 'CuSO4', 'starch'].includes(item.id) && item.shape !== 'powder';
  const mat = new THREE.MeshStandardMaterial({ color: col, metalness: metallic ? 0.75 : 0, roughness: metallic ? 0.35 : 0.9 });
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x = 0, z = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.1, z);
    m.rotation.y = ry;
    m.castShadow = true;
    g.add(m);
  };
  switch (item.shape) {
    case 'ribbon':
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(2, 0.03, 0.28).translate(0, 0.02, 0), 0, (i - 1) * 0.5, (i - 1) * 0.3);
      break;
    case 'nail':
      add(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 10).rotateZ(Math.PI / 2).translate(0, 0.1, 0), 0, 0, 0.3);
      add(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 10).rotateZ(Math.PI / 2).translate(0, 0.1, 0), 0, 0.5, -0.2);
      break;
    case 'wire': {
      const pts = Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 6;
        return new THREE.Vector3(Math.cos(a) * 0.7, 0.08, Math.sin(a) * 0.7 * (0.6 + i / 120));
      });
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.05, 6));
      break;
    }
    case 'granule':
      for (let i = 0; i < 4; i++) add(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.1, 0).translate(0, 0.2, 0), (i % 2 - 0.5) * 0.8, (Math.floor(i / 2) - 0.5) * 0.7, i);
      break;
    case 'chunk':
      add(new THREE.BoxGeometry(0.6, 0.45, 0.5).translate(0, 0.22, 0), -0.3, 0);
      add(new THREE.BoxGeometry(0.45, 0.35, 0.5).translate(0, 0.17, 0), 0.5, 0.2, 0.6);
      break;
    case 'powder':
      add(new THREE.CylinderGeometry(0.05, 1.0, 0.45, 24).translate(0, 0.22, 0));
      break;
  }
  return g;
}

