import * as THREE from 'three';
import { RGB } from '../src';

export function setRGB(c: THREE.Color, rgb: RGB): THREE.Color {
  return c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

export function glassMaterial(tint = 0xffffff, opacity = 0.16): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
}

export const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.75 });
export const darkWood = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.8 });
export const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 });
export const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.7 });

/** Nhãn chữ vẽ bằng canvas */
export function labelTexture(lines: { text: string; size: number; bold?: boolean; color?: string }[], w = 256, h = 160, bg = '#fbf8ef'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9bfa6';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  const total = lines.reduce((s, l) => s + l.size * 1.25, 0);
  let y = (h - total) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const l of lines) {
    ctx.fillStyle = l.color ?? '#1d2430';
    let size = l.size;
    ctx.font = `${l.bold ? '700' : '500'} ${size}px system-ui, sans-serif`;
    while (ctx.measureText(l.text).width > w - 20 && size > 10) {
      size -= 2;
      ctx.font = `${l.bold ? '700' : '500'} ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(l.text, w / 2, y + (l.size - size) / 2);
    y += l.size * 1.25;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Sprite tròn mờ dùng cho hơi nước */
export function softCircleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Nhãn nổi (sprite) luôn quay về phía camera */
export function textSprite(text: string, scale = 1): THREE.Sprite {
  const tex = labelTexture([{ text, size: 44, bold: true }], 192, 72, 'rgba(255,255,255,0.85)');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  s.scale.set(2.7 * scale, 1 * scale, 1);
  return s;
}
