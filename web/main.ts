import { isPhone, phoneQuery } from './layout';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bleachRate, contentsMassG, indicatorDrops, litmusColor, litmusPH, litmusVerdict, makeSolution, RGB, testBurningSplint, testMagnet, testGlowingSplint } from '../src';
import { Animator, call, easeIn, Step as AnimStep, tween } from './anim';
import { CHEMICALS, ChemEntry, ReagentDef, SolidItem, solidMol } from './catalog';
import { RecipePlayer } from './recipePlayer';
import { RECIPE_ALIASES, RECIPES, Step as ScriptStep, SYRINGE } from './recipes';
import { ChemPanel } from './chemPanel';
import { LogEntry, PhenomenaTracker } from './events';
import { Hud } from './hud';
import { setRGB } from './materials';
import { DeliveryTubeView } from './deliveryTube';
import { blueFlame, DYE_PAPER_COLOR, PH_PAPER_DRY, phPaperColor, popFlash, ProbeView, smokePuff, ToolKind } from './probes';
import { X_HIDDEN_TURBIDITY, XCard } from './xcard';
import { burnOutcome, burnRefusal, TongsView } from './burn';
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
import { parseHash, Route, setRoute, shareUrl } from './router';
import { decodeShare, encodeShare, Recorder, SHARE_VERSION, ShareError, sharedScript } from './share';
import { RecordBar, ShareDialog } from './recordUi';

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
/** Dụng cụ đang nằm trên đĩa cân: một cốc / bình, hoặc tối đa hai ống nghiệm */
let onBalance: VesselView[] = [];
const isOnBalance = (v: VesselView) => onBalance.includes(v);
/**
 * Số đọc của cân, làm tròn 0,01 g như cân thật. Cân luôn tự trừ bì: chỉ tính khối lượng các chất
 * bên trong, không tính khối lượng dụng cụ thủy tinh.
 */
const balanceReading = () => Math.round(onBalance.reduce((g, v) => g + contentsMassG(v.vessel.mix), 0) * 100) / 100 + 0;
/** Viết thường chữ đầu, giữ chữ hoa bên trong ("Viên vitamin C sủi" → "viên vitamin C sủi") */
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const fmtG = (g: number) => g.toFixed(2).replace('.', ',');

/** Ghi thao tác của người dùng thành thí nghiệm tự làm (share.ts) */
const recorder = new Recorder();
const idx = (v: VesselView) => views.indexOf(v);
function rec(step: ScriptStep) {
  if (!recorder.active || player.playing) return;
  recorder.push(step, simTime);
  if (step.kind !== 'predict') askPending = false;
  updateRecBar();
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
  onSpeed: (s) => (locked() ? hud.setSpeed(speed) : (speed = s)),
  onStir: () => locked() || stir(),
  onHeat: () => locked() || toggleHeat(),
  onEmpty: () => locked() || empty(),
  onFocus: () => toggleFocus(),
  onInvert: () => locked() || invert(),
});

/**
 * Đang chạy thí nghiệm mẫu thì phòng thí nghiệm chỉ để xem: không cho thêm hóa chất, đun, đổ…
 * (vẫn xoay / phóng to cảnh, chọn dụng cụ để xem thông tin). Trả về true và báo nếu đang khóa.
 */
function locked(): boolean {
  if (!player.playing) return false;
  player.toast('Đang chạy thí nghiệm mẫu: chỉ xem. Bấm ✕ để dừng rồi tự làm.');
  return true;
}

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
      startXCard(view);
      if (def.indicator) view.vessel.add(indicatorDrops(def.indicator, drops));
      else view.vessel.add(makeSolution(def.solutes, mL / 1000, view.vessel.roomK));
      const what = def.indicator
        ? `${drops} giọt ${def.formula.toLowerCase()}`
        : `${fmt(mL)} mL ${def.formula}${def.key === 'water' || !def.conc ? '' : ' ' + def.conc}`;
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
      log(`Cho ${fmt(grams)} g ${lowerFirst(item.label)} vào`, 'action', view.name);
    }),
  );
}

