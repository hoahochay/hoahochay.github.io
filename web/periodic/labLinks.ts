/** Nối bảng tuần hoàn với phòng thí nghiệm: hóa chất trong kho và thí nghiệm mẫu có chứa mỗi nguyên tố */
import { ChemEntry, CHEMICALS } from '../catalog';
import { Recipe, RECIPES } from '../recipes';

const SYMBOL = /[A-Z][a-z]?/g;

/** Các kí hiệu nguyên tố trong một công thức (bỏ qua chỉ số, điện tích, chữ thường tiếng Việt) */
export function symbolsIn(formula: string): Set<string> {
  return new Set(formula.match(SYMBOL) ?? []);
}

/** Chất có id không phải công thức hóa học (tên chất hữu cơ, viết tắt): ghi rõ nguyên tố */
const ELEMENTS_OF_ID: Record<string, string[]> = {
  starch: ['C', 'H', 'O'], glucose: ['C', 'H', 'O'], saccharose: ['C', 'H', 'O'], glycerol: ['C', 'H', 'O'],
  cellulose: ['C', 'H', 'O'], cellulose_nitrate: ['C', 'H', 'O', 'N'], triolein: ['C', 'H', 'O'],
  carotene: ['C', 'H'], protein: ['C', 'H', 'O', 'N', 'S'], H3Cit: ['C', 'H', 'O'], VitC: ['C', 'H', 'O'],
  // Cánh hoa: vật liệu tự nhiên, không tính là một hóa chất có công thức
  petal: [],
};

/** Nguyên tố trong một chất, theo id của chất trong engine */
function elementsOfId(id: string): string[] {
  return ELEMENTS_OF_ID[id] ?? [...symbolsIn(id)];
}

/** Nguyên tố có trong một hóa chất của kho (không tính nước dung môi) */
export function elementsOf(e: ChemEntry): Set<string> {
  if (e.solid) return new Set(elementsOfId(e.solid.id));
  if (e.reagent && !e.reagent.indicator) {
    if (e.key === 'water') return new Set(['H', 'O']);
    const s = new Set<string>();
    // Chất lỏng hữu cơ (hexane, ester, dầu ăn…) là dung môi, không nằm trong danh sách chất tan
    const ids = [...Object.keys(e.reagent.solutes), ...(e.reagent.organic ? [e.reagent.organic] : [])];
    for (const f of ids) for (const x of elementsOfId(f)) s.add(x);
    return s;
  }
  return new Set();
}

export function chemicalsFor(symbol: string): ChemEntry[] {
  return CHEMICALS.filter((e) => elementsOf(e).has(symbol));
}

const byKey = new Map(CHEMICALS.map((e) => [e.key, e]));

/** Thí nghiệm mẫu liên quan, xếp theo mức độ liên quan (nguyên tố là chất rắn được cho vào, có trong nhiều phương trình) */
export function recipesFor(symbol: string): Recipe[] {
  const scored: [Recipe, number][] = [];
  for (const r of RECIPES) {
    let score = 0;
    for (const s of r.steps) {
      if (s.kind !== 'add') continue;
      const e = byKey.get(s.chem);
      if (!e || !elementsOf(e).has(symbol)) continue;
      score += e.solid ? 3 : e.key === 'water' ? 0.2 : 1;
    }
    for (const eq of r.result.equations) if (symbolsIn(eq).has(symbol)) score += 1;
    if (score >= 1) scored.push([r, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([r]) => r);
}

/** Nguyên tố có ít nhất một thí nghiệm mẫu */
export function hasExperiment(symbol: string): boolean {
  return recipesFor(symbol).length > 0;
}
