import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { indicatorDrops, makeSolution } from '../src';
import { Animator, call, easeIn, tween } from './anim';
import { CHEMICALS, ChemEntry, ReagentDef, SolidItem, solidMol } from './catalog';
import { RecipePlayer } from './recipePlayer';
import { RECIPES } from './recipes';
import { ChemPanel } from './chemPanel';
import { LogEntry, PhenomenaTracker } from './events';
import { Hud } from './hud';
import { setRGB } from './materials';
import { BottleView, heatingStand, LampView, solidPiece, tubeRack } from './props';
import './style.css';
import { renderThumbnails } from './thumbs';
import { BEAKER, TUBE, VesselView } from './VesselView';

// ── Renderer, cảnh, camera ───────────────────────────────────────────────
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe5ec);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 600);
const HOME_CAM = { pos: new THREE.Vector3(-2, 27, 46), target: new THREE.Vector3(-2, 7, 2) };
camera.position.copy(HOME_CAM.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_CAM.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
controls.maxDistance = 120;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a68, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(18, 45, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
scene.add(sun);

// ── Phòng thí nghiệm: bàn, giá ống nghiệm, cốc, đèn cồn ─────────────────
const bench = new THREE.Mesh(new THREE.BoxGeometry(96, 1.4, 36), new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.55 }));
bench.position.set(0, -0.7, -2);
bench.receiveShadow = true;
scene.add(bench);
const benchEdge = new THREE.Mesh(new THREE.BoxGeometry(96, 6, 1), new THREE.MeshStandardMaterial({ color: 0xcfd4d9, roughness: 0.7 }));
benchEdge.position.set(0, -4, 16);
scene.add(benchEdge);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.95 }));
wall.position.set(0, 30, -20);
wall.receiveShadow = true;
scene.add(wall);

const rack = tubeRack(4, 3.2);
rack.position.set(-2, 0, 5);
scene.add(rack);
const views: VesselView[] = [];
for (let i = 0; i < 4; i++) {
  const v = new VesselView(TUBE, `Ống nghiệm ${i + 1}`, `${i + 1}`);
  v.home.set(-2 + (i - 1.5) * 3.2, 0.72, 5);
  views.push(v);
}
const beaker = new VesselView(BEAKER, 'Cốc 100 mL', 'Cốc');
beaker.home.set(11, 0.12, 5);
views.push(beaker);
for (const v of views) {
  v.group.position.copy(v.home);
  scene.add(v.group);
}

const lamp = new LampView();
const LAMP_POS = new THREE.Vector3(-17, 0, 5);
lamp.group.position.copy(LAMP_POS);
scene.add(lamp.group);
const stand = heatingStand();
stand.group.position.copy(LAMP_POS);
scene.add(stand.group);

// ── Trạng thái tương tác ─────────────────────────────────────────────────
const animator = new Animator();
const tracker = new PhenomenaTracker();
let selected: VesselView | null = null;
let heatingView: VesselView | null = null;
let speed = 1;
let simTime = 0;
let simAcc = 0;

const hud = new Hud({
  onSpeed: (s) => (speed = s),
  onStir: () => stir(),
  onHeat: () => toggleHeat(),
  onEmpty: () => empty(),
  onFocus: () => toggleFocus(),
});

function log(text: string, kind: LogEntry['kind'] = 'action', vessel = selected?.name ?? '') {
  hud.log({ t: simTime, vessel, text, kind });
}

function select(v: VesselView | null) {
  selected?.setSelected(false);
  selected = v;
  v?.setSelected(true);
  if (focused && v) focusOn(v);
}

function requireSelected(): VesselView | null {
  if (!selected) log('Hãy chọn một ống nghiệm hoặc cốc trước.', 'warning', '');
  return selected;
}

// ── Rót dung dịch: lọ tạm xuất hiện trên miệng dụng cụ, nghiêng rót rồi biến mất ──
const stream = new THREE.Mesh(
  new THREE.CylinderGeometry(0.07, 0.05, 1, 10, 1, true).translate(0, -0.5, 0),
  new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.75, roughness: 0.1, depthWrite: false }),
);
stream.renderOrder = 2;
stream.visible = false;
scene.add(stream);
const drop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10).scale(1, 1.3, 1), stream.material);
drop.visible = false;
scene.add(drop);