// ── Thử khí ở miệng dụng cụ ──────────────────────────────────────────────
const TOOL_NAME: Record<ToolKind, string> = {
  glowing: 'que đóm còn tàn đỏ',
  burning: 'que đóm đang cháy',
  litmus: 'giấy quỳ tím ẩm',
  litmus_sol: 'giấy quỳ tím',
  ph_paper: 'giấy pH',
  ph_moist: 'giấy pH ẩm',
  magnet: 'nam châm',
  xcard: 'tờ giấy kẻ chữ X',
  dye_paper: 'mẩu giấy màu ẩm',
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

// ── Giấy quỳ / giấy pH thử dung dịch: nhúng xong thì để luôn trong dụng cụ, màu đổi theo dung dịch ──
const dipped = new Map<VesselView, { p: ProbeView; ph: boolean; color: RGB; verdict: string; loggedAt: number }>();
/** Số đọc trên giấy pH: so màu với bảng màu chuẩn, được số nguyên */
const phReading = (pH: number) => Math.min(14, Math.max(1, Math.round(pH)));
const phSays = (pH: number) => `Giấy pH chuyển màu, so với bảng màu chuẩn: pH ≈ ${phReading(pH)}`;
const LITMUS_SAYS: Record<string, string> = {
  acid: 'Giấy quỳ tím trong dung dịch chuyển sang màu đỏ → dung dịch có tính acid',
  base: 'Giấy quỳ tím trong dung dịch chuyển sang màu xanh → dung dịch có tính base',
  neutral: 'Giấy quỳ trong dung dịch trở lại màu tím → dung dịch trung tính',
};

/** Lấy mẩu quỳ đang nhúng trong dụng cụ ra (bỏ đi) */
function removeDipped(v: VesselView) {
  removeXCard(v);
  const d = dipped.get(v);
  if (!d) return;
  v.group.remove(d.p.group);
  dipped.delete(v);
}

/** Mỗi khung hình: màu quỳ đang nhúng đổi dần theo pH; báo khi đổi sang màu khác */
function updateDipped(v: VesselView, pH: number, dt: number) {
  const d = dipped.get(v);
  if (!d) return;
  if (v.vessel.mix.volumeL < 1e-5 || !Number.isFinite(pH)) return removeDipped(v);
  const target = d.ph ? phPaperColor(pH) : litmusColor(pH);
  const k = Math.min(1, (dt * Math.max(1, speed)) / 1.2);
  d.color = d.color.map((c, i) => c + (target[i] - c) * k) as RGB;
  d.p.setPaperColor(d.color);
  const verdict = d.ph ? String(phReading(pH)) : litmusVerdict(pH);
  // Giấy pH: chỉ báo khi số đọc đã ổn định một lúc (tránh báo liên tục lúc chất đang tan dần)
  if (verdict !== d.verdict && (!d.ph || simTime - d.loggedAt > 3)) {
    d.verdict = verdict;
    d.loggedAt = simTime;
    log(d.ph ? phSays(pH) : LITMUS_SAYS[verdict], 'phenomenon', v.name);
  }
}

// ── Tờ giấy kẻ chữ X đặt sau dụng cụ + đồng hồ bấm giờ (đo thời gian dung dịch đục che khuất chữ X) ──
const xcards = new Map<VesselView, { card: XCard; start: number | null; doneAt: number | null }>();

function placeXCard(view: VesselView) {
  removeXCard(view);
  const card = new XCard();
  // Phía sau dụng cụ (camera nhìn từ phía +z), sát thành
  card.group.position.set(0, 0, -(view.kind.profile.radius(1) + 0.45));
  view.group.add(card.group);
  xcards.set(view, { card, start: null, doneAt: null });
  log('Đặt tờ giấy kẻ chữ X phía sau, đồng hồ bấm giờ bắt đầu chạy khi rót chất tiếp theo vào', 'action', view.name);
}

function removeXCard(v: VesselView) {
  const x = xcards.get(v);
  if (!x) return;
  v.group.remove(x.card.group);
  x.card.dispose();
  xcards.delete(v);
}

/** Rót thêm chất vào dụng cụ đã có dung dịch: bắt đầu bấm giờ */
function startXCard(v: VesselView) {
  const x = xcards.get(v);
  if (x && x.start === null && v.vessel.mix.volumeL > 1e-5) x.start = simTime;
}

const fmtS = (s: number) => s.toFixed(1).replace('.', ',') + ' s';

function updateXCard(v: VesselView, turbidity: number) {
  const x = xcards.get(v);
  if (!x) return;
  const t = x.start === null ? 0 : simTime - x.start;
  if (x.doneAt === null && x.start !== null && turbidity >= X_HIDDEN_TURBIDITY) {
    x.doneAt = t;
    log(`Không còn nhìn thấy chữ X: sau ${fmtS(t)} kể từ khi rót`, 'phenomenon', v.name);
  }
  // Chữ X còn khá rõ khi mới hơi đục, mờ nhanh khi gần bị che khuất hẳn; đồng hồ dừng lúc chữ X biến mất
  x.card.set(1 - Math.min(1, turbidity / X_HIDDEN_TURBIDITY) ** 4, x.doneAt !== null ? `⏹ ${fmtS(x.doneAt)}` : `⏱ ${fmtS(t)}`);
}

/** Dòng "đồng hồ" trong bảng thông tin của dụng cụ đang chọn */
function xcardText(v: VesselView): string | undefined {
  const x = xcards.get(v);
  if (!x) return undefined;
  if (x.doneAt !== null) return `⏹ ${fmtS(x.doneAt)} · không còn nhìn thấy chữ X`;
  if (x.start === null) return '⏱ chờ rót chất tiếp theo vào';
  return `⏱ ${fmtS(simTime - x.start)}`;
}

function probe(kind: ToolKind, view: VesselView, queued = false) {
  const dip = kind === 'litmus_sol' || kind === 'ph_paper';
  const phPaper = kind === 'ph_paper' || kind === 'ph_moist';
  // Đang rót hóa chất vào: thử dung dịch sau khi rót xong (lúc đó mới có dung dịch để kiểm tra)
  if (dip && animator.busy && !queued) {
    animator.run(call(() => probe(kind, view, true)));
    return;
  }
  if (dip && view.vessel.inverted) return log('Lật ngửa ống trước khi thử dung dịch.', 'warning', view.name);
  if (dip && view.vessel.mix.volumeL < 1e-5) return log(`Không có dung dịch để thử bằng ${TOOL_NAME[kind]}.`, 'warning', view.name);
  rec({ kind: 'probe', tool: kind, vessel: idx(view) });
  if (kind === 'magnet') return magnetTest(view);
  if (kind === 'xcard') return placeXCard(view);
  const p = new ProbeView(kind);
  const dye = kind === 'dye_paper';
  const isPaper = kind === 'litmus' || kind === 'ph_moist' || dip || dye;
  const holdTime = dye ? 8 : dip ? 3 : isPaper ? 5 : 3;
  /** Giấy màu ẩm: mức đã bị tẩy màu (0 → 1), không phục hồi */
  let bleached = 0;
  /** pH mà giấy quỳ "thấy": dung dịch (nhúng vào) hoặc lớp nước trên giấy ẩm cân bằng với khí */
  const paperPH = () => (dip ? view.vessel.observe().pH : litmusPH(view.vessel));
  let above = new THREE.Vector3();
  let at = new THREE.Vector3();
  let paper: RGB = phPaper ? PH_PAPER_DRY : dye ? DYE_PAPER_COLOR : [0.56, 0.32, 0.62];
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
        if (dip) removeDipped(view);
        if (dip) {
          // Nhúng đầu dải quỳ ngập khoảng 0,6 dưới mặt dung dịch
          at = new THREE.Vector3(m.x, Math.max(view.surfaceWorld().y - 0.6, view.group.position.y + 0.15), m.z);
          above = new THREE.Vector3(m.x, m.y + 4, m.z);
        } else if (view.vessel.inverted) {
          // Ống úp ngược: đưa dụng cụ thử từ phía dưới lên miệng ống
          if (!isPaper) p.holdFromBelow();
          at = m.clone().add(new THREE.Vector3(0, isPaper ? -0.8 : -0.35, 0));
          above = at.clone().add(new THREE.Vector3(0, -0.5, 6));
        } else {
          // Giấy màu ẩm (gắn ở nút đậy) đưa sâu vào trong bình chứa khí
          at = m.clone().add(new THREE.Vector3(0, dye ? -Math.min(3, view.kind.profile.height * 0.35) : isPaper ? -0.6 : -0.5, 0));
          above = at.clone().add(new THREE.Vector3(0, 4, 0));
        }
        p.group.position.copy(above);
        p.group.scale.setScalar(0.001);
        addTemp(p.group);
        log(dip ? `Nhúng đầu mẩu ${TOOL_NAME[kind]} vào dung dịch` : `Đưa ${TOOL_NAME[kind]} vào miệng ống`, 'action', view.name);
      },
    }),
    tween(0.5, (t) => p.group.position.lerpVectors(above, at, t)),
    (dt) => {
      elapsed += dt;
      p.update(dt);
      if (dye) {
        bleached = Math.min(1, bleached + bleachRate(view.vessel) * dt);
        paper = DYE_PAPER_COLOR.map((c) => c + (0.96 - c) * bleached) as RGB;
        p.setPaperColor(paper);
      } else if (isPaper) {
        const target = phPaper ? phPaperColor(paperPH()) : litmusColor(paperPH());
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
      if (dye) {
        log(bleached > 0.5 ? 'Mẩu giấy màu ẩm bị mất màu → có khí chlorine (chlorine ẩm có tính tẩy màu)'
          : bleached > 0.1 ? 'Mẩu giấy màu ẩm nhạt màu đi một chút → có ít khí chlorine'
            : 'Mẩu giấy màu ẩm không đổi màu', 'phenomenon', view.name);
      } else if (isPaper) {
        const verdict = litmusVerdict(paperPH());
        if (phPaper && !dip) {
          const n = phReading(paperPH());
          log(n >= 8 ? `Giấy pH ẩm chuyển màu xanh, pH ≈ ${n} → khí thoát ra có tính base (như NH₃)`
            : n <= 4 ? `Giấy pH ẩm chuyển màu đỏ, pH ≈ ${n} → khí thoát ra có tính acid (như CO₂)`
              : `Giấy pH ẩm gần như không đổi màu (pH ≈ ${n}, như nước cất để ngoài không khí)`, 'phenomenon', view.name);
        } else if (phPaper) log(phSays(paperPH()), 'phenomenon', view.name);
        else if (dip) log(verdict === 'base' ? 'Giấy quỳ tím chuyển màu xanh → dung dịch có tính base'
          : verdict === 'acid' ? 'Giấy quỳ tím chuyển màu đỏ → dung dịch có tính acid'
            : 'Giấy quỳ tím không đổi màu → dung dịch trung tính', 'phenomenon', view.name);
        else log(verdict === 'base' ? 'Giấy quỳ ẩm chuyển màu xanh → khí có tính base (như NH₃)'
          : verdict === 'acid' ? 'Giấy quỳ ẩm chuyển màu đỏ → khí có tính acid (như CO₂)'
            : 'Giấy quỳ ẩm không đổi màu', 'phenomenon', view.name);
      }
      for (const f of fx) removeTemp(f.obj);
      return true;
    },
    ...(dip
      // Giấy quỳ thử dung dịch: để luôn trong dụng cụ (đi theo dụng cụ khi di chuyển), màu tiếp tục đổi theo dung dịch
      ? [call(() => {
        removeTemp(p.group);
        view.group.attach(p.group);
        dipped.set(view, { p, ph: phPaper, color: paper, verdict: phPaper ? String(phReading(paperPH())) : litmusVerdict(paperPH()), loggedAt: simTime });
      })]
      : [
        tween(0.4, (t) => {
          p.update(1 / 60);
          p.group.position.lerpVectors(at, above, t);
          p.group.scale.setScalar(Math.max(0.001, 1 - t));
        }),
        call(() => removeTemp(p.group)),
      ]),
  );
}

