/**
 * Dùng kẹp sắt giữ một mẩu kim loại rồi đốt trên ngọn lửa đèn cồn.
 * Kết quả tra theo kim loại: magnesium cháy sáng chói thành bột trắng; đồng bị phủ lớp đen; sắt chỉ nóng đỏ.
 */
import * as THREE from 'three';
import { RGB, species } from '../src';
import type { SolidItem } from './catalog';
import { setRGB, softCircleTexture } from './materials';

export interface BurnOutcome {
  /** Cháy thành ngọn lửa (true) hay chỉ nóng đỏ */
  burns: boolean;
  /** Màu bề mặt sau khi đốt */
  after: RGB;
  /** Màu ánh lửa khi cháy */
  light?: number;
  /** Mô tả hiện tượng khi đang đốt / sau khi đốt */
  during: string;
  result: string;
  equation?: string;
}

const OUTCOMES: Record<string, BurnOutcome> = {
  Mg: {
    burns: true, after: [0.97, 0.97, 0.95], light: 0xfff8ee,
    during: 'Magnesium cháy với ngọn lửa sáng chói màu trắng, tỏa nhiều nhiệt, có khói trắng',
    result: 'Sau khi cháy còn lại chất bột màu trắng, giòn, dễ vụn (magnesium oxide): khác hẳn mảnh kim loại ban đầu',
    equation: '2Mg + O₂ → 2MgO',
  },
  Cu: {
    burns: false, after: [0.12, 0.1, 0.09],
    during: 'Dây đồng nóng đỏ trong ngọn lửa nhưng không cháy',
    result: 'Bề mặt dây đồng bị phủ một lớp màu đen (copper(II) oxide)',
    equation: '2Cu + O₂ → 2CuO',
  },
  Fe: {
    burns: false, after: [0.3, 0.29, 0.3],
    during: 'Đinh sắt nóng đỏ nhưng không cháy (sắt khối khó cháy trong không khí)',
    result: 'Đinh sắt chỉ hơi xỉn màu',
  },
};

const DEFAULT_OUTCOME: BurnOutcome = {
  burns: false, after: [0.6, 0.6, 0.6],
  during: 'Mẫu chất nóng lên trong ngọn lửa nhưng không cháy',
  result: 'Không thấy dấu hiệu có chất mới',
};

export function burnOutcome(id: string): BurnOutcome {
  const o = OUTCOMES[id];
  if (o) return o;
  const c = species(id).color;
  return c ? { ...DEFAULT_OUTCOME, after: c } : DEFAULT_OUTCOME;
}

/** Có thể cầm bằng kẹp sắt để đốt không; trả về lý do nếu không */
export function burnRefusal(item: SolidItem): string | null {
  if (item.shape === 'powder') return 'Không kẹp được chất bột. Hãy dùng mẩu chất rắn (dải, dây, đinh, viên).';
  if (item.floats) return 'Không đốt kim loại kiềm trên đèn cồn: rất nguy hiểm.';
  return null;
}

const glowTex = softCircleTexture();

/** Kẹp sắt kẹp mẩu kim loại. Gốc tọa độ ở hàm kẹp, cán kẹp theo trục +x, mẫu chìa ra theo −x */
export class TongsView {
  readonly group = new THREE.Group();
  readonly sample: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** Đầu mẫu xa hàm kẹp (đưa vào lửa), tọa độ cục bộ */
  readonly tipLocal: THREE.Vector3;
  readonly sampleLength: number;
  private readonly glow: THREE.Sprite;
  private readonly baseColor = new THREE.Color();

  constructor(item: SolidItem) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x5b6068, metalness: 0.7, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.12).translate(4, 0, 0), steel);
      arm.rotation.y = s * 0.05;
      arm.position.z = s * 0.08;
      this.group.add(arm);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 20), steel);
    ring.position.set(8.2, 0, 0);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    setRGB(this.baseColor, species(item.id).color ?? [0.7, 0.7, 0.7]);
    const mat = new THREE.MeshStandardMaterial({ color: this.baseColor.clone(), metalness: 0.7, roughness: 0.35 });
    let geo: THREE.BufferGeometry;
    let len: number;
    switch (item.shape) {
      case 'ribbon': len = 2.6; geo = new THREE.BoxGeometry(len, 0.03, 0.28); break;
      case 'wire': len = 3; geo = new THREE.CylinderGeometry(0.05, 0.05, len, 8).rotateZ(Math.PI / 2); break;
      case 'nail': len = 3.2; geo = new THREE.CylinderGeometry(0.11, 0.11, len, 12).rotateZ(Math.PI / 2); break;
      default: len = 0.8; geo = new THREE.IcosahedronGeometry(0.4, 1);
    }
    geo.translate(-len / 2, 0, 0);
    this.sample = new THREE.Mesh(geo, mat);
    this.sample.rotation.z = 0.25; // mẫu chúc đầu xuống lửa
    this.group.add(this.sample);
    this.sampleLength = len;
    this.tipLocal = new THREE.Vector3(-len * Math.cos(0.25), -len * Math.sin(0.25), 0);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    this.glow.renderOrder = 6;
    this.glow.visible = false;
    this.group.add(this.glow);
  }

  /** Điểm trên mẫu, t = 0 ở đầu mẫu (trong lửa), t = 1 sát hàm kẹp */
  pointAlong(t: number): THREE.Vector3 {
    return this.tipLocal.clone().multiplyScalar(1 - t);
  }

  /** Nóng đỏ (0..1) */
  setHot(k: number): void {
    const m = this.sample.material;
    m.emissive.setRGB(1, 0.3, 0.06);
    m.emissiveIntensity = k * 1.2;
  }

  /** Ngọn lửa cháy tại vị trí t dọc theo mẫu; intensity 0 để tắt */
  setFlame(t: number, intensity: number, color = 0xffffff, flicker = 1): void {
    this.glow.visible = intensity > 0.01;
    if (!this.glow.visible) return;
    this.glow.material.color.set(color);
    this.glow.position.copy(this.pointAlong(t));
    this.glow.scale.setScalar(4.5 * intensity * flicker);
    this.glow.material.opacity = Math.min(1, intensity);
  }

  /** Đổi dần màu bề mặt sang màu sau khi đốt (k: 0..1); cháy xong thì mất ánh kim */
  setConverted(k: number, after: RGB, burnt: boolean): void {
    const m = this.sample.material;
    const c = new THREE.Color();
    setRGB(c, after);
    m.color.copy(this.baseColor).lerp(c, k);
    if (burnt) {
      m.metalness = 0.7 * (1 - k);
      m.roughness = 0.35 + 0.6 * k;
    }
  }
}
