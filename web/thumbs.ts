/** Render ảnh thu nhỏ cho từng hóa chất từ chính mô hình 3D (lọ / đĩa mẫu) */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChemEntry } from './catalog';
import { BottleView, dishModel } from './props';

export function renderThumbnails(entries: ChemEntry[], size = 128): Map<string, string> {
  const out = new Map<string, string>();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x99887a, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  for (const e of entries) {
    const obj = e.solid ? dishModel(e.solid) : new BottleView(e.reagent!).group;
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 0.92;
    const dir = e.solid ? new THREE.Vector3(0, 0.9, 0.75) : new THREE.Vector3(0.15, 0.25, 1);
    camera.position.copy(center).addScaledVector(dir.normalize(), dist);
    camera.lookAt(center);
    renderer.render(scene, camera);
    out.set(e.key, renderer.domElement.toDataURL('image/png'));
    scene.remove(obj);
  }
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