const LAMP_NAME = 'Đèn cồn';

// ── Đốt mẩu kim loại trên ngọn lửa đèn cồn (cầm bằng kẹp sắt) ───────────
function burnInFlame(item: SolidItem) {
  const refusal = burnRefusal(item);
  if (refusal) return log(refusal, 'warning', LAMP_NAME);
  if (heatingView) return log('Đèn cồn đang dùng để đun. Tắt đèn trước rồi mới đốt mẫu.', 'warning', LAMP_NAME);
  const key = CHEMICALS.find((c) => c.solid === item)?.key;
  if (key) rec({ kind: 'burn', chem: key });
  const out = burnOutcome(item.id);
  const tongs = new TongsView(item);
  const g = tongs.group;
  const name = lowerFirst(item.label);
  // Cán kẹp chĩa sang phải và về phía người xem, hơi chếch lên
  g.rotation.set(0, -Math.atan2(0.66, 0.75), 0.3, 'YXZ');
  let inFlame = new THREE.Vector3(), lifted = new THREE.Vector3(), away = new THREE.Vector3();
  const light = new THREE.PointLight(out.light ?? 0xffffff, 0, 70, 2);
  const smoke: { s: THREE.Sprite; age: number }[] = [];
  let puffAcc = 0;
  const tickSmoke = (dt: number, spawn: boolean, at: THREE.Vector3) => {
    puffAcc += dt;
    if (spawn && puffAcc > 0.12) {
      puffAcc = 0;
      const s = smokePuff();
      s.material.color.set(0xf2f2f2);
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4));
      addTemp(s);
      smoke.push({ s, age: 0 });
    }
    for (const p of smoke) {
      p.age += dt;
      p.s.position.y += dt * 1.6;
      p.s.position.x += dt * 0.3;
      p.s.scale.setScalar(0.6 + p.age * 1.8);
      p.s.material.opacity = Math.max(0, 0.55 * (1 - p.age / 2.5));
    }
    for (const p of smoke.filter((x) => x.age > 2.5)) removeTemp(p.s);
    smoke.splice(0, smoke.length, ...smoke.filter((x) => x.age <= 2.5));
  };
  const worldAlong = (t: number) => g.localToWorld(tongs.pointAlong(t));
  let time = 0;
  const phase = (dur: number, fn: (k: number, dt: number) => void): AnimStep => {
    let e = 0;
    return (dt) => { e += dt; time += dt; fn(Math.min(1, e / dur), dt); return e >= dur; };
  };
  animator.run(
    call(() => {
      // Đặt sao cho đầu mẫu nằm trong phần nóng nhất của ngọn lửa
      const flame = lamp.group.localToWorld(lamp.flameTip.clone()).add(new THREE.Vector3(0, -0.9, 0));
      g.position.set(0, 0, 0);
      g.updateMatrixWorld(true);
      inFlame = flame.sub(g.localToWorld(tongs.tipLocal.clone()));
      lifted = inFlame.clone().add(new THREE.Vector3(0, 2.6, 1.2));
      away = inFlame.clone().add(new THREE.Vector3(1.5, 4.5, 3));
      g.position.copy(away);
      addTemp(g);
      addTemp(light);
      lamp.setLit(true);
      log(`Dùng kẹp sắt giữ ${name} đưa vào ngọn lửa đèn cồn`, 'action', LAMP_NAME);
    }),
    tween(0.9, (t) => g.position.lerpVectors(away, inFlame, t)),
    // Mẫu nóng dần
    phase(1.6, (k) => tongs.setHot(k)),
    ...(out.burns ? [
      call(() => hud.log({ t: simTime, vessel: LAMP_NAME, text: out.during, kind: 'phenomenon', color: [1, 1, 1], equation: out.equation })),
      // Ngọn lửa sáng chói chạy dọc mảnh kim loại từ đầu tới sát kẹp
      phase(4.5, (k, dt) => {
        const front = Math.min(1, k * 1.15);
        const flick = 1 + 0.18 * Math.sin(time * 41) + 0.1 * Math.sin(time * 67);
        const fade = k > 0.87 ? (1 - k) / 0.13 : Math.min(1, k * 8);
        tongs.setFlame(front * 0.9, 1.1 * fade, out.light, flick);
        tongs.setConverted(front, out.after, true);
        tongs.setHot(1 - k);
        light.position.copy(worldAlong(front * 0.9));
        light.intensity = 450 * fade * flick;
        g.position.copy(inFlame).add(new THREE.Vector3(0, 1.4 * Math.min(1, k * 3), 0.5 * Math.min(1, k * 3)));
        tickSmoke(dt, fade > 0.2, worldAlong(front * 0.9));
      }),
    ] : [
      call(() => log(out.during, 'phenomenon', LAMP_NAME)),
      phase(3, (k, dt) => {
        tongs.setHot(1);
        tongs.setConverted(k, out.after, false);
        tickSmoke(dt, false, inFlame);
      }),
    ]),
    // Nhấc ra khỏi lửa, tắt đèn, quan sát sản phẩm
    phase(0.8, (k, dt) => {
      g.position.lerpVectors(out.burns ? g.position.clone() : inFlame, lifted, k);
      tongs.setHot(out.burns ? 0 : 1 - k);
      tongs.setFlame(0, 0);
      light.intensity = 0;
      tickSmoke(dt, false, inFlame);
    }),
    call(() => {
      lamp.setLit(false);
      hud.log({ t: simTime, vessel: LAMP_NAME, text: out.result, kind: 'phenomenon', color: out.after, equation: out.burns ? undefined : out.equation });
    }),
    phase(2.8, (_k, dt) => tickSmoke(dt, false, inFlame)),
    phase(0.6, (k, dt) => {
      g.position.lerpVectors(lifted, away, k);
      g.scale.setScalar(Math.max(0.001, 1 - k));
      tickSmoke(dt, false, inFlame);
    }),
    call(() => {
      for (const p of smoke) removeTemp(p.s);
      removeTemp(g);
      removeTemp(light);
    }),
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
  extra: { label: '⬇ Lấy xuống', title: 'Lấy dụng cụ khỏi cân', onClick: () => takeOffBalance() },
});

