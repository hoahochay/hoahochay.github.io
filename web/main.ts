import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { indicatorDrops, litmusColor, litmusPH, litmusVerdict, makeSolution, RGB, testBurningSplint, testMagnet, testGlowingSplint } from '../src';
import { Animator, call, easeIn, tween } from './anim';
import { CHEMICALS, ChemEntry, ReagentDef, SolidItem, solidMol } from './catalog';
import { RecipePlayer } from './recipePlayer';
import { RECIPES, SYRINGE } from './recipes';
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
import { PeriodicTable } from './periodic/PeriodicTable';
import { BEAKER, FLASK, TUBE, VesselView } from './VesselView';
import { SyringeView } from './syringe';
import { MeasurePanel } from './measurePanel';
import { BalanceView } from './balance';
import { HelpOverlay } from './help';
import { parseHash, Route, setRoute } from './router';

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
/**
 * Màn hình hẹp (điện thoại dựng đứng) có góc nhìn ngang rất nhỏ: lùi camera ra xa
 * để vẫn thấy đủ bề ngang như trên màn hình rộng.
 */
function fitPos(pos: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
  const k = Math.max(1, (1.25 / camera.aspect) ** 0.8);
  return target.clone().add(pos.clone().sub(target).multiplyScalar(k));
}
camera.position.copy(HOME_CAM.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_CAM.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
// Màn hình cảm ứng: một ngón vuốt để di chuyển, hai ngón để phóng to và xoay
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
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
const flask = new VesselView(FLASK, 'Bình nón 100 mL', 'Bình');
flask.home.set(19.5, 0.12, 5);
views.push(flask);
for (const v of views) {
  v.group.position.copy(v.home);
  scene.add(v.group);
}

// Xi lanh đo khí kẹp ngang trên giá, phía sau và cao hơn miệng các dụng cụ phía trước
const syringeView = new SyringeView();
syringeView.group.position.set(17, syringeView.heightAboveBench(), -9);
scene.add(syringeView.group);

// Cân điện tử ở góc trước bên trái bàn
const balanceView = new BalanceView();
balanceView.group.position.set(-11.5, 0, 11.5);
scene.add(balanceView.group);
/** Dụng cụ đang nằm trên đĩa cân */
let onBalance: VesselView | null = null;
let tareG = 0;
/** Số đọc của cân (đã trừ bì), làm tròn 0,01 g như cân thật */
const balanceReading = () => Math.round(((onBalance ? onBalance.vessel.massG() : 0) - tareG) * 100) / 100 + 0;
const fmtG = (g: number) => g.toFixed(2).replace('.', ',');

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
  magnet: 'nam châm',
};

/** Đưa nam châm lại gần đáy dụng cụ: sắt tự do (bột sắt, đinh sắt) bị hút; FeS thì không */
function magnetTest(view: VesselView) {
  const p = new ProbeView('magnet');
  const attracted = testMagnet(view.vessel) === 'attracted';
  let far = new THREE.Vector3(), near = new THREE.Vector3();
  let base = new THREE.Vector3();
  const hot = view.vessel.mix.tempK - 273.15 > 60;
  animator.run(
    tween(0.3, (t) => p.group.scale.setScalar(Math.max(0.001, 1.4 * t)), {
      onStart: () => {
        base = view.group.position.clone();
        const r = view.kind.profile.radius(0.5);
        // Đặt ngay trước giá ống nghiệm, ngang lớp chất rắn dưới đáy
        near = base.clone().add(new THREE.Vector3(0, 0.9, r + 1.6));
        far = near.clone().add(new THREE.Vector3(0, 0.6, 4.5));
        p.group.position.copy(far);
        addTemp(p.group);
        log('Đưa nam châm lại gần đáy ống', 'action', view.name);
        if (hot) log('Ống còn nóng: nên để nguội rồi mới thử bằng nam châm.', 'warning', view.name);
      },
    }),
    tween(0.7, (t) => p.group.position.lerpVectors(far, near, t)),
    // Bị hút: ống (và bột sắt bên trong) bị kéo lệch về phía nam châm
    tween(0.5, (t) => {
      if (!attracted) return;
      view.group.position.copy(base).add(new THREE.Vector3(0, 0, 0.3 * Math.sin(t * Math.PI / 2)));
      view.group.rotation.x = 0.06 * Math.sin(t * Math.PI / 2);
    }, {
      onStart: () => log(attracted
        ? 'Hỗn hợp bị nam châm hút → trong ống còn sắt (Fe) chưa phản ứng'
        : 'Chất rắn trong ống không bị nam châm hút → không còn sắt tự do, đã tạo thành chất mới', 'phenomenon', view.name),
    }),
    tween(1.2, () => {}),
    tween(0.5, (t) => {
      p.group.position.lerpVectors(near, far, t);
      p.group.scale.setScalar(Math.max(0.001, 1.4 * (1 - t)));
      if (attracted) {
        view.group.position.copy(base).add(new THREE.Vector3(0, 0, 0.3 * (1 - t)));
        view.group.rotation.x = 0.06 * (1 - t);
      }
    }),
    call(() => {
      view.group.position.copy(base);
      view.group.rotation.x = 0;
      removeTemp(p.group);
    }),
  );
}

