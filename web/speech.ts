/**
 * Chuyển lời thuyết minh (hiển thị) thành văn bản để mô hình TTS đọc.
 * Tên chất tiếng Anh có công thức trong ngoặc đi kèm ("sodium oxide (Na₂O)"): đọc tên, bỏ phần ngoặc.
 * Tên đứng riêng (lời thuyết minh cũ, chưa rà soát): thay bằng công thức như trước.
 * Công thức, số, đơn vị… để mô hình tự đọc. Chữ hiển thị giữ nguyên.
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
  // Tên chỉ để nhận ra khi có công thức trong ngoặc đi kèm ("phosphorus (P)"); đứng riêng thì đọc nguyên tên
  for (const n of ['phosphorus']) map[n] ??= n;
  return map;
})();

const NAME_RE = new RegExp(`(?<![A-Za-z])(${Object.keys(NAME_FORMULA).sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[()]/g, '\\$&')).join('|')})(?![A-Za-z])`, 'gi');

/**
 * Công thức trong ngoặc viết ngay sau tên chất: "sodium oxide (Na₂O)", "calcium hydroxide (Ca(OH)₂)".
 * Phải bắt đầu bằng chữ in hoa; không nhận số La Mã hóa trị như "(II)".
 */
const FORMULA_PAREN = /\s+\((?!(?:I|II|III|IV|V|VI|VII)\))[A-Z][a-z]?(?:[A-Z][a-z]?|[0-9₀-₉⁰-⁹⁺⁻·]|\((?:[A-Z][a-z]?|[0-9₀-₉])+\)[0-9₀-₉]*)*\)/y;

/**
 * Văn bản để đọc.
 * - "sodium oxide (Na₂O)": đọc tên tiếng Anh, bỏ phần công thức trong ngoặc (chỉ để hiển thị).
 * - Tên đứng riêng, không kèm công thức: thay bằng công thức ("copper(II) sulfate" → "CuSO₄").
 */
export function speechText(text: string): string {
  let out = '', last = 0;
  for (const m of text.matchAll(NAME_RE)) {
    const end = m.index + m[0].length;
    FORMULA_PAREN.lastIndex = end;
    const withFormula = FORMULA_PAREN.test(text);
    out += text.slice(last, m.index) + (withFormula ? m[0] : NAME_FORMULA[m[0].toLowerCase()] ?? m[0]);
    last = withFormula ? FORMULA_PAREN.lastIndex : end;
  }
  return (out + text.slice(last))
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