function balanceNote(): string {
  return onBalance.length ? `đang cân ${onBalance.map((v) => v.name.toLowerCase()).join(' và ')}` : 'đĩa cân trống';
}

/**
 * Đặt dụng cụ lên đĩa cân (bấm lần nữa để lấy xuống). Đĩa cân chứa được một cốc / bình,
 * hoặc hai ống nghiệm đặt cạnh nhau; đặt thêm khi đã đầy thì các dụng cụ cũ được lấy xuống.
 */
function placeOnBalance(v: VesselView, toggle = true) {
  if (isOnBalance(v)) return toggle ? takeOffBalance(v) : undefined;
  if (heatingView === v) return log('Tắt đèn cồn và lấy dụng cụ khỏi giá đun trước khi cân.', 'warning', v.name);
  if (v.vessel.inverted) return log('Lật ngửa ống trước khi đặt lên cân.', 'warning', v.name);
  const fits = v.kind.type === 'tube' && onBalance.length < 2 && onBalance.every((o) => o.kind.type === 'tube');
  if (!fits) takeOffBalance(undefined, true);
  onBalance.push(v);
  rec({ kind: 'weigh', vessel: idx(v) });
  select(v);
  animator.run(
    // Ống đang nằm trên cân dịch sang một bên nhường chỗ
    ...onBalance.filter((o) => o !== v).map((o) => moveVessel(o, () => restPose(o), 0.5)),
    moveVessel(v, () => restPose(v)),
    call(() => {
      balancePanel.start(simTime, balanceReading(), balanceNote());
      log(`Đặt lên cân điện tử: ${fmtG(balanceReading())} g`, 'action', v.name);
    }),
  );
}

