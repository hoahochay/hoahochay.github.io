/** Render ảnh thu nhỏ cho từng hóa chất từ chính mô hình 3D (lọ / đĩa mẫu) */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChemEntry } from './catalog';
import { deliveryTubeModel } from './deliveryTube';
import { syringeModel } from './syringe';
import { balanceModel } from './balance';
import { ProbeView } from './probes';
import { BottleView, dishModel } from './props';
import { XCard } from './xcard';
import { BATH_TOOL, BathView } from './bath';
import { porcelainDishModel, spoonModel, TongsView } from './burn';
import { BuretteView } from './buretteView';
import { ElectrolysisView, VoltmeterView } from './electroView';
import { glassMaterial } from './materials';

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
    let obj: THREE.Object3D;
    if (e.tool === 'delivery') {
      obj = deliveryTubeModel();
    } else if (e.tool === 'syringe') {
      obj = syringeModel();
    } else if (e.tool === 'balance') {
      obj = balanceModel();
    } else if (e.tool === 'xcard') {
      obj = new XCard().group;
    } else if (e.tool === 'ice_bath' || e.tool === 'warm_bath' || e.tool === 'hot_bath') {
      obj = new BathView(BATH_TOOL[e.tool]).group;
    } else if (e.tool === 'burette' || e.tool === 'burette_kmno4') {
      obj = new BuretteView(2, e.tool === 'burette' ? undefined : 0x8a1c7c).group;
    } else if (e.tool === 'voltmeter') {
      obj = new VoltmeterView(2, 0.75, 0).group;
    } else if (e.tool === 'dc_power') {
      obj = new ElectrolysisView(3, 1).group;
    } else if (e.tool === 'flame_wire') {
      obj = new TongsView({ key: 'pt_wire', id: 'Pt', label: 'Dây platinum', grams: 0.2, form: 'strip', shape: 'wire' }).group;
      obj.rotation.z = 0.5;
    } else if (e.tool === 'dish_burn') {
      obj = porcelainDishModel().group;
    } else if (e.tool === 'spoon_s') {
      obj = spoonModel().group;
      obj.rotation.z = -0.5;
    } else if (e.tool === 'no2_tube') {
      obj = gasTubeModel();
    } else if (e.tool) {
      const p = new ProbeView(e.tool);
      p.update(0.016);
      obj = p.group;
      if (e.tool === 'magnet') obj.rotation.set(0.5, 0.6, 0);
      else obj.rotation.z = e.tool === 'litmus' || e.tool === 'dye_paper' || e.tool === 'ph_moist' || e.tool === 'litmus_sol' || e.tool === 'ph_paper' ? -0.5 : -0.9;
    } else obj = e.solid ? dishModel(e.solid) : new BottleView(e.reagent!).group;
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

/** Ống nghiệm chứa khí nâu đỏ, đậy nút (ảnh thu nhỏ của "Khí NO₂") */
function gasTubeModel(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 9, 24, 1, true).translate(0, 4.5, 0), glassMaterial(0xffffff, 0.25));
  const gas = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 8.2, 24).translate(0, 4.3, 0),
    new THREE.MeshBasicMaterial({ color: 0xb4521c, transparent: true, opacity: 0.75 }),
  );
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMaterial(0xffffff, 0.25));
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.72, 1.2, 24).translate(0, 9.2, 0), new THREE.MeshStandardMaterial({ color: 0x6b3426, roughness: 0.85 }));
  g.add(gas, glass, bottom, stopper);
  g.rotation.z = -0.35;
  return g;
}
