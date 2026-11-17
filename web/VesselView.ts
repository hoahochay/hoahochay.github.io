/**
 * Hiển thị 3D của một dụng cụ chứa. Chỉ đọc trạng thái từ engine (Vessel / Observation),
 * không tự quyết định hóa học.
 */
import * as THREE from 'three';
import { FORM_FACTOR, Observation, RGB, species, Vessel, VESSELS, VesselSpec } from '../src';
import { SolidItem } from './catalog';
import { beakerProfile, filledLathe, flaskProfile, glassLathe, Profile, tubeProfile, VolumeMap } from './geometry';
import { glassMaterial, setRGB, softCircleTexture, textSprite } from './materials';

export interface VesselKind {
  type: 'tube' | 'beaker' | 'flask';
  spec: VesselSpec;
  profile: Profile;
  wall: number;
  /** Tỉ lệ kích thước mẫu chất rắn vẽ trong dụng cụ */
  solidScale: number;
}

export const TUBE: VesselKind = { type: 'tube', spec: VESSELS.testTube, profile: tubeProfile(0.75, 15), wall: 0.07, solidScale: 1 };
export const BEAKER: VesselKind = { type: 'beaker', spec: VESSELS.beaker100, profile: beakerProfile(2.6, 7.4), wall: 0.12, solidScale: 1.8 };
export const FLASK: VesselKind = { type: 'flask', spec: VESSELS.flask100, profile: flaskProfile(3.3, 1.1, 7.2, 10.2), wall: 0.1, solidScale: 1.5 };

const MAX_BUBBLES = 180;
const MAX_PARTICLES = 320;
const MAX_STEAM = 28;
/** Số bọt khí hiển thị cho mỗi mL khí thoát ra */
const BUBBLES_PER_ML = 25;
/** Kết tủa mịn: dùng hệ số hình dạng để phân biệt với mẫu chất rắn bỏ vào */
const FINE = FORM_FACTOR.precipitate;

interface Bubble { p: THREE.Vector3; v: number; s: number; phase: number }
interface Steam { sprite: THREE.Sprite; age: number; life: number; vx: number; vz: number }
interface SolidVisual {
  item: SolidItem;
  obj: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[];
  baseColor: THREE.Color;
  mol0: number;
  /** Hệ số kích thước theo khối lượng đã cho vào */
  size: number;
  /** Hộp bao (trước khi co) trong hệ tọa độ của dụng cụ, để sinh bọt khí trên bề mặt */
  box: THREE.Box3;
  vel: THREE.Vector2;
  /** Ngọn lửa trên mẩu kim loại (K bốc cháy màu tím hồng) */
  flame?: THREE.Sprite;
}

const steamTex = softCircleTexture();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

export class VesselView {
  /** Gốc tọa độ = đáy trong của dụng cụ */
  readonly group = new THREE.Group();
  vessel: Vessel;
  readonly vmap: VolumeMap;
  readonly label: THREE.Sprite;
  home = new THREE.Vector3();
  heating = false;
  liquidH = 0;

  private selected = false;
  private hovered = false;
  private readonly liquid: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  private readonly sediment: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly depositHeap: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private readonly solids = new Map<string, SolidVisual>();
  private sedimentH = 0;
  private time = 0;

  private readonly bubbleMesh: THREE.InstancedMesh;
  private readonly bubbles: Bubble[] = [];
  private bubbleAcc = 0;
  private readonly particleMesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly particles: THREE.Vector3[] = [];
  private readonly steam: Steam[] = [];
  private steamAcc = 0;

  constructor(readonly kind: VesselKind, readonly name: string, labelText: string) {
    this.vessel = new Vessel(kind.spec);
    this.vmap = new VolumeMap(kind.profile);
    const p = kind.profile;
    this.group.userData = { kind: 'vessel', view: this };

    const glass = new THREE.Mesh(glassLathe(p, kind.wall), glassMaterial());
    glass.renderOrder = 3;
    this.group.add(glass);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(p.radius(p.height) + kind.wall / 2, kind.wall * 0.9, 8, 40),
      glassMaterial(0xffffff, 0.35),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = p.height;
    rim.renderOrder = 3;
    this.group.add(rim);
    if (kind.type === 'beaker') this.addGraduations();

    this.liquid = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshPhysicalMaterial({
        transparent: true, roughness: 0.08, metalness: 0, depthWrite: false,
        side: THREE.DoubleSide, envMapIntensity: 0.8,
      }),
    );
    this.liquid.renderOrder = 2;
    this.group.add(this.liquid);