/**
 * Đổ toàn bộ chất lỏng (kèm kết tủa đang lơ lửng) từ dụng cụ này sang dụng cụ khác.
 * Dụng cụ nguồn được nhấc lên, nghiêng miệng trên miệng dụng cụ nhận, rồi đặt lại chỗ cũ.
 */
function pourVessel(src: VesselView, dst: VesselView, queued = false): boolean {
  if (src === dst) return false;
  // Đang có hoạt ảnh (vd. còn đang rót hóa chất vào): đổ sau khi xong, lúc đó mới kiểm tra
  if (animator.busy && !queued) {
    animator.run(call(() => void pourVessel(src, dst, true)));
    return true;
  }
  const why = heatingView === src || heatingView === dst ? 'Tắt đèn cồn trước khi đổ.'
    : src.vessel.inverted || dst.vessel.inverted ? 'Lật ngửa ống trước khi đổ.'
    : src.vessel.outlet || dst.vessel.outlet || [...tubes.values()].some((t) => t.dst === src || t.dst === dst) ? 'Tháo ống dẫn khí trước khi đổ.'
    : src.vessel.mix.volumeL < 1e-5 ? `${src.name} không có chất lỏng để đổ.`
    : null;
  if (why) { log(why, 'warning', src.name); return false; }
  let mL = src.vessel.mix.volumeL * 1000;
  const room = dst.capacityML - dst.vessel.mix.volumeL * 1000 - pendingML(dst);
  if (room < 0.05) { log(`${dst.name} đã đầy.`, 'warning', dst.name); return false; }
  if (mL > room) {
    mL = room;
    log(`Chỉ đổ được ${fmt(mL)} mL, ${dst.name.toLowerCase()} sẽ đầy.`, 'warning', src.name);
  }
  addPending(dst, mL);
  rec({ kind: 'pour', src: idx(src), dst: idx(dst) });
  removeDipped(src);
  const theta = -1.85;
  const h = src.kind.profile.height;
  let from = new THREE.Vector3();
  let tilted = new THREE.Vector3();
  let moved = 0;
  const tiltedPos = () => {
    const m = dst.mouthWorld().add(new THREE.Vector3(0.25 * (dst.kind.type === 'tube' ? 1 : 2), 0.9, 0));
    return new THREE.Vector3(m.x + h * Math.sin(theta), m.y - h * Math.cos(theta), m.z);
  };
  const transfer = (upTo: number) => {
    const d = upTo - moved;
    if (d <= 1e-6) return;
    dst.vessel.add(src.vessel.take(d / 1000));
    moved = upTo;
  };
  select(dst);
  animator.run(
    tween(0.7, (t) => {
      src.group.position.lerpVectors(from, tilted, t);
      src.group.position.y += Math.sin(Math.PI * t) * 2;
      src.group.rotation.z = theta * t;
    }, { onStart: () => { from = src.group.position.clone(); tilted = tiltedPos(); } }),
    tween(Math.min(2.2, 0.8 + mL * 0.04), (t) => {
      const mouth = src.mouthWorld();
      const surf = dst.surfaceWorld();
      stream.visible = t < 0.97;
      stream.position.copy(mouth);
      stream.scale.set(src.kind.type === 'tube' ? 0.8 : 1.4, Math.max(0.1, mouth.y - surf.y), 1);
      transfer(mL * t);
    }, {
      ease: (t) => t,
      onStart: () => { setRGB(stream.material.color, src.vessel.observe().appearance); startXCard(dst); },
    }),
    call(() => {
      stream.visible = false;
      transfer(mL);
      addPending(dst, -mL);
      log(`Đổ ${fmt(mL)} mL sang ${dst.name.toLowerCase()}`, 'action', src.name);
      log(`Nhận ${fmt(mL)} mL từ ${src.name.toLowerCase()}`, 'action', dst.name);
    }),
    tween(0.5, (t) => (src.group.rotation.z = theta * (1 - t))),
    moveVessel(src, () => restPose(src), 0.7),
  );
  return true;
}

/** Lấy một dụng cụ (hoặc tất cả) khỏi cân */
function takeOffBalance(v?: VesselView, quiet = false) {
  const off = v ? onBalance.filter((o) => o === v) : [...onBalance];
  if (!off.length) return;
  rec(v ? { kind: 'weigh', vessel: idx(v), off: true } : { kind: 'weigh', vessel: null });
  onBalance = onBalance.filter((o) => !off.includes(o));
  animator.run(...off.map((o) => moveVessel(o, () => restPose(o))), ...onBalance.map((o) => moveVessel(o, () => restPose(o), 0.5)));
  balancePanel.start(simTime, balanceReading(), balanceNote());
  if (!quiet) for (const o of off) log('Lấy khỏi cân điện tử', 'action', o.name);
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
    rec({ kind: 'connect', src: idx(src), dst: null });
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
  rec({ kind: 'connect', src: idx(src), dst: idx(dst) });
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
  rec({ kind: 'connect', src: idx(src), dst: SYRINGE });
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
  if (isOnBalance(v)) {
    const i = onBalance.indexOf(v);
    const dx = onBalance.length > 1 ? (i === 0 ? -1.1 : 1.1) : 0;
    return balanceView.panTopWorld().add(new THREE.Vector3(dx, v.kind.type === 'tube' ? 0.15 : 0.12, 0));
  }
  return v.vessel.inverted ? v.home.clone().add(new THREE.Vector3(0, v.kind.profile.height + 2.2, 0)) : v.home.clone();
}

