/** Ống dẫn khí: nút cao su trên ống phát khí, ống dẫn uốn cong sang dụng cụ nhận */
import * as THREE from 'three';
import { SyringeView } from './syringe';
import type { VesselView } from './VesselView';

const tubeMat = new THREE.MeshPhysicalMaterial({
  color: 0xf4f8fb, transparent: true, opacity: 0.45, roughness: 0.05, transmission: 0.3, depthWrite: false,
});
const stopperMat = new THREE.MeshStandardMaterial({ color: 0xb8462c, roughness: 0.8 });

export class DeliveryTubeView {
  readonly group = new THREE.Group();
  private readonly pipe: THREE.Mesh<THREE.TubeGeometry, THREE.MeshPhysicalMaterial>;
  private readonly stopper: THREE.Mesh;
  private key = '';

  constructor(readonly src: VesselView, readonly dst: VesselView | SyringeView) {
    this.stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 1.1, 20), stopperMat);
    this.pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), 2, 0.13, 8), tubeMat);
    this.pipe.renderOrder = 3;
    this.group.add(this.stopper, this.pipe);
    this.update();
  }

  /** Vẽ lại khi một trong hai dụng cụ di chuyển */
  update(): void {
    const s = this.src.mouthWorld();
    const end = this.dst.inletWorld();
    const d = this.dst.mouthWorld();
    const key = [s, end].map((v) => v.toArray().map((x) => x.toFixed(2)).join()).join('|');
    if (key === this.key) return;
    this.key = key;
    this.stopper.position.copy(s).add(new THREE.Vector3(0, 0.15, 0));
    const top = Math.max(s.y, d.y) + 2.8;
    const pts = [
      s.clone().add(new THREE.Vector3(0, -0.4, 0)),
      s.clone().add(new THREE.Vector3(0, 1.4, 0)),
      new THREE.Vector3(s.x + (d.x - s.x) * 0.15, top, s.z),
    ];
    if (this.dst instanceof SyringeView) {
      // Xi lanh nằm ngang phía sau: ống đi lên, vòng ra sau rồi cắm ngang vào vòi
      const top2 = Math.max(s.y + 2.2, end.y + 1.8);
      pts.length = 0;
      pts.push(
        s.clone().add(new THREE.Vector3(0, -0.4, 0)),
        s.clone().add(new THREE.Vector3(0, 1.4, 0)),
        new THREE.Vector3(s.x, top2, s.z - 0.8),
        new THREE.Vector3(end.x + 2.4, top2, end.z + 0.6),
        new THREE.Vector3(end.x + 2.2, end.y, end.z),
        end.clone().add(new THREE.Vector3(0.9, 0, 0)),
        end.clone().add(new THREE.Vector3(-0.6, 0, 0)),
      );
    } else if (this.dst.vessel.inverted) {
      // Ống úp ngược: luồn ống dẫn xuống phía trước giá rồi đi lên vào miệng ống
      const zf = d.z + 2.8;
      pts.push(
        new THREE.Vector3(d.x - (d.x - s.x) * 0.15, top, zf),
        new THREE.Vector3(d.x, d.y - 0.6, zf),
        new THREE.Vector3(d.x, d.y - 1.1, d.z + 0.9),
        new THREE.Vector3(d.x, d.y - 0.6, d.z),
        d.clone().add(new THREE.Vector3(0, 0.6, 0)),
        end,
      );
    } else {
      pts.push(
        new THREE.Vector3(d.x - (d.x - s.x) * 0.15, top, d.z),
        d.clone().add(new THREE.Vector3(0, 1.2, 0)),
        d.clone(),
        end,
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    this.pipe.geometry.dispose();
    this.pipe.geometry = new THREE.TubeGeometry(curve, 120, 0.13, 10);
  }

  dispose(): void {
    this.pipe.geometry.dispose();
  }
}

/** Hình ảnh thu nhỏ trong kho: một đoạn ống dẫn uốn chữ L kèm nút cao su */
export function deliveryTubeModel(): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2, -1.5, 0), new THREE.Vector3(-2, 1, 0), new THREE.Vector3(-1.2, 2, 0),
    new THREE.Vector3(1.2, 2, 0), new THREE.Vector3(2, 1, 0), new THREE.Vector3(2, -2, 0),
  ], false, 'centripetal', 0.3);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.16, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.1, metalness: 0, clearcoat: 1 }));
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.48, 0.8, 20), stopperMat);
  stopper.position.set(-2, -1.2, 0);
  g.add(pipe, stopper);
  return g;
}