    this.sediment = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    this.sediment.visible = false;
    this.group.add(this.sediment);

    this.depositHeap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 1, 1, 18).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }),
    );
    this.depositHeap.visible = false;
    this.group.add(this.depositHeap);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(p.radius(p.height) + kind.wall + 0.12, 0.07, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x2f8cff }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = p.height;
    this.ring.visible = false;
    this.group.add(this.ring);

    this.bubbleMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
      MAX_BUBBLES,
    );
    this.bubbleMesh.count = 0;
    this.bubbleMesh.renderOrder = 1;
    this.bubbleMesh.frustumCulled = false;
    this.group.add(this.bubbleMesh);

    this.particleMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 1 }),
      MAX_PARTICLES,
    );
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.group.add(this.particleMesh);

    // Vùng nhận chuột rộng hơn thủy tinh, để bấm chọn / thả hóa chất dễ trúng
    const hitR = p.radius(p.height) + (kind.type === 'tube' ? 1.0 : 0.6);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(hitR, hitR, p.height + 3, 12).translate(0, (p.height + 3) / 2 - 0.5, 0));
    hit.visible = false;
    this.group.add(hit);

    this.label = textSprite(labelText, kind.type === 'beaker' ? 1.1 : 0.9);
    this.label.position.y = p.height + 1.6;
    this.group.add(this.label);
  }

  get capacityML(): number {
    return Math.min(this.kind.spec.capacityL * 1000, this.vmap.capacityML * 0.95);
  }

  /** Miệng dụng cụ, tọa độ thế giới */
  mouthWorld(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0, this.kind.profile.height, 0));
  }

  /** Mặt chất lỏng, tọa độ thế giới */
  surfaceWorld(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0, Math.max(this.liquidH, 0.2), 0));
  }

  /** Đầu ống dẫn khí khi lắp vào dụng cụ này (tọa độ cục bộ) */
  inletLocal(): THREE.Vector3 {
    const h = this.kind.profile.height;
    if (this.vessel.inverted) return new THREE.Vector3(0, h - 3, 0);
    return new THREE.Vector3(this.kind.type === 'tube' ? 0.2 : 0.8, this.kind.type === 'tube' ? 0.6 : 0.5, 0);
  }

  inletWorld(): THREE.Vector3 {
    return this.group.localToWorld(this.inletLocal());
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.updateRing();
  }

  /** Đang kéo hóa chất qua dụng cụ này */
  setHover(on: boolean): void {
    this.hovered = on;
    this.updateRing();
  }

  private updateRing(): void {
    this.ring.visible = this.selected || this.hovered;
    this.ring.material.color.set(this.hovered ? 0x22b35e : 0x2f8cff);
  }

  /** Đổ bỏ: tạo dụng cụ mới, xóa mọi hiển thị */
  reset(): void {
    this.vessel = new Vessel(this.kind.spec);
    for (const v of this.solids.values()) {
      this.group.remove(v.obj);
      if (v.flame) this.group.remove(v.flame);
    }
    this.solids.clear();
    this.bubbles.length = 0;
    this.particles.length = 0;
    this.depositHeap.visible = false;
  }

  hasSolidVisual(id: string): boolean {
    return this.solids.has(id);
  }

  /** Thêm mô hình 3D cho mẩu chất rắn vừa bỏ vào */
  addSolidVisual(item: SolidItem, grams = item.grams): void {
    const size = THREE.MathUtils.clamp(Math.cbrt(grams / item.grams), 0.5, 1.6);
    const existing = this.solids.get(item.id);
    if (existing && existing.item.shape === item.shape) {
      existing.mol0 = Math.max(existing.mol0, this.vessel.mix.get(item.id));
      existing.size = Math.max(existing.size, size);
      return;
    }
    if (existing) this.group.remove(existing.obj);
    if (existing?.flame) this.group.remove(existing.flame);
    const { obj, mats } = buildSolid(item, this.kind);
    let flame: THREE.Sprite | undefined;
    if (item.flame) {
      flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: steamTex, color: item.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      flame.renderOrder = 5;
      flame.visible = false;
      this.group.add(flame);
    }
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    this.group.add(obj);
    this.solids.set(item.id, {
      item, obj, mats, box, size, baseColor: mats[0].color.clone(),
      mol0: this.vessel.mix.get(item.id),
      vel: new THREE.Vector2((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
      flame,
    });
  }

  update(o: Observation, dt: number, speed: number): void {
    this.time += dt;
    const p = this.kind.profile;
    if (this.selected) this.ring.scale.setScalar(1 + 0.04 * Math.sin(this.time * 5));

    // ── Chất lỏng ──
    const h = this.vmap.heightFor(o.volumeML);
    if (Math.abs(h - this.liquidH) > 0.004) {
      this.liquidH = h;
      this.liquid.geometry.dispose();
      this.liquid.geometry = h > 0.02 ? filledLathe(p, 0, h, 0.01) : new THREE.BufferGeometry();
    }
    this.liquid.visible = h > 0.02;
    const c = o.appearance;
    const strength = 1 - Math.min(...c);
    setRGB(this.liquid.material.color, [c[0] * 0.93, c[1] * 0.97, c[2]]);
    this.liquid.material.opacity = Math.min(0.94, 0.2 + 0.6 * strength + 0.75 * o.turbidity);

    this.updateSediment(o);
    this.updateSolids(o, dt);
    this.updateBubbles(o, dt, speed);
    this.updateParticles(o, dt);
    this.updateSteam(o, dt);
  }

  private updateSediment(o: Observation): void {
    let grams = 0;
    const col: RGB = [0, 0, 0];
    for (const s of o.solids) {
      if ((this.vessel.mix.formFactor.get(s.id) ?? 0) < FINE) continue;
      const g = s.grams * (1 - s.suspended);
      grams += g;
      for (let i = 0; i < 3; i++) col[i] += g * s.color[i];
    }
    // kết tủa xốp: khoảng 1,5 mL cho mỗi gam
    const hs = this.vmap.heightFor(grams * 1.5);
    if (Math.abs(hs - this.sedimentH) > 0.004) {
      this.sedimentH = hs;
      this.sediment.geometry.dispose();
      this.sediment.geometry = hs > 0.01 ? filledLathe(this.kind.profile, 0, hs, 0.015) : new THREE.BufferGeometry();
    }
    this.sediment.visible = hs > 0.01;
    if (grams > 0) setRGB(this.sediment.material.color, col.map((x) => x / grams) as RGB);
  }

  private updateSolids(o: Observation, dt: number): void {
    const mix = this.vessel.mix;
    // Kim loại sinh ra (Cu, Ag) không có mô hình riêng: vẽ thành lớp bám trên kim loại khác
    let depositG = 0;
    const depositCol: RGB = [0, 0, 0];
    for (const s of o.solids) {
      if (this.solids.has(s.id) || (mix.formFactor.get(s.id) ?? 0) >= FINE) continue;
      depositG += s.grams;
      for (let i = 0; i < 3; i++) depositCol[i] += s.grams * s.color[i];
    }
    if (depositG > 0) for (let i = 0; i < 3; i++) depositCol[i] /= depositG;

    let substrate = false;
    for (const v of this.solids.values()) {
      const n = mix.get(v.item.id);
      v.obj.visible = n > v.mol0 * 1e-3;
      if (!v.obj.visible) continue;
      const k = v.size * Math.max(0.12, Math.cbrt(n / v.mol0));
      v.obj.scale.setScalar(k);
      const metallic = ['ribbon', 'nail', 'wire', 'granule'].includes(v.item.shape);
      if (metallic && depositG > 0) {
        substrate = true;
        const f = Math.min(0.85, depositG / (0.04 * this.kind.solidScale ** 2));
        setRGB(tmpC, depositCol);
        for (const m of v.mats) m.color.copy(v.baseColor).lerp(tmpC, f);
      }
      if (v.item.floats) {
        // Mẩu sodium nổi, chạy trên mặt nước khi phản ứng
        const r = this.kind.profile.radius(this.liquidH) - 0.35 * this.kind.solidScale;
        const active = (o.gasRateML.H2 ?? 0) > 0.01;
        if (active) {
          v.vel.rotateAround(new THREE.Vector2(), (Math.random() - 0.5) * 6 * dt);
          v.obj.position.x += v.vel.x * dt * 1.5;
          v.obj.position.z += v.vel.y * dt * 1.5;
          const d = Math.hypot(v.obj.position.x, v.obj.position.z);
          if (d > r && d > 0) {
            v.obj.position.x *= r / d;
            v.obj.position.z *= r / d;
            v.vel.multiplyScalar(-1);
          }
          v.obj.rotation.y += dt * 4;
        }
        v.obj.position.y = Math.max(0.2, this.liquidH - 0.08);
        if (v.flame) {
          // Phản ứng đủ mạnh thì nhiệt tỏa ra làm H2 bốc cháy ngay trên mẩu kim loại
          const burning = active && (o.gasRateML.H2 ?? 0) > 0.8;
          v.flame.visible = burning && v.obj.visible;
          if (v.flame.visible) {
            const f = 1 + 0.25 * Math.sin(this.time * 31) + 0.15 * Math.sin(this.time * 17);
            v.flame.position.set(v.obj.position.x, v.obj.position.y + 0.45 * this.kind.solidScale, v.obj.position.z);
            v.flame.scale.set(0.7 * this.kind.solidScale, 1.2 * f * this.kind.solidScale, 1);
            v.flame.material.opacity = 0.85;
          }
        }
      }
    }
    // Không còn kim loại nền: kim loại sinh ra nằm thành đống dưới đáy
    this.depositHeap.visible = depositG > 1e-4 && !substrate;
    if (this.depositHeap.visible) {
      const s = Math.cbrt(depositG / 0.1) * 0.5 * this.kind.solidScale;
      this.depositHeap.scale.set(Math.min(s, this.kind.profile.radius(0.3) * 0.9 + 0.2), s * 0.35, Math.min(s, 2));
      setRGB(this.depositHeap.material.color, depositCol);
    }
  }

  private bubbleSource(): THREE.Vector3 {
    const vis = [...this.solids.values()].filter((v) => v.obj.visible);
    const p = this.kind.profile;
    if (vis.length && Math.random() < 0.85) {
      const v = vis[Math.floor(Math.random() * vis.length)];
      if (v.item.floats) {
        return new THREE.Vector3(v.obj.position.x, this.liquidH - 0.3, v.obj.position.z);
      }
      const b = v.box;
      const k = v.obj.scale.x;
      const base = v.obj.position;
      const pt = new THREE.Vector3(
        THREE.MathUtils.lerp(b.min.x, b.max.x, Math.random()),
        THREE.MathUtils.lerp(b.min.y, b.max.y, Math.random()),
        THREE.MathUtils.lerp(b.min.z, b.max.z, Math.random()),
      ).sub(base).multiplyScalar(k).add(base);
      return pt;
    }
    const y = Math.random() * Math.min(0.4, this.liquidH);
    const r = Math.max(0.05, p.radius(y + 0.3) * 0.8) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y + 0.1, Math.sin(a) * r);
  }

  private updateBubbles(o: Observation, dt: number, speed: number): void {
    const gasML = Object.values(o.gasRateML).reduce((a, b) => a + b, 0);
    // Khí sục vào từ ống dẫn: bọt to hơn, xuất phát từ đầu ống
    const inML = this.liquidH > this.inletLocal().y + 0.2 ? o.inletRateML : 0;
    let rate = Math.min(160, (gasML + inML * 0.4) * Math.max(1, speed) * BUBBLES_PER_ML);
    if (o.boiling) rate += 70;
    if (this.liquidH < 0.15) rate = 0;
    this.bubbleAcc += rate * dt;
    while (this.bubbleAcc >= 1 && this.bubbles.length < MAX_BUBBLES) {
      this.bubbleAcc -= 1;
      const fromInlet = inML > 0 && Math.random() * (gasML + inML * 0.4) < inML * 0.4;
      const big = (o.boiling && Math.random() < 0.5) || fromInlet;
      this.bubbles.push({
        p: fromInlet
          ? this.inletLocal().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.1, (Math.random() - 0.5) * 0.1))
          : this.bubbleSource(),
        v: 3 + Math.random() * 4,
        s: (big ? 0.1 + Math.random() * 0.1 : 0.03 + Math.random() * 0.06) * Math.min(1.4, this.kind.solidScale),
        phase: Math.random() * 10,
      });
    }
    if (this.bubbleAcc > 1) this.bubbleAcc = 0;
    const p = this.kind.profile;
    let n = 0;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.p.y += b.v * dt;
      b.phase += dt * 9;
      const r = p.radius(Math.min(b.p.y, this.liquidH)) - b.s - 0.02;
      b.p.x += Math.sin(b.phase) * 0.15 * dt;
      const d = Math.hypot(b.p.x, b.p.z);
      if (d > r && d > 0) {
        b.p.x *= r / d;
        b.p.z *= r / d;
      }
      if (b.p.y > this.liquidH - b.s * 0.5) {
        this.bubbles.splice(i, 1);
        continue;
      }
    }
    for (const b of this.bubbles) {
      tmpM.compose(b.p, tmpQ.identity(), tmpS.setScalar(b.s));
      this.bubbleMesh.setMatrixAt(n++, tmpM);
    }
    this.bubbleMesh.count = n;
    this.bubbleMesh.instanceMatrix.needsUpdate = true;
  }

  private randomPointInLiquid(): THREE.Vector3 {
    const y = Math.max(0.05, this.sedimentH) + Math.random() * Math.max(0.05, this.liquidH - this.sedimentH - 0.1);
    const r = Math.max(0.05, this.kind.profile.radius(y) - 0.08) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  }

  private updateParticles(o: Observation, dt: number): void {
    let grams = 0;
    const col: RGB = [0, 0, 0];
    for (const s of o.solids) {
      if ((this.vessel.mix.formFactor.get(s.id) ?? 0) < FINE) continue;
      const g = s.grams * s.suspended;
      grams += g;
      for (let i = 0; i < 3; i++) col[i] += g * s.color[i];
    }
    const target = this.liquidH > 0.2 ? Math.min(MAX_PARTICLES, Math.round(grams * 4000 / this.kind.solidScale)) : 0;
    while (this.particles.length < target) this.particles.push(this.randomPointInLiquid());
    this.particles.length = Math.min(this.particles.length, target);
    if (grams > 0) setRGB(this.particleMesh.material.color, col.map((x) => x / grams) as RGB);
    const s = 0.035 * Math.min(1.5, this.kind.solidScale);
    let n = 0;
    for (const pt of this.particles) {
      pt.y -= 0.08 * dt;
      pt.x += (Math.random() - 0.5) * 0.06 * dt * 10;
      pt.z += (Math.random() - 0.5) * 0.06 * dt * 10;
      if (pt.y < this.sedimentH + 0.03 || Math.hypot(pt.x, pt.z) > this.kind.profile.radius(pt.y) - 0.05) {
        pt.copy(this.randomPointInLiquid());
      }
      tmpM.compose(pt, tmpQ.identity(), tmpS.setScalar(s));
      this.particleMesh.setMatrixAt(n++, tmpM);
    }
    this.particleMesh.count = n;
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  private updateSteam(o: Observation, dt: number): void {
    const p = this.kind.profile;
    const rate = this.liquidH > 0.1 ? (o.boiling ? 16 : Math.max(0, (o.tempC - 50) / 50) * 7) : 0;
    this.steamAcc += rate * dt;
    while (this.steamAcc >= 1) {
      this.steamAcc -= 1;
      let s = this.steam.find((x) => !x.sprite.visible);
      if (!s && this.steam.length < MAX_STEAM) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
        sprite.renderOrder = 4;
        this.group.add(sprite);
        s = { sprite, age: 0, life: 1, vx: 0, vz: 0 };
        this.steam.push(s);
      }
      if (!s) break;
      const r = p.radius(p.height) * 0.6;
      s.sprite.visible = true;
      s.sprite.position.set((Math.random() - 0.5) * r, p.height + 0.1, (Math.random() - 0.5) * r);
      s.age = 0;
      s.life = 1.8 + Math.random() * 1.2;
      s.vx = (Math.random() - 0.5) * 0.6;
      s.vz = (Math.random() - 0.5) * 0.6;
    }
    for (const s of this.steam) {
      if (!s.sprite.visible) continue;
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        s.sprite.visible = false;
        continue;
      }
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.z += s.vz * dt;
      s.sprite.position.y += 2.2 * dt;
      const size = (0.6 + t * 2.4) * Math.min(1.6, this.kind.solidScale);
      s.sprite.scale.set(size, size, 1);
      s.sprite.material.opacity = 0.35 * Math.sin(Math.PI * t);
    }
  }

  private addGraduations(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const r = this.kind.profile.radius(1) + this.kind.wall + 0.005;
    for (let mL = 20; mL <= 100; mL += 20) {
      const y = this.vmap.heightFor(mL);
      const w = mL % 40 === 0 ? 0.5 : 0.3;
      const g = new THREE.CylinderGeometry(r, r, 0.04, 16, 1, true, -w / 2 - Math.PI / 2, w);
      const m = new THREE.Mesh(g, mat);
      m.position.y = y;
      this.group.add(m);
    }
  }
}