function invert(v = requireSelected(), quiet = false) {
  if (!v) return;
  if (v.kind.type !== 'tube') return log('Chỉ úp ngược được ống nghiệm.', 'warning', v.name);
  if (!v.vessel.inverted && v.vessel.mix.volumeL > 5e-5) return log('Hãy đổ hết chất lỏng trước khi úp ngược ống.', 'warning', v.name);
  if (heatingView === v) return log('Không úp ống đang đun.', 'warning', v.name);
  if (v.vessel.outlet) return log('Ống đang được nút để phát khí, không úp được.', 'warning', v.name);
  const toInverted = !v.vessel.inverted;
  rec({ kind: 'invert', vessel: idx(v) });
  removeDipped(v);
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

/** Thả một mục trong kho vào đèn cồn: mẩu chất rắn thì cầm bằng kẹp sắt đốt trên lửa */
function dropOnLamp(entry: ChemEntry) {
  if (entry.solid) return burnInFlame(entry.solid);
  log('Chỉ đưa được mẩu chất rắn (dải, dây, đinh, viên) vào ngọn lửa, bằng kẹp sắt.', 'warning', LAMP_NAME);
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
  rec({ kind: 'add', chem: entry.key, amount, vessel: idx(view) });
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
  rec({ kind: 'heat', vessel: idx(v), on: false });
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
  if (isOnBalance(v)) return log('Lấy dụng cụ khỏi cân trước khi đun.', 'warning', v.name);
  if (heatingView) stopHeat();
  rec({ kind: 'heat', vessel: idx(v), on: true });
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
  rec({ kind: 'stir', vessel: idx(v) });
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
  rec({ kind: 'empty', vessel: idx(v) });
  removeDipped(v);
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
  if (!isPhone()) {
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

// ── Kéo dụng cụ trên bàn: thả vào đèn cồn để đun, thả lên cân để cân, thả chỗ khác để cất về chỗ cũ ──
/** Bán kính (theo mặt bàn) quanh đèn cồn / cân mà thả vào thì tính là trúng */
const DROP_RADIUS = 4.5;
let drag: { view: VesselView; pointerId: number; started: boolean; lift: number; offset: THREE.Vector3; zone: DropZone } | null = null;
/** Chỗ thả dụng cụ đang kéo: đèn cồn, cân, hoặc một dụng cụ chứa khác (để đổ sang) */
type DropZone = 'lamp' | 'balance' | VesselView | null;
/** Dụng cụ sẽ nhận chất lỏng nếu thả (được tô sáng) */
let pourTarget: VesselView | null = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragHit = new THREE.Vector3();

function dragPoint(x: number, y: number): THREE.Vector3 | null {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, dragHit) ? dragHit.clone() : null;
}

/** Đích thả: con trỏ nằm trên đèn cồn / cân, hoặc dụng cụ đang kéo ở sát chúng (theo mặt bàn) */
function dropZone(x: number, y: number, p: THREE.Vector3, v?: VesselView): DropZone {
  // Thả lên một dụng cụ chứa khác: đổ sang dụng cụ đó
  // (phải đưa tới sát dụng cụ đó, để kéo ngang qua giá ống nghiệm không bị tính là đổ)
  const other = pickAt(x, y, views.filter((o) => o !== v).map((o) => o.group));
  if (other?.userData.kind === 'vessel') {
    const target = other.userData.view as VesselView;
    const pos = target.group.position;
    if (Math.hypot(p.x - pos.x, p.z - pos.z) < 3.5) return target;
  }
  const o = pickAt(x, y, [lamp.group, stand.group, balanceView.group]);
  if (o?.userData.kind === 'lamp') return 'lamp';
  if (o?.userData.kind === 'balance') return 'balance';
  const flat = (a: THREE.Vector3) => Math.hypot(p.x - a.x, p.z - a.z);
  if (flat(LAMP_POS) < DROP_RADIUS) return 'lamp';
  if (flat(balanceView.group.position) < DROP_RADIUS) return 'balance';
  return null;
}

/** Sau khi thả: nếu dụng cụ chưa về đúng chỗ (thao tác bị từ chối) thì đưa nó về */
function settle(v: VesselView) {
  animator.run(call(() => {
    const want = heatingView === v ? heatPose(v) : restPose(v);
    if (v.group.position.distanceTo(want) > 0.05) animator.run(moveVessel(v, () => want, 0.5));
  }));
}

function finishDrag(v: VesselView, zone: DropZone) {
  hud.hint(null);
  pourTarget?.setHover(false);
  pourTarget = null;
  if (zone instanceof VesselView) {
    if (!pourVessel(v, zone)) settle(v);
  } else if (zone === 'lamp') {
    if (isOnBalance(v)) {
      rec({ kind: 'weigh', vessel: idx(v), off: true });
      onBalance = onBalance.filter((o) => o !== v);
      balancePanel.start(simTime, balanceReading(), balanceNote());
    }
    select(v);
    if (heatingView !== v) startHeat(v);
  } else if (zone === 'balance') {
    if (heatingView === v) {
      rec({ kind: 'heat', vessel: idx(v), on: false });
      heatingView = null;
      v.vessel.heaterW = 0;
      v.heating = false;
      lamp.setLit(false);
      stand.clamp.visible = stand.tripod.visible = false;
      hud.setHeating(false);
      log('Tắt đèn cồn', 'action', v.name);
    }
    if (!isOnBalance(v)) placeOnBalance(v, false);
  } else {
    if (heatingView === v) stopHeat();
    else if (isOnBalance(v)) takeOffBalance(v);
  }
  settle(v);
}

// Bắt đầu chạm/bấm trên một dụng cụ: khóa camera (để một ngón kéo dụng cụ chứ không kéo cảnh)
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || player.playing || animator.busy || chemPanel.armed || connectFrom) return;
  const o = pickAt(e.clientX, e.clientY, vesselGroups);
  if (o?.userData.kind !== 'vessel') return;
  const view = o.userData.view as VesselView;
  // Kéo trên mặt phẳng ngang đi qua điểm vừa cầm, để dụng cụ bám đúng theo con trỏ
  const hit = raycaster.intersectObject(view.group, true)[0]?.point;
  dragPlane.constant = -(hit?.y ?? 0);
  const p = dragPoint(e.clientX, e.clientY);
  if (!p) return;
  controls.enabled = false;
  drag = { view, pointerId: e.pointerId, started: false, lift: 0, zone: null, offset: view.group.position.clone().setY(0).sub(p.setY(0)) };
}, { capture: true });

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId || !downAt) return;
  const v = drag.view;
  if (!drag.started) {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) return;
    drag.started = true;
    renderer.domElement.setPointerCapture(e.pointerId);
    select(v);
    if (heatingView === v) stand.clamp.visible = stand.tripod.visible = false;
  }
  const p = dragPoint(e.clientX, e.clientY);
  if (!p) return;
  drag.lift = Math.min(3, drag.lift + 0.6);
  const pos = p.setY(0).add(drag.offset);
  v.group.position.set(pos.x, drag.lift, pos.z);
  tubes.forEach((tb) => tb.update());
  const zone = drag.zone = dropZone(e.clientX, e.clientY, v.group.position, v);
  pourTarget?.setHover(false);
  pourTarget = zone instanceof VesselView ? zone : null;
  pourTarget?.setHover(true);
  hud.hint(zone instanceof VesselView ? `Thả để đổ ${v.name.toLowerCase()} sang ${zone.name.toLowerCase()}`
    : zone === 'lamp' ? `Thả để đun ${v.name.toLowerCase()} bằng đèn cồn`
    : zone === 'balance' ? `Thả để đặt ${v.name.toLowerCase()} lên cân điện tử`
    : 'Thả vào đèn cồn để đun, lên cân để cân, lên dụng cụ khác để đổ sang; thả chỗ khác để cất về chỗ cũ');
});