/** Vật thể tạm của hoạt ảnh (lọ, mẫu rắn), để dọn khi hủy hoạt ảnh */
const temps = new Set<THREE.Object3D>();
const addTemp = (o: THREE.Object3D) => { scene.add(o); temps.add(o); };
const removeTemp = (o: THREE.Object3D) => { scene.remove(o); temps.delete(o); };

const pending = new Map<VesselView, number>();
const pendingML = (v: VesselView) => pending.get(v) ?? 0;
const addPending = (v: VesselView, mL: number) => pending.set(v, pendingML(v) + mL);
const fmt = (x: number) => String(+x.toFixed(2)).replace('.', ',');

function pour(def: ReagentDef, amount: number, view: VesselView) {
  const drops = def.indicator ? Math.max(1, Math.round(amount)) : 0;
  let mL = def.indicator ? drops * 0.05 : amount;
  const room = view.capacityML - view.vessel.mix.volumeL * 1000 - pendingML(view);
  if (room < 0.01) {
    log(`${view.name} đã đầy.`, 'warning', view.name);
    return;
  }
  if (mL > room) {
    mL = room;
    log(`Chỉ rót được ${fmt(mL)} mL, ${view.name} đã gần đầy.`, 'warning', view.name);
  }
  addPending(view, mL);

  const b = new BottleView(def);
  const L = b.mouthLocal.y;
  const isDrops = drops > 0 || mL < 0.1;
  const theta = isDrops ? -2.5 : -1.95;
  const scale = view.kind.type === 'tube' ? 0.8 : 1;
  const mouthNow = new THREE.Vector3();
  let target = new THREE.Vector3();
  let upright = new THREE.Vector3();
  const updateMouth = () => {
    b.group.updateMatrixWorld();
    mouthNow.copy(b.mouthLocal).applyMatrix4(b.group.matrixWorld);
  };
  // Số giọt hiển thị (tối đa 4 cho gọn)
  const shownDrops = isDrops ? Math.min(4, Math.max(1, drops || 1)) : 0;

  animator.run(
    tween(0.35, (t) => b.group.scale.setScalar(scale * t), {
      onStart: () => {
        const m = view.mouthWorld();
        target = new THREE.Vector3(m.x + L * scale * Math.sin(theta), m.y + 1.1 - L * scale * Math.cos(theta), m.z);
        upright = new THREE.Vector3(m.x - 3.5, m.y + 1, m.z);
        b.group.position.copy(upright);
        b.group.scale.setScalar(0.001);
        addTemp(b.group);
        setRGB(stream.material.color, def.color);
      },
    }),
    tween(0.55, (t) => {
      b.group.position.lerpVectors(upright, target, t);
      b.group.rotation.z = theta * t;
    }),
    ...(isDrops
      ? Array.from({ length: shownDrops }, () => tween(0.4, (t) => {
          updateMouth();
          const surf = view.surfaceWorld();
          drop.visible = t < 1;
          drop.position.set(mouthNow.x, THREE.MathUtils.lerp(mouthNow.y, surf.y, t), mouthNow.z);
        }, { ease: easeIn }))
      : [tween(Math.min(1.6, 0.6 + mL * 0.04), (t) => {
          updateMouth();
          const surf = view.surfaceWorld();
          stream.visible = t < 0.97;
          stream.position.copy(mouthNow);
          stream.scale.set(1, Math.max(0.1, mouthNow.y - surf.y), 1);
        }, { ease: (t) => t })]),
    call(() => {
      stream.visible = drop.visible = false;
      addPending(view, -mL);
      if (def.indicator) view.vessel.add(indicatorDrops(def.indicator, drops));
      else view.vessel.add(makeSolution(def.solutes, mL / 1000, view.vessel.roomK));
      const what = def.indicator
        ? `${drops} giọt ${def.formula.toLowerCase()}`
        : `${fmt(mL)} mL ${def.formula}${def.key === 'water' ? '' : ' ' + def.conc}`;
      log(`Rót ${what}`, 'action', view.name);
    }),
    tween(0.45, (t) => {
      b.group.rotation.z = theta * (1 - t);
      b.group.position.lerpVectors(target, upright, t);
      b.group.scale.setScalar(scale * (1 - t * 0.999));
    }),
    call(() => removeTemp(b.group)),
  );
}

