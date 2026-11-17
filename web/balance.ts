/** Cân điện tử (độ chính xác 0,01 g): đĩa cân trên thân máy, màn hình số ở mặt trước. Chỉ hiển thị. */
import * as THREE from 'three';

const W = 9, D = 8, H = 2.2;
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.55 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6 });
const panMat = new THREE.MeshStandardMaterial({ color: 0xd2d6db, metalness: 0.85, roughness: 0.25 });

function lcd(text: string, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = 320;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b9d3b0';
  ctx.fillRect(0, 0, 320, 96);
  ctx.fillStyle = '#16231a';
  ctx.font = '700 60px "Courier New", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 270, 52);
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText('g', 306, 60);
  return c;
}

/** Thân cân, dùng chung cho cảnh và ảnh thu nhỏ trong kho */
function buildBody(): { group: THREE.Group; screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0), bodyMat);
  body.castShadow = body.receiveShadow = true;
  // Mặt trước vát chứa màn hình
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, 0.9, 1.8), darkMat);
  front.position.set(0, H - 0.65, D / 2 - 0.6);
  front.rotation.x = -0.45;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lcd('0.00')) }));
  screen.position.set(-1.4, H - 0.42, D / 2 - 0.04);
  screen.rotation.x = -0.45;
  for (const [i, label] of [[0, 0xf3f4f6], [1, 0x7fb6f5]] as const) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 16), new THREE.MeshStandardMaterial({ color: label, roughness: 0.5 }));
    b.rotation.x = Math.PI / 2 - 0.45;
    b.position.set(1.9 + i * 1.1, H - 0.42, D / 2 - 0.02);
    group.add(b);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), darkMat);
  post.position.set(0, H + 0.15, -0.6);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.16, 48), panMat);
  pan.position.set(0, H + 0.38, -0.6);
  pan.castShadow = pan.receiveShadow = true;
  group.add(body, front, screen, post, pan);
  return { group, screen };
}

export class BalanceView {
  readonly group = new THREE.Group();
  readonly name = 'Cân điện tử';
  private readonly canvas: HTMLCanvasElement;
  private readonly tex: THREE.CanvasTexture;
  private shown = '';

  constructor() {
    this.group.userData = { kind: 'balance', view: this };
    const { group, screen } = buildBody();
    this.group.add(group);
    this.tex = screen.material.map as THREE.CanvasTexture;
    this.canvas = this.tex.image as HTMLCanvasElement;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, H + 1.4, D + 0.6).translate(0, (H + 1.4) / 2, 0));
    hit.visible = false;
    this.group.add(hit);
  }

  /** Điểm đặt đáy dụng cụ lên đĩa cân, tọa độ thế giới */
  panTopWorld(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0, H + 0.46, -0.6));
  }

  /** Hiện số trên màn hình, làm tròn 0,01 g như cân thật */
  display(g: number): void {
    const t = (Math.round(g * 100) / 100 + 0).toFixed(2);
    if (t === this.shown) return;
    this.shown = t;
    lcd(t, this.canvas);
    this.tex.needsUpdate = true;
  }
}

/** Ảnh thu nhỏ trong kho */
export function balanceModel(): THREE.Group {
  const { group } = buildBody();
  return group;
}
