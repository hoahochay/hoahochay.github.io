/** Nối bảng tuần hoàn với phòng thí nghiệm: hóa chất trong kho và thí nghiệm mẫu có chứa mỗi nguyên tố */
import { ChemEntry, CHEMICALS } from '../catalog';
import { Recipe, RECIPES } from '../recipes';

const SYMBOL = /[A-Z][a-z]?/g;

/** Các kí hiệu nguyên tố trong một công thức (bỏ qua chỉ số, điện tích, chữ thường tiếng Việt) */
export function symbolsIn(formula: string): Set<string> {
  return new Set(formula.match(SYMBOL) ?? []);
}

/** Nguyên tố có trong một hóa chất của kho (không tính nước dung môi) */
export function elementsOf(e: ChemEntry): Set<string> {
  if (e.solid) return symbolsIn(e.solid.id);
  if (e.reagent && !e.reagent.indicator) {
    if (e.key === 'water') return new Set(['H', 'O']);
    const s = new Set<string>();
    for (const f of Object.keys(e.reagent.solutes)) for (const x of symbolsIn(f)) s.add(x);
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