// ── Thả chất rắn ─────────────────────────────────────────────────────────
function dropSolid(item: SolidItem, grams: number, view: VesselView) {
  const piece = solidPiece(item);
  const s = (view.kind.type === 'tube' ? 0.32 : 0.7) * THREE.MathUtils.clamp(Math.cbrt(grams / item.grams), 0.5, 1.6);
  let above = new THREE.Vector3();
  animator.run(
    tween(0.35, (t) => piece.scale.setScalar(s * t), {
      onStart: () => {
        above = view.mouthWorld().add(new THREE.Vector3(0, 2, 0));
        piece.position.copy(above);
        piece.scale.setScalar(0.001);
        addTemp(piece);
      },
    }),
    tween(0.45, (t) => {
      const bottom = view.group.localToWorld(new THREE.Vector3(0, 0.3, 0));
      piece.position.y = THREE.MathUtils.lerp(above.y, bottom.y, t);
    }, { ease: easeIn }),
    call(() => {
      removeTemp(piece);
      view.vessel.addSolid(item.id, solidMol(item, grams), item.form);
      view.addSolidVisual(item, grams);
      log(`Cho ${fmt(grams)} g ${item.label.toLowerCase()} vào`, 'action', view.name);
    }),
  );
}

function dropEntry(entry: ChemEntry, amount: number, view: VesselView) {
  if (!(amount > 0)) {
    log('Lượng phải lớn hơn 0.', 'warning', view.name);
    return;
  }
  select(view);
  if (entry.solid) dropSolid(entry.solid, amount, view);
  else pour(entry.reagent!, amount, view);
}

// ── Đun, khuấy, đổ bỏ ────────────────────────────────────────────────────
function heatPose(v: VesselView): THREE.Vector3 {
  return LAMP_POS.clone().add(new THREE.Vector3(0, v.kind.type === 'tube' ? 5.6 : 7.5, 0));
}

function moveVessel(v: VesselView, to: () => THREE.Vector3, dur = 0.9) {
  let from = new THREE.Vector3();
  let dest = new THREE.Vector3();
  return tween(dur, (t) => {
    v.group.position.lerpVectors(from, dest, t);
    v.group.position.y += Math.sin(Math.PI * t) * 6;
  }, { onStart: () => { from = v.group.position.clone(); dest = to(); } });
}

function stopHeat() {
  const v = heatingView;
  if (!v) return;
  heatingView = null;
  v.vessel.heaterW = 0;
  lamp.setLit(false);
  hud.setHeating(false);
  log('Tắt đèn cồn', 'action', v.name);
  animator.run(
    call(() => (stand.clamp.visible = stand.tripod.visible = false)),
    moveVessel(v, () => v.home),
    call(() => (v.heating = false)),
  );
}

function startHeat(v: VesselView) {
  if (heatingView === v) return;
  if (heatingView) stopHeat();
  heatingView = v;
  v.heating = true;
  hud.setHeating(true);
  animator.run(
    moveVessel(v, () => heatPose(v)),
    call(() => {
      if (v.kind.type === 'tube') stand.clamp.visible = true;
      else stand.tripod.visible = true;
      lamp.setLit(true);
      v.vessel.heaterW = v.kind.type === 'tube' ? 35 : 60;
      log('Đun bằng đèn cồn', 'action', v.name);
    }),
  );
}

function toggleHeat() {
  if (heatingView) return stopHeat();
  const v = requireSelected();
  if (v) startHeat(v);
}

function stir(v = requireSelected()) {
  if (!v) return;
  const base = v.group.rotation.z;
  animator.run(
    tween(0.8, (t) => (v.group.rotation.z = base + Math.sin(t * Math.PI * 6) * 0.12 * (1 - t))),
    call(() => {
      v.group.rotation.z = base;
      v.vessel.stir();
      log('Lắc / khuấy đều', 'action', v.name);
    }),
  );
}

