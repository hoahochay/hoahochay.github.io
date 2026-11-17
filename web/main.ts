import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { indicatorDrops, litmusColor, litmusPH, litmusVerdict, makeSolution, RGB, testBurningSplint, testGlowingSplint } from '../src';
import { Animator, call, easeIn, tween } from './anim';
import { CHEMICALS, ChemEntry, ReagentDef, SolidItem, solidMol } from './catalog';
import { RecipePlayer } from './recipePlayer';
import { RECIPES } from './recipes';
import { ChemPanel } from './chemPanel';
import { LogEntry, PhenomenaTracker } from './events';
import { Hud } from './hud';
import { setRGB } from './materials';
import { DeliveryTubeView } from './deliveryTube';
import { blueFlame, popFlash, ProbeView, smokePuff, ToolKind } from './probes';
import { BottleView, heatingStand, LampView, solidPiece, tubeRack } from './props';
import { playPop } from './sound';
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
  onInvert: () => invert(),
});

function log(text: string, kind: LogEntry['kind'] = 'action', vessel = selected?.name ?? '') {
  hud.log({ t: simTime, vessel, text, kind });
}

function select(v: VesselView | null) {
  selected?.setSelected(false);
  selected = v;
  v?.setSelected(true);
  hud.setInverted(v?.vessel.inverted ?? false);
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

// ── Thử khí ở miệng dụng cụ ──────────────────────────────────────────────
const TOOL_NAME: Record<ToolKind, string> = {
  glowing: 'que đóm còn tàn đỏ',
  burning: 'que đóm đang cháy',
  litmus: 'giấy quỳ tím ẩm',
};

function probe(kind: ToolKind, view: VesselView) {
  const p = new ProbeView(kind);
  const isPaper = kind === 'litmus';
  const holdTime = isPaper ? 5 : 3;
  let above = new THREE.Vector3();
  let at = new THREE.Vector3();
  let paper: RGB = [0.56, 0.32, 0.62];
  let decided = false;
  let elapsed = 0;
  const fx: { obj: THREE.Object3D; life: number; age: number; update: (o: THREE.Object3D, t: number) => void }[] = [];
  const effect = (obj: THREE.Object3D, life: number, update: (o: THREE.Object3D, t: number) => void) => {
    obj.position.copy(view.mouthWorld());
    addTemp(obj);
    fx.push({ obj, life, age: 0, update });
  };

  const decide = () => {
    decided = true;
    const v = view.vessel;
    if (kind === 'glowing') {
      if (testGlowingSplint(v) === 'relight') {
        p.setFlame('bright');
        log('Que đóm bùng cháy trở lại → khí thoát ra là oxi (O₂)', 'phenomenon', view.name);
      } else log('Que đóm vẫn chỉ còn tàn đỏ, không bùng cháy → không giàu oxi', 'phenomenon', view.name);
      return;
    }
    switch (testBurningSplint(v)) {
      case 'pop':
        playPop();
        effect(popFlash(), 0.35, (o, t) => { o.scale.setScalar(1 + t * 5); (o as THREE.Sprite).material.opacity = 1 - t; });
        log('Có tiếng nổ nhỏ "bụp" → khí hiđro (H₂) lẫn không khí', 'phenomenon', view.name);
        break;
      case 'burns-at-mouth':
        effect(blueFlame(), holdTime, (o, t) => { o.scale.setScalar(Math.min(1, t * 8) * (1 - t * 0.5)); });
        log('Khí cháy ở miệng ống với ngọn lửa xanh nhạt → khí hiđro (H₂)', 'phenomenon', view.name);
        break;
      case 'brighter':
        p.setFlame('bright');
        log('Que đóm cháy sáng mạnh hơn → khí giàu oxi', 'phenomenon', view.name);
        break;
      case 'extinguished':
        p.setFlame('none');
        for (let i = 0; i < 3; i++) {
          effect(smokePuff(), 1.6 + i * 0.3, (o, t) => {
            o.position.y += 0.03;
            o.scale.setScalar(0.4 + t * 1.6);
            (o as THREE.Sprite).material.opacity = 0.45 * (1 - t);
          });
        }
        log('Que đóm tắt → khí không duy trì sự cháy (như CO₂)', 'phenomenon', view.name);
        break;
      default:
        log('Que đóm vẫn cháy bình thường, không có hiện tượng', 'phenomenon', view.name);
    }
  };

  animator.run(
    tween(0.3, (t) => p.group.scale.setScalar(t), {
      onStart: () => {
        const m = view.mouthWorld();
        if (view.vessel.inverted) {
          // Ống úp ngược: đưa dụng cụ thử từ phía dưới lên miệng ống
          if (!isPaper) p.holdFromBelow();
          at = m.clone().add(new THREE.Vector3(0, isPaper ? -0.8 : -0.35, 0));
          above = at.clone().add(new THREE.Vector3(0, -0.5, 6));
        } else {
          at = m.clone().add(new THREE.Vector3(0, isPaper ? -0.6 : -0.5, 0));
          above = at.clone().add(new THREE.Vector3(0, 4, 0));
        }
        p.group.position.copy(above);
        p.group.scale.setScalar(0.001);
        addTemp(p.group);
        log(`Đưa ${TOOL_NAME[kind]} vào miệng ống`, 'action', view.name);
      },
    }),
    tween(0.5, (t) => p.group.position.lerpVectors(above, at, t)),
    (dt) => {
      elapsed += dt;
      p.update(dt);
      if (isPaper) {
        const target = litmusColor(litmusPH(view.vessel));
        const k = Math.min(1, dt / 1.2);
        paper = paper.map((c, i) => c + (target[i] - c) * k) as RGB;
        p.setPaperColor(paper);
      } else if (!decided && elapsed > 0.35) decide();
      for (const f of fx) {
        f.age += dt;
        f.update(f.obj, Math.min(1, f.age / f.life));
        if (f.age >= f.life) removeTemp(f.obj);
      }
      if (elapsed < holdTime) return false;
      if (isPaper) {
        const verdict = litmusVerdict(litmusPH(view.vessel));
        log(verdict === 'base' ? 'Giấy quỳ ẩm chuyển màu xanh → khí có tính bazơ (như NH₃)'
          : verdict === 'acid' ? 'Giấy quỳ ẩm chuyển màu đỏ → khí có tính axit (như CO₂)'
            : 'Giấy quỳ ẩm không đổi màu', 'phenomenon', view.name);
      }
      for (const f of fx) removeTemp(f.obj);
      return true;
    },
    tween(0.4, (t) => {
      p.update(1 / 60);
      p.group.position.lerpVectors(at, above, t);
      p.group.scale.setScalar(Math.max(0.001, 1 - t));
    }),
    call(() => removeTemp(p.group)),
  );
}

// ── Ống dẫn khí ──────────────────────────────────────────────────────────
const tubes = new Map<VesselView, DeliveryTubeView>();
/** Đang chờ người dùng bấm vào dụng cụ nhận khí */
let connectFrom: VesselView | null = null;

function disconnect(v: VesselView, quiet = false) {
  for (const [src, t] of [...tubes]) {
    if (src !== v && t.dst !== v) continue;
    src.vessel.outlet = null;
    scene.remove(t.group);
    t.dispose();
    tubes.delete(src);
    if (!quiet) log(`Tháo ống dẫn khí sang ${t.dst.name.toLowerCase()}`, 'action', src.name);
  }
}

function connect(src: VesselView, dst: VesselView) {
  connectFrom = null;
  hud.hint(null);
  if (src === dst) return;
  if (dst.vessel.outlet || tubes.has(dst)) {
    log(`${dst.name} đang dẫn khí đi nơi khác, không nhận khí được.`, 'warning', dst.name);
    return;
  }
  disconnect(src, true);
  for (const [s, t] of tubes) if (t.dst === dst) disconnect(s);
  const t = new DeliveryTubeView(src, dst);
  tubes.set(src, t);
  scene.add(t.group);
  src.vessel.outlet = dst.vessel;
  const into = dst.vessel.inverted ? 'luồn vào miệng' : dst.vessel.mix.volumeL > 0 ? 'nhúng ngập trong dung dịch của' : 'đặt sát đáy';
  log(`Đậy nút, lắp ống dẫn khí ${into} ${dst.name.toLowerCase()}`, 'action', src.name);
}

function startConnect(view: VesselView) {
  if (tubes.has(view) || [...tubes.values()].some((t) => t.dst === view)) return disconnect(view);
  if (view.vessel.inverted) {
    log('Lắp ống dẫn vào ống phát khí (đang để ngửa).', 'warning', view.name);
    return;
  }
  select(view);
  connectFrom = view;
  hud.hint(`Bấm vào ống nghiệm hoặc cốc sẽ nhận khí từ ${view.name.toLowerCase()} (Esc để hủy)`);
}

// ── Úp ngược ống nghiệm (để thu khí nhẹ) ─────────────────────────────────
function restPose(v: VesselView): THREE.Vector3 {
  return v.vessel.inverted ? v.home.clone().add(new THREE.Vector3(0, v.kind.profile.height + 2.2, 0)) : v.home.clone();
}

function invert(v = requireSelected(), quiet = false) {
  if (!v) return;
  if (v.kind.type !== 'tube') return log('Chỉ úp ngược được ống nghiệm.', 'warning', v.name);
  if (!v.vessel.inverted && v.vessel.mix.volumeL > 5e-5) return log('Hãy đổ hết chất lỏng trước khi úp ngược ống.', 'warning', v.name);
  if (heatingView === v) return log('Không úp ống đang đun.', 'warning', v.name);
  if (v.vessel.outlet) return log('Ống đang được nút để phát khí, không úp được.', 'warning', v.name);
  const toInverted = !v.vessel.inverted;
  let from = new THREE.Vector3();
  let dest = new THREE.Vector3();
  animator.run(
    tween(0.9, (t) => {
      v.group.position.lerpVectors(from, dest, t);
      v.group.position.y += Math.sin(Math.PI * t) * 3;
      v.group.rotation.z = Math.PI * (toInverted ? t : 1 - t);
      tubes.forEach((tb) => tb.update());
    }, {
      onStart: () => {
        from = v.group.position.clone();
        v.vessel.inverted = toInverted;
        dest = restPose(v);
      },
    }),
    call(() => {
      if (!quiet) log(toInverted ? 'Úp ngược ống nghiệm (miệng hướng xuống)' : 'Lật ngửa ống nghiệm', 'action', v.name);
      hud.setInverted(selected?.vessel.inverted ?? false);
    }),
  );
}

function dropEntry(entry: ChemEntry, amount: number, view: VesselView) {
  if (entry.tool === 'delivery') return startConnect(view);
  if (entry.tool) {
    select(view);
    return probe(entry.tool, view);
  }
  if (view.vessel.inverted) {
    log('Ống đang úp ngược, hãy lật ngửa trước khi cho hóa chất vào.', 'warning', view.name);
    return;
  }
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
    moveVessel(v, () => restPose(v)),
    call(() => (v.heating = false)),
  );
}

function startHeat(v: VesselView) {
  if (heatingView === v) return;
  if (v.vessel.inverted) return log('Không đun ống đang úp ngược.', 'warning', v.name);
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
  if (v.vessel.inverted) return invert(v);
  if (heatingView === v) toggleHeat();
  disconnect(v);
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
  if (connectFrom) {
    if (o?.userData.kind === 'vessel' && o.userData.view !== connectFrom) return connect(connectFrom, o.userData.view);
    connectFrom = null;
    hud.hint(null);
    return;
  }
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
  if (e.key === 'Escape' && connectFrom) {
    connectFrom = null;
    hud.hint(null);
  }
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
  for (const v of views) disconnect(v, true);
  connectFrom = null;
  hud.hint(null);
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
  probe: (tool, vessel) => probe(tool, views[vessel]),
  connect: (src, dst) => (dst === null ? disconnect(views[src]) : connect(views[src], views[dst])),
  invert: (vessel) => invert(views[vessel]),
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
      for (const v of views) v.vessel.step(step);
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
  for (const t of tubes.values()) t.update();
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