const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.pointerId) return false;
  const d = drag;
  drag = null;
  controls.enabled = true;
  if (!d.started) return false;
  if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
  finishDrag(d.view, d.zone);
  return true;
};
renderer.domElement.addEventListener('pointercancel', (e) => {
  if (drag?.started) { hud.hint(null); settle(drag.view); }
  pourTarget?.setHover(false);
  pourTarget = null;
  drag = null;
  controls.enabled = true;
});

let downAt: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (endDrag(e)) return;
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  const o = pickAt(e.clientX, e.clientY);
  const armed = chemPanel.armed;
  if (armed) {
    chemPanel.arm(null);
    if (o && locked()) return;
    if (o?.userData.kind === 'vessel') dropEntry(armed.entry, armed.amount, o.userData.view);
    else if (o?.userData.kind === 'lamp') dropOnLamp(armed.entry);
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
  else if (o?.userData.kind === 'lamp') locked() || toggleHeat();
  else if (o?.userData.kind === 'syringe' && !syringePanel.visible && syringeView.syringe.volumeML > 0) syringePanel.show(true);
  else if (o?.userData.kind === 'balance') {
    if (selected && !isOnBalance(selected)) locked() || placeOnBalance(selected);
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
    ? `<b>Cân điện tử</b><br>${fmtG(balanceReading())} g<br><i>${selected && !isOnBalance(selected) ? `Bấm để đặt ${selected.name.toLowerCase()} lên cân` : onBalance.length ? `Đang cân ${onBalance.map((o) => o.name.toLowerCase()).join(" và ")}` : 'Chọn một dụng cụ rồi bấm vào cân'}</i>`
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
    e.preventDefault();
    if (locked()) return;
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
    const o = pickAt(x, y, [...vesselGroups, lamp.group]);
    if (o?.userData.kind === 'lamp') return lamp;
    return o ? (o.userData.view as VesselView) : null;
  },
  hover: (t) => {
    hoverView?.setHover(false);
    hoverView = t instanceof VesselView ? t : null;
    hoverView?.setHover(true);
  },
  drop: (entry, amount, t) => locked() || (t === lamp ? dropOnLamp(entry) : dropEntry(entry, amount, t as VesselView)),
  armChanged: (entry, amount) => {
    if (entry && locked()) return chemPanel.arm(null);
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
  for (const v of views) removeDipped(v);
  syringeView.reset();
  syringePanel.show(false);
  onBalance = [];
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
  burn: (chem) => burnInFlame(CHEMICALS.find((c) => c.key === chem)!.solid!),
  connect: (src, dst) => (dst === null ? disconnect(views[src]) : connect(views[src], dst === SYRINGE ? syringeView : views[dst])),
  invert: (vessel) => invert(views[vessel]),
  weigh: (vessel, off) => (vessel === null ? takeOffBalance() : off ? takeOffBalance(views[vessel]) : placeOnBalance(views[vessel], false)),
  empty: (vessel) => { select(views[vessel]); empty(); },
  pour: (src, dst) => void pourVessel(views[src], views[dst]),
  focus: (vs) => panTo(vs ? vs.map((i) => views[i]) : null),
  resetAll: () => clearLab(),
  setSpeed: (s) => { speed = s; hud.setSpeed(s); },
  simTime: () => simTime,
  busy: () => animator.busy,
  state: {
    mix: (i) => views[i].vessel.mix,
    tempC: (i) => views[i].vessel.mix.tempK - 273.15,
    syringeML: () => syringeView.syringe.volumeML,
    balanceG: balanceReading,
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
    const r = RECIPES.find((x) => x.id === (RECIPE_ALIASES[id] ?? id));
    if (r) void player.play(r);
  },
});