function empty() {
  const v = requireSelected();
  if (!v) return;
  if (heatingView === v) toggleHeat();
  animator.run(
    tween(0.5, (t) => (v.group.rotation.z = -1.9 * t)),
    call(() => {
      v.reset();
      tracker.reset(v);
      log('Đổ bỏ, tráng sạch', 'action', v.name);
    }),
    tween(0.5, (t) => (v.group.rotation.z = -1.9 * (1 - t))),
  );
}

// ── Camera: nhìn gần dụng cụ đang chọn ───────────────────────────────────
let focused = false;
let camAnim: { t: number; fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3 } | null = null;

function camTo(pos: THREE.Vector3, target: THREE.Vector3) {
  camAnim = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos, toT: target };
}

function focusOn(v: VesselView) {
  const c = v.group.position.clone().add(new THREE.Vector3(0, v.kind.profile.height * 0.45, 0));
  const dist = v.kind.type === 'tube' ? 17 : 22;
  camTo(c.clone().add(new THREE.Vector3(0, dist * 0.3, dist)), c);
}

/** Nhìn gần một nhóm dụng cụ (null: về góc nhìn toàn cảnh) */
function focusMany(vs: VesselView[] | null) {
  if (!vs || !vs.length) {
    focused = false;
    camTo(HOME_CAM.pos.clone(), HOME_CAM.target.clone());
    return;
  }
  if (vs.length === 1) {
    focused = true;
    return focusOn(vs[0]);
  }
  focused = false;
  const box = new THREE.Box3();
  for (const v of vs) box.expandByPoint(v.home).expandByPoint(v.home.clone().add(new THREE.Vector3(0, v.kind.profile.height, 0)));
  const c = box.getCenter(new THREE.Vector3());
  const dist = 16 + box.getSize(new THREE.Vector3()).x * 1.2;
  camTo(c.clone().add(new THREE.Vector3(0, dist * 0.3, dist)), c);
}

function toggleFocus() {
  if (focused) {
    focused = false;
    camTo(HOME_CAM.pos.clone(), HOME_CAM.target.clone());
  } else {
    const v = requireSelected();
    if (!v) return;
    focused = true;
    focusOn(v);
  }
}

// ── Chuột: bấm chọn dụng cụ / bấm đèn cồn ────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables: THREE.Object3D[] = [...views.map((v) => v.group), lamp.group];

function pickAt(x: number, y: number, objects = pickables): THREE.Object3D | null {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObjects(objects, true)) {
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.kind) o = o.parent;
    if (o) return o;
  }
  return null;
}

let downAt: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  const o = pickAt(e.clientX, e.clientY);
  if (o?.userData.kind === 'vessel') select(o.userData.view);
  else if (o?.userData.kind === 'lamp') toggleHeat();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return hud.tooltip(null);
  const o = pickAt(e.clientX, e.clientY);
  renderer.domElement.style.cursor = o ? 'pointer' : 'default';
  if (!o) return hud.tooltip(null);
  const u = o.userData;
  const text = u.kind === 'vessel'
    ? `<b>${u.view.name}</b><br>${(u.view.vessel.mix.volumeL * 1000).toFixed(1)} mL`
    : `<b>Đèn cồn</b><br><i>${heatingView ? 'Bấm để tắt' : 'Bấm để đun dụng cụ đang chọn'}</i>`;
  hud.tooltip(text, e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerleave', () => hud.tooltip(null));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const n = Number(e.key);
  if (n >= 1 && n <= views.length) select(views[n - 1]);
  if (e.key === ' ') {
    speed = speed === 0 ? 1 : 0;
    hud.setSpeed(speed);
    e.preventDefault();
  }
});

// ── Kho hóa chất (kéo-thả) ───────────────────────────────────────────────
const vesselGroups = views.map((v) => v.group);
let hoverView: VesselView | null = null;
new ChemPanel(document.getElementById('chem')!, CHEMICALS, renderThumbnails(CHEMICALS), {
  hitTest: (x, y) => {
    const o = pickAt(x, y, vesselGroups);
    return o ? (o.userData.view as VesselView) : null;
  },
  hover: (t) => {
    hoverView?.setHover(false);
    hoverView = t as VesselView | null;
    hoverView?.setHover(true);
  },
  drop: (entry, amount, t) => dropEntry(entry, amount, t as VesselView),
});