// ── Mô hình mẫu chất rắn ─────────────────────────────────────────────────

function solidMaterial(id: string, shape: SolidItem['shape']): THREE.MeshStandardMaterial {
  const col = new THREE.Color();
  setRGB(col, species(id).color ?? [0.8, 0.8, 0.8]);
  const metallic = shape === 'ribbon' || shape === 'nail' || shape === 'wire' || (shape === 'granule' && id !== 'CaCO3');
  return new THREE.MeshStandardMaterial({
    color: col,
    metalness: metallic ? 0.75 : 0,
    roughness: metallic ? 0.35 : 0.9,
  });
}

/** Gốc tọa độ của mỗi mẫu nằm ở đáy, để co lại vẫn nằm sát đáy */
function buildSolid(item: SolidItem, kind: VesselKind): { obj: THREE.Object3D; mats: THREE.MeshStandardMaterial[] } {
  const s = kind.solidScale;
  const mat = solidMaterial(item.id, item.shape);
  const p = kind.profile;
  const obj = new THREE.Group();
  const add = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    obj.add(m);
    return m;
  };
  switch (item.shape) {
    case 'ribbon': {
      add(new THREE.BoxGeometry(0.28 * s, 4.2 * s, 0.03).translate(0, 2.1 * s, 0));
      obj.position.set(0.1, 0.15, 0);
      obj.rotation.z = 0.12;
      break;
    }
    case 'nail': {
      add(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 5.6 * s, 12).translate(0, 3.0 * s, 0));
      add(new THREE.ConeGeometry(0.11 * s, 0.4 * s, 12).rotateX(Math.PI).translate(0, 0.2 * s, 0));
      add(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.08 * s, 16).translate(0, 5.84 * s, 0));
      obj.position.set(0, 0.05, 0);
      obj.rotation.z = 0.06;
      break;
    }
    case 'wire': {
      const r = 0.36 * s;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const a = t * Math.PI * 2 * 7;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0.5 + t * 4.5 * s, Math.sin(a) * r));
      }
      pts.push(new THREE.Vector3(0, 6.5 * s, 0), new THREE.Vector3(0, 9.5 * s, 0));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.045 * s, 6));
      break;
    }
    case 'granule': {
      const g = new THREE.IcosahedronGeometry(0.4 * s, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const k = 0.8 + Math.random() * 0.35;
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      add(g.translate(0, 0.34 * s, 0));
      obj.position.y = p.bottomZone > 0 ? 0.08 : 0;
      obj.rotation.y = Math.random() * 6;
      break;
    }
    case 'chunk': {
      add(new THREE.BoxGeometry(0.45 * s, 0.32 * s, 0.4 * s));
      obj.position.set(0.1, 1, 0);
      break;
    }
    case 'powder': {
      const r = Math.min(p.radius(0.25) * 0.95, 0.9 * s);
      add(new THREE.CylinderGeometry(0.04, r, 0.28 * s, 20).translate(0, 0.14 * s, 0));
      obj.position.y = p.bottomZone > 0 ? 0.05 : 0;
      break;
    }
  }
  return { obj, mats: [mat] };
}
