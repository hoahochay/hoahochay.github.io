/**
 * Xi lanh đo khí 100 mL kẹp nằm ngang trên giá. Vòi ở đầu +x, pít-tông bị khí đẩy lùi về phía −x.
 * Chỉ hiển thị: lượng khí do `GasSyringe` của engine tính.
 */
import * as THREE from 'three';
import { GasSyringe } from '../src';
import { glassMaterial } from './materials';

/** Bán kính trong của thân xi lanh (cm): 100 mL ứng với khoảng 14 cm */
const R = 1.5;
const LEN_PER_ML = 1 / (Math.PI * R * R);
const BARREL = 100 * LEN_PER_ML + 1.6;
/** Vạch 0 (mặt pít-tông khi chưa có khí), tính từ đầu vòi */
const X0 = -2.2;

const metal = new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.8, roughness: 0.35 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.6, roughness: 0.5 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.7 });

function scaleTexture(): THREE.CanvasTexture {
  const w = 1024, h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const px = (mL: number) => w - 8 - (mL / 100) * (w - 40);
  ctx.strokeStyle = 'rgba(25,35,50,0.85)';
  ctx.fillStyle = 'rgba(25,35,50,0.9)';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let mL = 0; mL <= 100; mL += 2) {
    const x = px(mL);
    const big = mL % 10 === 0;
    ctx.lineWidth = big ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - (big ? 40 : mL % 5 === 0 ? 28 : 18));
    ctx.stroke();
    if (big && mL % 20 === 0) ctx.fillText(String(mL), x, 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function readoutTexture(text: string, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = 256;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 72, 14);
  ctx.fill();
  ctx.fillStyle = '#1d2430';
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 42);
  return c;
}

/** Phần thân + pít-tông, dùng chung cho cảnh và ảnh thu nhỏ trong kho */
function buildBody(): { body: THREE.Group; plunger: THREE.Group } {
  const body = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, BARREL, 32, 1, true), glassMaterial(0xffffff, 0.22));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = -1.4 - BARREL / 2;
  barrel.renderOrder = 3;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, 0.35, 1.0, 24), glassMaterial(0xffffff, 0.3));
  cap.rotation.z = -Math.PI / 2;
  cap.position.x = -0.9;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 12), glassMaterial(0xffffff, 0.45));
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.x = -0.1;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.12, 8, 32), glassMaterial(0xffffff, 0.4));
  rim.rotation.y = Math.PI / 2;
  rim.position.x = -1.4 - BARREL;
  const scale = new THREE.Mesh(
    new THREE.PlaneGeometry(100 * LEN_PER_ML * 1.04, 1.0),
    new THREE.MeshBasicMaterial({ map: scaleTexture(), transparent: true, depthWrite: false }),
  );
  scale.position.set(X0 - 50 * LEN_PER_ML - 0.22, 0.55, R + 0.12);
  scale.renderOrder = 4;
  body.add(barrel, cap, nozzle, rim, scale);

  const plunger = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.5, 28), rubber);
  head.rotation.z = Math.PI / 2;
  head.position.x = -0.25;
  const rodLen = BARREL + 1.5;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, rodLen, 20), glassMaterial(0xe8f0f5, 0.35));
  rod.rotation.z = Math.PI / 2;
  rod.position.x = -0.5 - rodLen / 2;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.35, 28), glassMaterial(0xffffff, 0.45));
  knob.rotation.z = Math.PI / 2;
  knob.position.x = -0.5 - rodLen;
  plunger.add(head, rod, knob);
  plunger.position.x = X0;
  body.add(plunger);
  return { body, plunger };
}

export class SyringeView {
  /** Gốc tọa độ = đầu vòi xi lanh */
  readonly group = new THREE.Group();
  readonly name = 'Xi lanh đo khí';
  readonly syringe = new GasSyringe(100);
  private readonly plunger: THREE.Group;
  private readonly readout: THREE.Sprite;
  private readonly readoutCanvas: HTMLCanvasElement;
  private shownML = -1;
  /** Số đọc hiển thị: pít-tông trượt mượt về vị trí mới */
  private animML = 0;

  /** `height`: độ cao trục xi lanh so với mặt bàn (cm) */
  constructor(private readonly height = 17.5) {
    this.group.userData = { kind: 'syringe', view: this };
    const { body, plunger } = buildBody();
    this.plunger = plunger;
    this.group.add(body);

    // Giá đỡ: đế, cột, hai kẹp ôm thân xi lanh
    const stand = new THREE.Group();
    const y0 = -this.heightAboveBench();
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 4).translate(0, 0.2, 0), darkMetal);
    base.position.set(-7, y0, -2.6);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, -y0 + 2, 12).translate(0, (-y0 + 2) / 2, 0), metal);
    rod.position.set(-7, y0, -2.8);
    stand.add(base, rod);
    for (const x of [-3.5, -11]) {
      const jaw = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.14, 8, 24), darkMetal);
      jaw.rotation.y = Math.PI / 2;
      jaw.position.x = x;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x + 7) + 0.3, 0.22, 0.22), metal);
      arm.position.set((x - 7) / 2, 0, -2.8);
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.8 - R), metal);
      link.position.set(x, 0, -(2.8 + R) / 2);
      stand.add(jaw, arm, link);
    }
    this.group.add(stand);

    // Vùng nhận chuột
    const hit = new THREE.Mesh(new THREE.BoxGeometry(BARREL + 3, 4.5, 4.5));
    hit.position.x = -BARREL / 2 - 1;
    hit.visible = false;
    this.group.add(hit);

    this.readoutCanvas = readoutTexture('0,0 mL');
    const tex = new THREE.CanvasTexture(this.readoutCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.readout = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    this.readout.scale.set(3.6, 1.12, 1);
    this.readout.position.set(-BARREL / 2 - 1, R + 1.9, 0);
    this.readout.renderOrder = 10;
    this.group.add(this.readout);
  }

  /** Độ cao của trục xi lanh so với mặt bàn (cm) */
  heightAboveBench(): number {
    return this.height;
  }

  /** Đầu vòi (nơi ống dẫn khí cắm vào), tọa độ thế giới */
  inletWorld(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0.2, 0, 0));
  }

  mouthWorld(): THREE.Vector3 {
    return this.inletWorld();
  }

  update(dt: number): void {
    const target = this.syringe.volumeML;
    this.animML += (target - this.animML) * Math.min(1, dt * 8);
    if (Math.abs(target - this.animML) < 0.01) this.animML = target;
    this.plunger.position.x = X0 - this.animML * LEN_PER_ML;
    const shown = Math.round(target * 2) / 2;
    if (shown !== this.shownML) {
      this.shownML = shown;
      readoutTexture(`${shown.toFixed(1).replace('.', ',')} mL`, this.readoutCanvas);
      (this.readout.material.map as THREE.CanvasTexture).needsUpdate = true;
    }
  }

  reset(): void {
    this.syringe.reset();
    this.animML = 0;
    this.update(0);
  }
}

/** Ảnh thu nhỏ trong kho */
export function syringeModel(): THREE.Group {
  const g = new THREE.Group();
  const { body, plunger } = buildBody();
  plunger.position.x = X0 - 35 * LEN_PER_ML;
  g.add(body);
  g.rotation.y = -0.35;
  return g;
}