// ── Điện thoại: kho và bảng thông tin là hai ngăn kéo, mỗi lúc mở một ngăn ──
const phone = phoneQuery;
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
  const cur = player.currentScript;
  setRoute(view === 'table'
    ? { view: 'table', element: tableElement ?? undefined }
    : { view: 'lab', tab: cur ? 'recipes' : leftTab, recipe: cur && !cur.shared ? cur.id : undefined, shared: cur?.shared?.data });
}
player.onChange = (r) => {
  if (r && recorder.active) cancelRecording('Đã dừng ghi vì bắt đầu xem một thí nghiệm khác');
  document.body.classList.toggle('recipe-playing', !!r);
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
    if (r.shared) {
      if (player.currentScript?.shared?.data !== r.shared) void playShared(r.shared);
      return;
    }
    const recipe = r.recipe ? RECIPES.find((x) => x.id === (RECIPE_ALIASES[r.recipe!] ?? r.recipe)) : undefined;
    if (recipe && player.currentId !== recipe.id) void player.play(recipe);
  } finally {
    applyingRoute = false;
    syncRoute();
  }
}
window.addEventListener('hashchange', () => applyRoute(parseHash(location.hash)));

// ── Nút "Làm lại": xóa sạch toàn bộ phòng thí nghiệm ─────────────────────
/**
 * Đưa phòng thí nghiệm về như lúc mới mở: dụng cụ, nhật ký, đồng hồ 0:00, tốc độ 1×, góc nhìn,
 * lượng trong kho. Dùng cho nút Làm lại, trước khi ghi và trước khi chạy một thí nghiệm.
 */
function clearLab() {
  resetAll();
  simTime = 0;
  hud.setTime(0);
  speed = 1;
  hud.setSpeed(1);
  select(null);
  chemPanel.reset();
  goHome();
}

// Bấm hai lần để tránh lỡ tay (không dùng hộp thoại confirm của trình duyệt)
{
  const btn = document.getElementById('btn-reset')!;
  const label = btn.querySelector('span')!;
  let armedUntil = 0;
  let timer = 0;
  const disarm = () => {
    armedUntil = 0;
    btn.classList.remove('armed');
    label.textContent = 'Làm lại';
  };
  btn.onclick = () => {
    clearTimeout(timer);
    if (performance.now() > armedUntil) {
      armedUntil = performance.now() + 3000;
      btn.classList.add('armed');
      label.textContent = 'Bấm lần nữa';
      timer = window.setTimeout(disarm, 3000);
      return;
    }
    disarm();
    if (recorder.active) cancelRecording('Đã hủy ghi');
    player.stop();
    clearLab();
    player.toast('Đã làm lại phòng thí nghiệm từ đầu');
  };
}

// ── Thí nghiệm tự làm: ghi thao tác, chia sẻ bằng link ───────────────────
let askPending = false;
const recordBar = new RecordBar({
  predict: () => {
    if (!recorder.active || askPending) return;
    rec({ kind: 'predict' });
    askPending = true;
    updateRecBar();
  },
  finish: finishRecording,
  cancel: () => cancelRecording('Đã hủy ghi'),
});
const shareDialog = new ShareDialog();

function updateRecBar() {
  recordBar.update(recorder.steps().filter((s) => s.kind !== 'wait' && s.kind !== 'predict').length, askPending);
}

function startRecording() {
  if (player.playing) player.stop();
  clearLab();
  recorder.start(simTime);
  askPending = false;
  recordBar.show(true);
  updateRecBar();
  showTab('chem');
  if (phone.matches) setSheet('chem');
  player.toast('Bắt đầu ghi: bàn thí nghiệm đã được dọn sạch');
}
player.onRecord = startRecording;

function cancelRecording(msg: string) {
  recorder.stop(simTime);
  recordBar.show(false);
  player.toast(msg);
}

function finishRecording() {
  const all = recorder.stop(simTime);
  recordBar.show(false);
  // Câu hỏi "đoán xem" phía sau thao tác cuối cùng thì không còn gì để đoán
  let last = -1;
  all.forEach((s, i) => { if (s.kind !== 'wait' && s.kind !== 'predict') last = i; });
  const steps = all.filter((s, i) => s.kind !== 'predict' || i < last);
  if (last < 0) return player.toast('Chưa có thao tác nào để chia sẻ');
  const encode = (title: string) => encodeShare({ version: SHARE_VERSION, title, steps });
  shareDialog.open(steps, {
    preview: async (title) => {
      const data = await encode(title);
      await playShared(data);
    },
    link: async (title) => shareUrl({ view: 'lab', tab: 'recipes', shared: await encode(title) }),
  });
}

/** Mở thí nghiệm được chia sẻ (dữ liệu từ link) và chạy lại */
async function playShared(data: string) {
  try {
    const e = await decodeShare(data);
    showView('lab');
    showTab('recipes');
    if (e.version !== SHARE_VERSION) player.toast('Thí nghiệm này tạo bằng phiên bản cũ của ứng dụng, kết quả có thể hơi khác');
    void player.play(sharedScript(e, data));
  } catch (err) {
    player.toast(`Không mở được thí nghiệm: ${err instanceof ShareError ? err.message : 'link hỏng'}`);
  }
}

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
    updateDipped(v, o.pH, dt);
    updateXCard(v, o.turbidity);
    for (const e of tracker.check(v, o)) hud.log({ ...e, t: simTime });
    if (v === selected) selObs = o;
  }
  for (const t of tubes.values()) t.update();
  syringeView.update(dt);
  syringePanel.record(simTime, syringeView.syringe.volumeML);
  const g = balanceReading();
  balanceView.display(g);
  balancePanel.record(simTime, g);
  hud.panel(selected, selObs, realTime, selected ? xcardText(selected) : undefined);
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
if (startRoute.view === 'lab' && !startRoute.recipe && !startRoute.shared) help.openIfFirstVisit();

// API cho bảng điều khiển trình duyệt / kiểm thử
Object.assign(window, {
  __lab: {
    views,
    select: (i: number) => select(views[i]),
    add: (key: string, amount: number, vessel = 0) =>
      dropEntry(CHEMICALS.find((c) => c.key === key)!, amount, views[vessel]),
    heat: () => toggleHeat(),
    pour: (src: number, dst: number) => pourVessel(views[src], views[dst]),
    weigh: (i: number) => placeOnBalance(views[i], false),
    player,
    recipes: RECIPES,
    setSpeed: (s: number) => { speed = s; hud.setSpeed(s); },
    busy: () => animator.busy,
  },
});
