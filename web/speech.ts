/**
 * Chuyển lời thuyết minh (hiển thị) thành văn bản để mô hình TTS đọc.
 * Mô hình tự đọc đúng số, số thập phân và đơn vị ("0,7 g" → "không phẩy bảy gam"),
 * nhưng đọc sai công thức hóa học. Ở đây công thức được đánh vần theo cách đọc quen thuộc ở lớp:
 * NaOH → "nờ a ô hát", H₂SO₄ → "hát hai ét ô bốn", Cu(OH)₂ → "xê u ô hát hai lần".
 */

/** Tên chữ cái theo cách đọc trong giờ Hóa */
const LETTER: Record<string, string> = {
  A: 'a', B: 'bê', C: 'xê', D: 'đê', E: 'e', F: 'ép', G: 'gờ', H: 'hát', I: 'i', J: 'gi', K: 'ca', L: 'lờ',
  M: 'mờ', N: 'nờ', O: 'ô', P: 'pê', Q: 'quy', R: 'rờ', S: 'ét', T: 'tê', U: 'u', V: 'vê', W: 'vê kép',
  X: 'ích', Y: 'i', Z: 'dét',
};

const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
  + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pt Au Hg Tl Pb Bi Po At Rn Fr Ra U').split(' '));

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function readInt(n: number): string {
  if (n < 10) return DIGITS[n];
  if (n < 20) return 'mười' + (n % 10 ? ' ' + (n % 10 === 5 ? 'lăm' : DIGITS[n % 10]) : '');
  const t = Math.floor(n / 10), u = n % 10;
  return `${DIGITS[t]} mươi${u ? ' ' + (u === 1 ? 'mốt' : u === 5 ? 'lăm' : u === 4 ? 'tư' : DIGITS[u]) : ''}`;
}

const spell = (sym: string) => [...sym].map((ch) => LETTER[ch.toUpperCase()]).join(' ');

/**
 * Đánh vần một công thức (đã đổi chỉ số dưới thành chữ số thường). Trả về null nếu không phải công thức.
 * Cho phép hệ số đứng trước (2HCl) và điện tích (Cu2+ viết bằng chỉ số trên, đã bỏ trước khi gọi).
 */
function readFormula(f: string): string | null {
  const m = /^(\d*)(.+)$/.exec(f)!;
  const coef = m[1], body = m[2];
  const out: string[] = [];
  let i = 0, elements = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '(') {
      const close = body.indexOf(')', i);
      if (close < 0) return null;
      const inner = readFormula(body.slice(i + 1, close));
      if (!inner) return null;
      i = close + 1;
      const n = /^\d+/.exec(body.slice(i))?.[0] ?? '';
      i += n.length;
      out.push(inner + (n ? ` ${readInt(Number(n))} lần` : ''));
      elements += 2;
      continue;
    }
    const sym = /^[A-Z][a-z]?/.exec(body.slice(i))?.[0];
    if (!sym) return null;
    // Ưu tiên kí hiệu hai chữ nếu có (Cl, Na…); nếu không thì một chữ (C rồi l…? không hợp lệ)
    let s = sym;
    if (s.length === 2 && !ELEMENTS.has(s)) s = s[0];
    if (!ELEMENTS.has(s)) return null;
    i += s.length;
    elements++;
    const n = /^\d+/.exec(body.slice(i))?.[0] ?? '';
    i += n.length;
    out.push(spell(s) + (n ? ' ' + readInt(Number(n)) : ''));
  }
  if (!elements) return null;
  return (coef ? readInt(Number(coef)) + ' ' : '') + out.join(' ');
}

/** "#2+#" → " hai cộng" */
function chargeText(q: string): string {
  const d = q.slice(1, -2), sign = q[q.length - 2];
  return `${d ? ' ' + readInt(Number(d)) : ''} ${sign === '+' ? 'cộng' : 'trừ'}`;
}

/** Văn bản để đọc */
export function speechText(text: string): string {
  let t = text;
  // Chỉ số dưới → chữ số; điện tích viết bằng chỉ số trên → "#2+#" để nhận ra cùng công thức
  t = t.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
  t = t.replace(/([⁰¹²³⁴-⁹]*)([⁺⁻])/g, (_m, d: string, sign: string) =>
    `#${[...d].map((c) => SUP.indexOf(c)).join('')}${sign === '⁺' ? '+' : '-'}#`);
  // Nồng độ mol: "0,5M" → "0,5 mol trên lít"; tỉ lệ "7 : 4" → "7 trên 4"
  t = t.replace(/(\d)\s?M\b/g, '$1 mol trên lít').replace(/(\d)\s*:\s*(\d)/g, '$1 trên $2');
  // Mũi tên, kí hiệu khí bay lên / kết tủa
  t = t.replace(/\s*→\s*/g, ' tạo thành ').replace(/[↑↓]/g, '');
  // Số La Mã chỉ hóa trị: copper(II) → copper hai
  t = t.replace(/\((I{1,3}|IV|V|VI)\)/g, (_m, r: string) => ' ' + ({ I: 'một', II: 'hai', III: 'ba', IV: 'bốn', V: 'năm', VI: 'sáu' } as Record<string, string>)[r]);
  // Số thứ tự ống: "ống (1)" → "ống số một"
  t = t.replace(/\((\d)\)/g, (_m, d: string) => `số ${DIGITS[Number(d)]}`);
  t = t.replace(/\bpH\b/g, 'pê hát');
  // Công thức: một từ gồm các kí hiệu nguyên tố (có thể kèm hệ số, chỉ số, ngoặc)
  t = t.replace(/(^|[\s(,:;])(\d*(?:[A-Z][a-z]?\d*|\([A-Za-z\d]+\)\d*)+)(#\d*[+-]#)?(?=$|[\s),.:;!?])/g,
    (m, pre: string, f: string, q: string | undefined, at: number, all: string) => {
      const r = readFormula(f);
      if (!r) return m;
      if (q) return pre + r + chargeText(q);
      // Một kí hiệu đơn lẻ không có số (vd. "Ba", "Co" cũng là chữ tiếng Việt) chỉ coi là công thức
      // khi nằm trong ngoặc hoặc đứng cạnh dấu + / "tạo thành" trong phương trình
      if (/^[A-Z][a-z]?$/.test(f) && pre !== '(') {
        const before = all.slice(0, at).trimEnd(), after = all.slice(at + m.length).trimStart();
        const inEq = /(\+|tạo thành)$/.test(before) || /^(\+|tạo thành)/.test(after);
        if (!inEq) return m;
      }
      return pre + r;
    });
  t = t.replace(/#\d*[+-]#/g, (q) => chargeText(q));
  t = t.replace(/\(\s*([^()]*?)\s*\)/g, ', $1,');
  t = t.replace(/\s+\+\s+/g, ' cộng ');
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}

/** Băm FNV-1a 32 bit, dạng hex 8 kí tự (dùng làm khóa / tên file) */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Khóa (tên file) của đoạn đọc: đổi cách chuẩn hóa hay đổi câu đều cho khóa mới */
export const clipKey = (speech: string): string => fnv1a(speech);