function probe(kind: ToolKind, view: VesselView) {
  if (kind === 'magnet') return magnetTest(view);
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
        log('Que đóm bùng cháy trở lại → khí thoát ra là oxygen (O₂)', 'phenomenon', view.name);
      } else log('Que đóm vẫn chỉ còn tàn đỏ, không bùng cháy → không giàu oxygen', 'phenomenon', view.name);
      return;
    }
    switch (testBurningSplint(v)) {
      case 'pop':
        playPop();
        effect(popFlash(), 0.35, (o, t) => { o.scale.setScalar(1 + t * 5); (o as THREE.Sprite).material.opacity = 1 - t; });
        log('Có tiếng nổ nhỏ "bụp" → khí hydrogen (H₂) lẫn không khí', 'phenomenon', view.name);
        break;
      case 'burns-at-mouth':
        effect(blueFlame(), holdTime, (o, t) => { o.scale.setScalar(Math.min(1, t * 8) * (1 - t * 0.5)); });
        log('Khí cháy ở miệng ống với ngọn lửa xanh nhạt → khí hydrogen (H₂)', 'phenomenon', view.name);
        break;
      case 'brighter':
        p.setFlame('bright');
        log('Que đóm cháy sáng mạnh hơn → khí giàu oxygen', 'phenomenon', view.name);
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
        log(verdict === 'base' ? 'Giấy quỳ ẩm chuyển màu xanh → khí có tính base (như NH₃)'
          : verdict === 'acid' ? 'Giấy quỳ ẩm chuyển màu đỏ → khí có tính acid (như CO₂)'
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
const syringePanel = new MeasurePanel({
  title: 'Xi lanh đo khí', quantity: 'Thể tích', symbol: 'V', unit: 'mL', decimals: 1,
  minSpan: 10, fromZero: true, jump: 0.5, csvName: 'xi-lanh-do-khi.csv',
  resetLabel: '↺ Đo lại từ 0', resetTitle: 'Đẩy pít-tông về vạch 0 và bắt đầu đo lại',
  reset: () => {
    syringeView.reset();
    const src = [...tubes].find(([, t]) => t.dst === syringeView)?.[0];
    syringePanel.start(simTime, 0, src ? `nối với ${src.name.toLowerCase()}` : '');
    log('Đẩy pít-tông về vạch 0, đo lại từ đầu', 'action', syringeView.name);
  },
});

const balancePanel = new MeasurePanel({
  title: 'Cân điện tử', quantity: 'Khối lượng', symbol: 'm', unit: 'g', decimals: 2,
  minSpan: 0.2, fromZero: false, jump: 0.02, csvName: 'can-dien-tu.csv',
  resetLabel: '⚖ Trừ bì', resetTitle: 'Đưa số đọc về 0,00 g với vật đang đặt trên cân',
  extra: { label: '⬇ Lấy xuống', title: 'Lấy dụng cụ khỏi cân', onClick: () => takeOffBalance() },
  reset: () => tare(),
});

function balanceNote(): string {
  return onBalance ? `đang cân ${onBalance.name.toLowerCase()}` : 'đĩa cân trống';
}

/** Đặt dụng cụ lên đĩa cân (bấm lần nữa để lấy xuống) */
function placeOnBalance(v: VesselView, toggle = true) {
  if (onBalance === v) return toggle ? takeOffBalance() : undefined;
  if (heatingView === v) return log('Tắt đèn cồn và lấy dụng cụ khỏi giá đun trước khi cân.', 'warning', v.name);
  if (v.vessel.inverted) return log('Lật ngửa ống trước khi đặt lên cân.', 'warning', v.name);
  if (onBalance) takeOffBalance(true);
  onBalance = v;
  select(v);
  animator.run(
    moveVessel(v, () => restPose(v)),
    call(() => {
      balancePanel.start(simTime, balanceReading(), balanceNote());
      log(`Đặt lên cân điện tử: ${fmtG(balanceReading())} g`, 'action', v.name);
    }),
  );
}

function takeOffBalance(quiet = false) {
  const v = onBalance;
  if (!v) return;
  onBalance = null;
  animator.run(moveVessel(v, () => restPose(v)));
  balancePanel.start(simTime, balanceReading(), balanceNote());
  if (!quiet) log('Lấy khỏi cân điện tử', 'action', v.name);
}

function tare() {
  tareG += balanceReading();
  balancePanel.start(simTime, 0, balanceNote());
  log('Bấm trừ bì: cân trở về 0,00 g', 'action', balanceView.name);
}
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

function connect(src: VesselView, dst: VesselView | SyringeView) {
  connectFrom = null;
  hud.hint(null);
  if (src === dst) return;
  if (dst instanceof SyringeView) return connectSyringe(src);
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

/** Nối dụng cụ phát khí với xi lanh đo khí; bắt đầu đo từ vạch 0 */
function connectSyringe(src: VesselView) {
  connectFrom = null;
  hud.hint(null);
  if (src.vessel.inverted) return log('Lật ngửa ống trước khi nối với xi lanh.', 'warning', src.name);
  if (tubes.get(src)?.dst === syringeView) return;
  for (const [s, t] of tubes) if (t.dst === syringeView) disconnect(s);
  disconnect(src, true);
  const t = new DeliveryTubeView(src, syringeView);
  tubes.set(src, t);
  scene.add(t.group);
  syringeView.reset();
  src.vessel.outlet = syringeView.syringe;
  syringePanel.start(simTime, 0, `nối với ${src.name.toLowerCase()}`);
  log('Đậy nút, nối ống dẫn khí vào xi lanh đo khí (pít-tông ở vạch 0)', 'action', src.name);
}

function startConnect(view: VesselView) {
  if (tubes.has(view) || [...tubes.values()].some((t) => t.dst === view)) return disconnect(view);
  if (view.vessel.inverted) {
    log('Lắp ống dẫn vào ống phát khí (đang để ngửa).', 'warning', view.name);
    return;
  }
  select(view);
  connectFrom = view;
  hud.hint(`Bấm vào ống nghiệm, cốc hoặc xi lanh đo khí sẽ nhận khí từ ${view.name.toLowerCase()} (Esc để hủy)`);
}

// ── Úp ngược ống nghiệm (để thu khí nhẹ) ─────────────────────────────────
function restPose(v: VesselView): THREE.Vector3 {
  if (onBalance === v) return balanceView.panTopWorld().add(new THREE.Vector3(0, v.kind.type === 'tube' ? 0.15 : 0.12, 0));
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
  if (entry.tool === 'syringe') return connectSyringe(view);
  if (entry.tool === 'balance') return placeOnBalance(view);
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
  if (onBalance === v) return log('Lấy dụng cụ khỏi cân trước khi đun.', 'warning', v.name);
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

/** Phần màn hình không bị các bảng giao diện che (px) */
function safeRect(): { l: number; r: number; t: number; b: number } {
  const W = window.innerWidth, H = window.innerHeight;
  let l = 8, r = W - 8, t = 8, b = H - 8;
  const box = (id: string) => {
    const el = document.getElementById(id);
    if (!el || getComputedStyle(el).display === 'none') return null;
    const rc = el.getBoundingClientRect();
    return rc.width > 0 && rc.height > 0 ? rc : null;
  };
  const nav = box('mainnav');
  if (nav) t = Math.max(t, nav.bottom + 8);
  const tb = box('toolbar');
  if (tb) b = Math.min(b, tb.top - 8);
  if (!window.matchMedia('(max-width: 700px)').matches) {
    const left = box('left');
    if (left) l = Math.max(l, left.right + 8);
    const panel = box('panel');
    if (panel) r = Math.min(r, panel.left - 8);
  }
  // Màn hình quá chật thì bỏ qua các bảng hai bên (chúng trong suốt một phần)
  if (r - l < W * 0.35) { l = 8; r = W - 8; }
  if (b - t < H * 0.3) { t = 8; b = H - 8; }
  return { l, r, t, b };
}

/**
 * Góc nhìn toàn cảnh: giữ hướng nhìn mặc định, chọn điểm nhìn và khoảng cách sao cho mọi đồ vật
 * trên bàn (dụng cụ, giá, đèn cồn, cân, xi lanh) nằm trọn trong phần màn hình không bị bảng che.
 */
function homeView(): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const pts: THREE.Vector3[] = [];
  const objs: THREE.Object3D[] = [...views.map((v) => v.group), rack, lamp.group, stand.group, syringeView.group, balanceView.group];
  for (const o of objs) {
    const bx = new THREE.Box3().setFromObject(o);
    if (bx.isEmpty()) continue;
    for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) pts.push(new THREE.Vector3(x, y, z));
  }
  const dir = HOME_CAM.pos.clone().sub(HOME_CAM.target).normalize();
  const target = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  const W = window.innerWidth, H = window.innerHeight;
  const safe = safeRect();
  const cam = new THREE.PerspectiveCamera(camera.fov, W / H, 0.5, 600);
  let d = HOME_CAM.pos.distanceTo(HOME_CAM.target);
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const n = p.clone().project(cam);
      const px = (n.x + 1) / 2 * W, py = (1 - n.y) / 2 * H;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    // Dời điểm nhìn để khối đồ vật nằm giữa vùng an toàn, rồi lùi / tiến cho vừa khít
    cam.matrixWorld.extractBasis(right, up, fwd);
    const wpp = (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / H;
    target.addScaledVector(right, ((x0 + x1) / 2 - (safe.l + safe.r) / 2) * wpp);
    target.addScaledVector(up, -((y0 + y1) / 2 - (safe.t + safe.b) / 2) * wpp);
    const scale = Math.max((x1 - x0) / (safe.r - safe.l), (y1 - y0) / (safe.b - safe.t));
    d *= 0.5 + 0.5 * scale * 1.04;
  }
  return { pos: target.clone().addScaledVector(dir, d), target };
}

function goHome() {
  focused = false;
  const h = homeView();
  camTo(h.pos, h.target);
}

/**
 * Thí nghiệm mẫu không bao giờ đổi mức zoom hay góc xoay của người dùng. Chỉ khi dụng cụ đang dùng
 * nằm ngoài phần màn hình nhìn thấy (vd. người dùng đã phóng to chỗ khác) thì dời điểm nhìn sang đó.
 */
function panTo(vs: VesselView[] | null) {
  if (!vs || !vs.length) return;
  const pts: THREE.Vector3[] = [];
  for (const v of vs) {
    const p = v.group.position;
    pts.push(p.clone(), p.clone().add(new THREE.Vector3(0, v.kind.profile.height, 0)));
  }
  const safe = safeRect();
  const W = window.innerWidth, H = window.innerHeight;
  const inView = pts.every((p) => {
    const n = p.clone().project(camera);
    const x = (n.x + 1) / 2 * W, y = (1 - n.y) / 2 * H;
    return n.z < 1 && x >= safe.l && x <= safe.r && y >= safe.t && y <= safe.b;
  });
  if (inView) return;
  const c = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  const offset = camera.position.clone().sub(controls.target);
  camTo(c.clone().add(offset), c);
}

/**
 * Đặt camera nhìn vào điểm `c` từ khoảng cách `dist`. Hạ điểm nhìn xuống một chút để dụng cụ nằm
 * ở nửa trên màn hình, không bị khung thuyết minh của thí nghiệm mẫu ở phía dưới che.
 */
function lookAt(c: THREE.Vector3, dist: number) {
  const target = c.clone().add(new THREE.Vector3(0, -dist * 0.14, 0));
  camTo(fitPos(target.clone().add(new THREE.Vector3(0, dist * 0.32, dist)), target), target);
}

function focusOn(v: VesselView) {
  const c = v.group.position.clone().add(new THREE.Vector3(0, v.kind.profile.height * 0.45, 0));
  lookAt(c, v.kind.type === 'tube' ? 25 : 31);
}

function toggleFocus() {
  if (focused) {
    goHome();
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
const pickables: THREE.Object3D[] = [...views.map((v) => v.group), lamp.group, syringeView.group, balanceView.group];

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
  const armed = chemPanel.armed;
  if (armed) {
    chemPanel.arm(null);
    if (o?.userData.kind === 'vessel') dropEntry(armed.entry, armed.amount, o.userData.view);
    return;
  }
  if (connectFrom) {
    if (o?.userData.kind === 'vessel' && o.userData.view !== connectFrom) return connect(connectFrom, o.userData.view);
    if (o?.userData.kind === 'syringe') return connectSyringe(connectFrom);
    connectFrom = null;
    hud.hint(null);
    return;
  }
  if (o?.userData.kind === 'vessel') select(o.userData.view);
  else if (o?.userData.kind === 'lamp') toggleHeat();
  else if (o?.userData.kind === 'syringe' && !syringePanel.visible && syringeView.syringe.volumeML > 0) syringePanel.show(true);
  else if (o?.userData.kind === 'balance') {
    if (selected && selected !== onBalance) placeOnBalance(selected);
    else if (!balancePanel.visible) balancePanel.start(simTime, balanceReading(), balanceNote());
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return hud.tooltip(null);
  const o = pickAt(e.clientX, e.clientY);
  renderer.domElement.style.cursor = o ? 'pointer' : 'default';
  if (!o) return hud.tooltip(null);
  const u = o.userData;
  const text = u.kind === 'vessel'
    ? `<b>${u.view.name}</b><br>${(u.view.vessel.mix.volumeL * 1000).toFixed(1)} mL`
    : u.kind === 'balance'
    ? `<b>Cân điện tử</b><br>${fmtG(balanceReading())} g<br><i>${selected && selected !== onBalance ? `Bấm để đặt ${selected.name.toLowerCase()} lên cân` : onBalance ? `Đang cân ${onBalance.name.toLowerCase()}` : 'Chọn một dụng cụ rồi bấm vào cân'}</i>`
    : u.kind === 'syringe'
    ? `<b>Xi lanh đo khí</b><br>${syringeView.syringe.volumeML.toFixed(1)} / 100 mL<br><i>${[...tubes.values()].some((t) => t.dst === syringeView) ? 'Đang đo' : 'Kéo "Xi lanh đo khí" trong kho thả vào dụng cụ phát khí'}</i>`
    : `<b>Đèn cồn</b><br><i>${heatingView ? 'Bấm để tắt' : 'Bấm để đun dụng cụ đang chọn'}</i>`;
  hud.tooltip(text, e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerleave', () => hud.tooltip(null));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Bàn phím: di chuyển góc nhìn bằng W A S D / phím mũi tên ─────────────
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const held = new Set<string>();
const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

function moveCamera(dt: number) {
  if (!held.size || view !== 'lab' || help.isOpen) return;
  let fx = 0, sx = 0;
  for (const k of held) {
    const m = MOVE_KEYS[k];
    if (m) { sx += m[0]; fx += m[1]; }
  }
  if (!fx && !sx) return;
  const fwd = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const d = fwd.multiplyScalar(fx).add(right.multiplyScalar(sx)).normalize();
  // Đi nhanh hơn khi đứng xa
  d.multiplyScalar(dt * THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.7, 10, 50));
  const t = controls.target.clone().add(d);
  t.x = THREE.MathUtils.clamp(t.x, -40, 40);
  t.z = THREE.MathUtils.clamp(t.z, -18, 24);
  d.subVectors(t, controls.target);
  camera.position.add(d);
  controls.target.add(d);
  camAnim = null;
  focused = false;
}

window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (e.code === 'KeyH' || e.key === '?' || e.key === 'F1') {
    help.toggle();
    e.preventDefault();
    return;
  }
  if (help.isOpen) {
    if (e.key === 'Escape') help.close();
    return;
  }
  if (view !== 'lab' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (MOVE_KEYS[e.code]) {
    held.add(e.code);
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyR') {
    goHome();
    return;
  }
  if (e.key === 'Escape' && chemPanel.armed) chemPanel.arm(null);
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
const chemPanel = new ChemPanel(document.getElementById('chem')!, CHEMICALS, renderThumbnails(CHEMICALS), {
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
  armChanged: (entry, amount) => {
    if (entry) revealScene();
    hud.hint(entry
    ? `Bấm vào dụng cụ để ${entry.kind === 'tool' ? `dùng ${entry.title.toLowerCase()}` : `cho ${fmt(amount)} ${entry.unit} ${entry.formula} vào`} (bấm chỗ trống hoặc Esc để hủy)`
    : null);
  },
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
  syringeView.reset();
  syringePanel.show(false);
  onBalance = null;
  tareG = 0;
  balancePanel.show(false);
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
  connect: (src, dst) => (dst === null ? disconnect(views[src]) : connect(views[src], dst === SYRINGE ? syringeView : views[dst])),
  invert: (vessel) => invert(views[vessel]),
  weigh: (vessel) => (vessel === null ? takeOffBalance() : placeOnBalance(views[vessel], false)),
  tare,
  focus: (vs) => panTo(vs ? vs.map((i) => views[i]) : null),
  resetAll,
  setSpeed: (s) => { speed = s; hud.setSpeed(s); },
  simTime: () => simTime,
  busy: () => animator.busy,
  state: {
    mix: (i) => views[i].vessel.mix,
    tempC: (i) => views[i].vessel.mix.tempK - 273.15,
    syringeML: () => syringeView.syringe.volumeML,
    balanceG: balanceReading,
  },
  vesselName: (i) => (i === SYRINGE ? syringeView.name : views[i].name),
  chemLabel: (key, amount) => {
    const c = CHEMICALS.find((x) => x.key === key)!;
    return `${fmt(amount)} ${c.unit} ${c.formula}${c.kind === 'solution' && c.key !== 'water' ? ' ' + c.sub : ''}`;
  },
}, document.getElementById('recipes')!);

// Tab bên trái: kho hóa chất / thí nghiệm mẫu
const left = document.getElementById('left')!;
let leftTab: 'chem' | 'recipes' = 'chem';
left.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => {
  b.onclick = () => {
    left.classList.remove('collapsed');
    left.querySelectorAll('.tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    left.querySelectorAll<HTMLElement>('.pane').forEach((p) => p.classList.toggle('hidden', p.id !== b.dataset.tab));
    leftTab = b.dataset.tab as 'chem' | 'recipes';
    syncRoute();
  };
});
function showTab(tab: 'chem' | 'recipes') {
  left.querySelector<HTMLButtonElement>(`.tabs [data-tab="${tab}"]`)!.click();
}
const collapseBtn = left.querySelector<HTMLButtonElement>('.collapse')!;
collapseBtn.onclick = () => {
  const c = left.classList.toggle('collapsed');
  collapseBtn.textContent = c ? '›' : '‹';
};

// ── Menu chính: phòng thí nghiệm / bảng tuần hoàn ────────────────────────
let view: 'lab' | 'table' = 'lab';
const ptableRoot = document.getElementById('ptable')!;
function showView(v: 'lab' | 'table') {
  view = v;
  document.body.classList.toggle('table-mode', v === 'table');
  ptableRoot.classList.toggle('hidden', v !== 'table');
  document.querySelectorAll<HTMLButtonElement>('#mainnav [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  hud.tooltip(null);
  syncRoute();
}
document.querySelectorAll<HTMLButtonElement>('#mainnav [data-view]').forEach((b) => (b.onclick = () => showView(b.dataset.view as 'lab' | 'table')));
let tableElement: string | null = null;
const ptable = new PeriodicTable(ptableRoot, {
  elementChanged: (sym) => {
    tableElement = sym;
    syncRoute();
  },
  openChemical: (key) => {
    showView('lab');
    showTab('chem');
    if (phone.matches) setSheet('chem');
    chemPanel.reveal(key);
  },
  playRecipe: (id) => {
    showView('lab');
    showTab('recipes');
    const r = RECIPES.find((x) => x.id === id);
    if (r) void player.play(r);
  },
});

// ── Điện thoại: kho và bảng thông tin là hai ngăn kéo, mỗi lúc mở một ngăn ──
const phone = window.matchMedia('(max-width: 700px)');
type Sheet = 'chem' | 'info' | null;
// Chiều cao thanh công cụ dưới cùng (điện thoại: 2 hàng) để ngăn kéo và thanh thí nghiệm nằm ngay phía trên
{
  const tb = document.getElementById('toolbar')!;
  const setH = () => document.documentElement.style.setProperty('--tb-h', `${tb.offsetHeight}px`);
  new ResizeObserver(setH).observe(tb);
  setH();
}

function setSheet(sh: Sheet) {
  document.body.classList.toggle('sheet-chem', sh === 'chem');
  document.body.classList.toggle('sheet-info', sh === 'info');
  document.getElementById('btn-sheet-chem')!.classList.toggle('on', sh === 'chem');
  document.getElementById('btn-sheet-info')!.classList.toggle('on', sh === 'info');
}
const sheetOpen = (sh: 'chem' | 'info') => document.body.classList.contains(`sheet-${sh}`);
document.getElementById('btn-sheet-chem')!.onclick = () => setSheet(sheetOpen('chem') ? null : 'chem');
document.getElementById('btn-sheet-info')!.onclick = () => setSheet(sheetOpen('info') ? null : 'info');
/** Trên điện thoại, đóng ngăn kéo để nhìn thấy cảnh 3D (khi chọn hóa chất, khi chạy thí nghiệm) */
function revealScene() {
  if (phone.matches) setSheet(null);
}

// ── Đường dẫn: link thẳng tới thí nghiệm / nguyên tố ─────────────────────
let applyingRoute = false;
function syncRoute() {
  if (applyingRoute) return;
  const id = player.currentId;
  setRoute(view === 'table'
    ? { view: 'table', element: tableElement ?? undefined }
    : { view: 'lab', tab: id ? 'recipes' : leftTab, recipe: id ?? undefined });
}
player.onChange = (r) => {
  if (r) revealScene();
  syncRoute();
};

function applyRoute(r: Route) {
  applyingRoute = true;
  try {
    if (r.view === 'table') {
      showView('table');
      if (!r.element || !ptable.openSymbol(r.element)) ptable.close();
      return;
    }
    showView('lab');
    showTab(r.tab);
    const recipe = r.recipe ? RECIPES.find((x) => x.id === r.recipe) : undefined;
    if (recipe && player.currentId !== recipe.id) void player.play(recipe);
  } finally {
    applyingRoute = false;
    syncRoute();
  }
}
window.addEventListener('hashchange', () => applyRoute(parseHash(location.hash)));

// ── Vòng lặp chính ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
let realTime = 0;

function frame() {
  const dt = Math.min(0.1, clock.getDelta());
  realTime += dt;
  animator.update(dt);
  moveCamera(dt);
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
  syringeView.update(dt);
  syringePanel.record(simTime, syringeView.syringe.volumeML);
  const g = balanceReading();
  balanceView.display(g);
  balancePanel.record(simTime, g);
  hud.panel(selected, selObs, realTime);
  hud.setTime(simTime);
  lamp.update(dt);
  controls.update();
  if (view === 'lab') renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const help = new HelpOverlay();
document.querySelector<HTMLButtonElement>('#mainnav .nav-help')!.onclick = () => help.open();

select(views[0]);
// Góc nhìn ban đầu: thấy toàn bộ bàn thí nghiệm (tính sau khi các bảng giao diện đã hiện)
{
  const h = homeView();
  camera.position.copy(h.pos);
  controls.target.copy(h.target);
  controls.update();
}
frame();
const startRoute = parseHash(location.hash);
applyRoute(startRoute);
// Người mở link tới một bài cụ thể muốn xem ngay; hướng dẫn vẫn mở được bằng nút ❓
if (startRoute.view === 'lab' && !startRoute.recipe) help.openIfFirstVisit();

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
