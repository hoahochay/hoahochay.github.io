/**
 * Chuyển lời thuyết minh thành văn bản để đọc, và thành chữ hiển thị.
 * - Tên chất đánh dấu tay ⟦tên tiếng Anh|công thức⟧: hiển thị "tên (công thức)"; khi đọc, phần tên
 *   do mô hình tiếng Anh đọc (scripts/tts.py ghép vào câu), bỏ công thức.
 * - Tên tiếng Việt theo SGK ⟦sắt|Fe|vi⟧: hiển thị "sắt (Fe)"; mô hình tiếng Việt đọc "sắt" liền trong câu.
 * - Phần còn lại do mô hình tiếng Việt đọc. Tên tiếng Anh đứng riêng (không đánh dấu) được thay bằng
 *   công thức, vì mô hình tiếng Việt đọc tên tiếng Anh không thống nhất.
 */
import { SPECIES } from '../src';
import { CHEMICALS } from './catalog';

const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "SO4^2-" (mã chất trong engine) → "SO₄²⁻" */
function idToDisplay(id: string): string {
  const m = /^(.*?)(?:\^?(\d*)([+-]))?$/.exec(id.replace(/\(g\)$/, ''))!;
  const body = m[1].replace(/\d/g, (d) => SUB[Number(d)]);
  return m[3] ? body + [...(m[2] ?? '')].map((d) => SUP[Number(d)]).join('') + (m[3] === '+' ? '⁺' : '⁻') : body;
}

/** Tên tiếng Anh (IUPAC, chữ thường) → công thức */
const NAME_FORMULA: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const put = (name: string, formula: string) => {
    const n = name.toLowerCase().replace(/ (loãng|\((dải|bột|mẩu)\))$/, '').trim();
    // Chỉ nhận tên tiếng Anh: không dấu tiếng Việt, ngoặc chỉ dùng cho hóa trị (II)
    if (!/^[a-z ]+(\((i|ii|iii|iv)\)[a-z ]*)?$/.test(n) || n === formula.toLowerCase()) return;
    map[n] ??= formula;
  };
  for (const c of CHEMICALS) if (c.kind === 'solution' || c.kind === 'solid') put(c.title, c.formula);
  for (const sp of Object.values(SPECIES)) {
    // Tên ion giữ chữ "ion" phía trước: "ion hydroxide" → "ion OH⁻"
    if (sp.name.startsWith('ion ')) {
      if (/^ion [a-z]+$/.test(sp.name)) map[sp.name] = `ion ${idToDisplay(sp.id)}`;
    } else put(sp.name.replace(/^khí /, ''), idToDisplay(sp.id));
  }
  Object.assign(map, {
    'magnesium oxide': 'MgO', 'copper(ii) oxide': 'CuO', 'calcium hydroxide': 'Ca(OH)₂', 'zinc chloride': 'ZnCl₂',
    'sodium sulfate': 'Na₂SO₄', 'sodium acetate': 'CH₃COONa', 'iron(ii) chloride': 'FeCl₂', 'hydrogen': 'H₂', 'oxygen': 'O₂', 'citric acid': 'C₆H₈O₇', 'calcium hydrogencarbonate': 'Ca(HCO₃)₂',
  });
  return map;
})();

const NAME_RE = new RegExp(`(?<![A-Za-z])(${Object.keys(NAME_FORMULA).sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[()]/g, '\\$&')).join('|')})(?![A-Za-z])`, 'gi');

/**
 * Tên chất đánh dấu: ⟦sodium oxide|Na₂O⟧ (đọc bằng mô hình tiếng Anh), ⟦sắt|Fe|vi⟧ (tên tiếng Việt, đọc
 * bằng mô hình tiếng Việt). Công thức không bắt buộc: ⟦sodium oxide⟧.
 */
const TAG = /⟦([^⟦⟧|]+)(?:\|([^⟦⟧|]+))?(\|vi)?⟧/g;

/** Chữ hiển thị: ⟦sodium oxide|Na₂O⟧ → "sodium oxide (Na₂O)", ⟦sắt|Fe|vi⟧ → "sắt (Fe)" */
export function displayText(text: string): string {
  return text.replace(TAG, (_m, name: string, formula?: string) => (formula ? `${name} (${formula})` : name));
}

/**
 * Văn bản để đọc. Tên đánh dấu giữ dạng ⟦tên⟧ (bỏ công thức) để scripts/tts.py đọc bằng mô hình tiếng Anh;
 * câu không có đánh dấu cho kết quả như trước khi có đánh dấu (giữ khóa các file đã tạo).
 */
export function speechText(text: string): string {
  let out = '', vi = '', last = 0;
  for (const m of text.matchAll(TAG)) {
    vi += text.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[3]) vi += m[1]; // tên tiếng Việt: đọc liền trong phần tiếng Việt
    else {
      out += viSpeech(vi) + `⟦${m[1].trim()}⟧`;
      vi = '';
    }
  }
  return out + viSpeech(vi + text.slice(last));
}

/** Phần đọc bằng mô hình tiếng Việt: thay tên tiếng Anh bằng công thức ("copper(II) sulfate" → "CuSO₄") */
function viSpeech(text: string): string {
  return text.replace(NAME_RE, (m) => NAME_FORMULA[m.toLowerCase()] ?? m)
    // Ngoại lệ duy nhất: mô hình đọc "Mg" đứng riêng (Mg, 2Mg, Mg(OH)₂) thành "mi li gam"; MgO thì đọc đúng
    .replace(/(\d?)(?<![A-Za-z])Mg(?![A-Za-z])/g, (_m, d: string) => `${d ? d + ' ' : ''}mờ gờ`)
    // Số thứ tự trong ngoặc: "ống (1)" bị đọc ngắt thành "ống, một"; bỏ ngoặc để đọc liền "ống một"
    .replace(/\s*\((\d+)\)/g, ' $1');
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
