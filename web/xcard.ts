/**
 * Tờ giấy trắng kẻ chữ X đặt sau ống nghiệm (SGK Hóa 10 Bài 19: ảnh hưởng của nồng độ).
 * Dung dịch càng đục thì chữ X nhìn qua ống càng mờ; góc trên tờ giấy là đồng hồ bấm giờ.
 */
import * as THREE from 'three';

/** Độ đục (theo bề ngang ống) mà từ đó không còn nhìn thấy chữ X */
export const X_HIDDEN_TURBIDITY = 0.9;

const W = 2.6;
const H = 4.4;
const PX = 64; // điểm ảnh / cm

export class XCard {
  readonly group = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private xAlpha = 1;
  private timer = '';

  constructor() {
    this.canvas.width = W * PX;
    this.canvas.height = H * PX;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0),
      new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.95, side: THREE.DoubleSide }),
    );
    this.group.add(card);
    this.draw();
  }

  /** Độ rõ của chữ X (0: không thấy, 1: rõ) và chữ trên đồng hồ */
  set(xAlpha: number, timer: string): void {
    const a = Math.round(Math.max(0, Math.min(1, xAlpha)) * 50) / 50;
    if (a === this.xAlpha && timer === this.timer) return;
    this.xAlpha = a;
    this.timer = timer;
    this.draw();
  }

  private draw(): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const w = this.canvas.width, h = this.canvas.height;
    g.fillStyle = '#f7f6f1';
    g.fillRect(0, 0, w, h);
    // Chữ X ở phần dưới tờ giấy, ngang với dung dịch trong ống, rộng bằng ống nghiệm
    const cx = w / 2, cy = h - 1.6 * PX, r = 0.55 * PX;
    g.strokeStyle = `rgba(20, 20, 24, ${this.xAlpha})`;
    g.lineWidth = 0.16 * PX;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r);
    g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r);
    g.stroke();
    if (this.timer) {
      g.fillStyle = '#1d2733';
      g.font = `bold ${0.42 * PX}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.timer, cx, 0.45 * PX);
    }
    this.tex.needsUpdate = true;
  }

  dispose(): void {
    this.tex.dispose();
  }
}