// ── Thí nghiệm mẫu ───────────────────────────────────────────────────────
/** Đưa mọi dụng cụ về trạng thái sạch, hủy hoạt ảnh đang dở */
function resetAll() {
  animator.clear();
  for (const o of [...temps]) removeTemp(o);
  stream.visible = drop.visible = false;
  pending.clear();
  heatingView = null;
  lamp.setLit(false);
  hud.setHeating(false);
  stand.clamp.visible = stand.tripod.visible = false;
  for (const v of views) {
    v.reset();
    v.heating = false;
    v.group.position.copy(v.home);
    v.group.rotation.set(0, 0, 0);
    tracker.reset(v);
  }
  hud.clearLog();
}

const player = new RecipePlayer({
  add: (chem, amount, vessel) => dropEntry(CHEMICALS.find((c) => c.key === chem)!, amount, views[vessel]),
  setHeat: (vessel, on) => (on ? startHeat(views[vessel]) : heatingView === views[vessel] && stopHeat()),
  stir: (vessel) => stir(views[vessel]),
  focus: (vs) => focusMany(vs ? vs.map((i) => views[i]) : null),
  resetAll,
  setSpeed: (s) => { speed = s; hud.setSpeed(s); },
  simTime: () => simTime,
  busy: () => animator.busy,
  state: {
    mix: (i) => views[i].vessel.mix,
    tempC: (i) => views[i].vessel.mix.tempK - 273.15,
  },
  vesselName: (i) => views[i].name,
  chemLabel: (key, amount) => {
    const c = CHEMICALS.find((x) => x.key === key)!;
    return `${fmt(amount)} ${c.unit} ${c.formula}${c.kind === 'solution' && c.key !== 'water' ? ' ' + c.sub : ''}`;
  },
}, document.getElementById('recipes')!);

// Tab bên trái: kho hóa chất / thí nghiệm mẫu
const left = document.getElementById('left')!;
left.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => {
  b.onclick = () => {
    left.classList.remove('collapsed');
    left.querySelectorAll('.tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    left.querySelectorAll<HTMLElement>('.pane').forEach((p) => p.classList.toggle('hidden', p.id !== b.dataset.tab));
  };
});
const collapseBtn = left.querySelector<HTMLButtonElement>('.collapse')!;
collapseBtn.onclick = () => {
  const c = left.classList.toggle('collapsed');
  collapseBtn.textContent = c ? '›' : '‹';
};

// ── Vòng lặp chính ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
let realTime = 0;

function frame() {
  const dt = Math.min(0.1, clock.getDelta());
  realTime += dt;
  animator.update(dt);
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / 0.8);
    const k = camAnim.t < 0.5 ? 2 * camAnim.t ** 2 : 1 - (-2 * camAnim.t + 2) ** 2 / 2;
    camera.position.lerpVectors(camAnim.fromP, camAnim.toP, k);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, k);
    if (camAnim.t >= 1) camAnim = null;
  }

  // Mô phỏng hóa học: bước cố định, lớn hơn khi tua nhanh
  if (speed > 0) {
    const step = Math.min(0.05 * speed, 0.5);
    simAcc += dt * speed;
    let n = 0;
    while (simAcc >= step && n < 60) {
      for (const v of views) if (v.vessel.mix.moles.size > 0) v.vessel.step(step);
      simAcc -= step;
      simTime += step;
      n++;
    }
    if (n >= 60) simAcc = 0;
  }

  let selObs = null;
  for (const v of views) {
    const o = v.vessel.observe();
    v.update(o, dt, speed);
    for (const e of tracker.check(v, o)) hud.log({ ...e, t: simTime });
    if (v === selected) selObs = o;
  }
  hud.panel(selected, selObs, realTime);
  hud.setTime(simTime);
  lamp.update(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

select(views[0]);
frame();

// API cho bảng điều khiển trình duyệt / kiểm thử
Object.assign(window, {
  __lab: {
    views,
    select: (i: number) => select(views[i]),
    add: (key: string, amount: number, vessel = 0) =>
      dropEntry(CHEMICALS.find((c) => c.key === key)!, amount, views[vessel]),
    heat: () => toggleHeat(),
    player,
    recipes: RECIPES,
    setSpeed: (s: number) => { speed = s; hud.setSpeed(s); },
    busy: () => animator.busy,
  },
});
