/**
 * Dụng cụ điện hóa (SGK Hóa 12 Chương 5):
 * - Vôn kế nối với hai thanh kim loại cắm trong dung dịch (pin đơn giản).
 * - Nguồn điện một chiều với hai điện cực than chì nhúng trong dung dịch (điện phân).
 * Cả hai được gắn vào group của dụng cụ chứa (tọa độ cục bộ: đáy dụng cụ ở y = 0).
 */
import * as THREE from 'three';

const plastic = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

/** Dây dẫn mềm nối hai điểm (cong võng xuống) */
function wire(a: THREE.Vector3, b: THREE.Vector3, color: number, sag = 1.2): THREE.Mesh {
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(a.y, b.y) + sag;
  const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(mid.y), mid, b.clone().lerp(mid, 0.5).setY(mid.y), b]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.05, 6), plastic(color));
}

/** Màn hình số: vẽ chữ lên canvas */
class Display {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private text = '';
  constructor() {
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.set('');
  }
  set(text: string): void {
    if (text === this.text && text !== '') return;
    this.text = text;
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.fillStyle = '#c9d6b8';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#1d2418';
    g.font = 'bold 64px monospace';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(text, 240, 52);
    this.texture.needsUpdate = true;
  }
}

/** Vôn kế đặt cạnh dụng cụ, hai dây nối vào miệng dụng cụ (hai thanh kim loại) */
export class VoltmeterView {
  readonly group = new THREE.Group();
  private readonly display = new Display();

  /** mouthY: độ cao miệng dụng cụ; radius: bán kính miệng; front: khoảng cách đặt vôn kế phía trước dụng cụ */
  constructor(mouthY: number, radius: number, front = radius + 2.6) {
    const z = front, x = 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 1.1), plastic(0xe0b23a));
    body.position.set(x, 1.7, z);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.8), new THREE.MeshBasicMaterial({ map: this.display.texture }));
    screen.position.set(x, 2.7, z + 0.56);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 20).rotateX(Math.PI / 2), plastic(0x2d2f33));
    dial.position.set(x, 1.5, z + 0.6);
    const jackN = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 12).rotateX(Math.PI / 2), plastic(0x111111));
    jackN.position.set(x - 0.6, 0.5, z + 0.6);
    const jackP = jackN.clone();
    jackP.material = plastic(0xc62828);
    jackP.position.x = x + 0.6;
    this.group.add(body, screen, dial, jackN, jackP);
    // Dây đen (cực âm) và dây đỏ (cực dương) tới hai thanh kim loại ở miệng dụng cụ
    const top = mouthY + 0.4;
    this.group.add(
      wire(jackN.position.clone(), new THREE.Vector3(-radius * 0.35, top, 0), 0x1b1b1b),
      wire(jackP.position.clone(), new THREE.Vector3(radius * 0.35, top, 0), 0xc62828, 1.6),
    );
  }

  set(volts: number | null): void {
    this.display.set(volts === null ? '-.--' : volts.toFixed(2).replace('.', ',') + ' V');
  }

  dispose(): void {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.display.texture.dispose();
  }
}

/** Nguồn điện một chiều và hai điện cực than chì nhúng trong dung dịch */
export class ElectrolysisView {
  readonly group = new THREE.Group();
  private readonly cathodeCoat: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private readonly lamp: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly display = new Display();

  constructor(height: number, radius: number) {
    const graphite = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8, metalness: 0.2 });
    const len = height + 1.5;
    const ax = -radius * 0.45, cx = radius * 0.45;
    const rodGeo = new THREE.CylinderGeometry(0.16, 0.16, len, 12).translate(0, len / 2 + 0.4, 0);
    const anode = new THREE.Mesh(rodGeo, graphite);
    anode.position.x = ax;
    const cathode = new THREE.Mesh(rodGeo, graphite);
    cathode.position.x = cx;
    // Lớp kim loại bám trên cathode (đồng màu đỏ)
    this.cathodeCoat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, height * 0.55, 12).translate(0, height * 0.275 + 0.4, 0),
      new THREE.MeshStandardMaterial({ color: 0xb5562a, roughness: 0.7, transparent: true, opacity: 0 }),
    );
    this.cathodeCoat.position.x = cx;
    // Nắp đậy và kẹp
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.25, radius + 0.25, 0.15, 32), plastic(0xc8a46a));
    lid.position.y = height + 0.1;
    // Nguồn điện một chiều đặt sau dụng cụ
    const bz = -radius - 2.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 2), plastic(0x37474f));
    box.position.set(0, 1.1, bz);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.65), new THREE.MeshBasicMaterial({ map: this.display.texture }));
    screen.position.set(-0.5, 1.4, bz + 1.01);
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2e7d32, emissive: 0x00ff44, emissiveIntensity: 0 }));
    this.lamp.position.set(1.1, 1.5, bz + 1.0);
    const plus = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 12), plastic(0xc62828));
    plus.position.set(-1.1, 2.35, bz + 0.3);
    const minus = plus.clone();
    minus.material = plastic(0x111111);
    minus.position.x = 1.1;
    this.group.add(anode, cathode, this.cathodeCoat, lid, box, screen, this.lamp, plus, minus);
    // Cực dương (+) nối anode, cực âm (−) nối cathode
    const top = len + 0.4;
    this.group.add(
      wire(plus.position.clone(), new THREE.Vector3(ax, top, 0), 0xc62828, 1.5),
      wire(minus.position.clone(), new THREE.Vector3(cx, top, 0), 0x1b1b1b, 1.5),
    );
    this.display.set('6,0 V');
  }

  /** on: đang có dòng điện; coat: mức kim loại bám trên cathode (0..1) */
  update(on: boolean, coat: number): void {
    this.lamp.material.emissiveIntensity = on ? 1.5 : 0;
    this.cathodeCoat.material.opacity = Math.min(1, coat);
    this.cathodeCoat.visible = coat > 0.02;
  }

  dispose(): void {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.display.texture.dispose();
  }
}
