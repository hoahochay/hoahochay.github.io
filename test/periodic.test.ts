import { describe, expect, it } from 'vitest';
import { BY_SYMBOL, ELEMENTS, groupName } from '../web/periodic/elements';
import { chemicalsFor, recipesFor } from '../web/periodic/labLinks';

describe('bảng tuần hoàn', () => {
  it('đủ 118 nguyên tố, mỗi nguyên tố một ô riêng', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(new Set(ELEMENTS.map((e) => `${e.row}:${e.col}`)).size).toBe(118);
    ELEMENTS.forEach((e, i) => expect(e.z).toBe(i + 1));
  });

  it('vị trí và cấu hình electron suy ra đúng (kể cả ngoại lệ)', () => {
    const e = (s: string) => BY_SYMBOL.get(s)!;
    expect([e('Na').period, groupName(e('Na').group)]).toEqual([3, 'IA']);
    expect(groupName(e('Fe').group)).toBe('VIIIB');
    expect(groupName(e('Cl').group)).toBe('VIIA');
    expect(e('Cl').shells).toEqual([2, 8, 7]);
    expect(e('Cr').config).toBe('[Ar] 3d⁵ 4s¹');
    expect(e('Cu').config).toBe('[Ar] 3d¹⁰ 4s¹');
    expect(e('Au').config).toBe('[Xe] 4f¹⁴ 5d¹⁰ 6s¹');
    for (const x of ELEMENTS) expect(x.shells.reduce((a, b) => a + b, 0)).toBe(x.z);
  });

  it('nối với phòng thí nghiệm', () => {
    const ids = (s: string) => recipesFor(s).map((r) => r.id);
    expect(ids('Na')).toEqual(expect.arrayContaining(['na-water', 'alkali-water']));
    expect(ids('K')).toContain('alkali-water');
    expect(ids('Cu')).toEqual(expect.arrayContaining(['metal-activity', 'fe-cu']));
    expect(ids('Ca')).toContain('co2-limewater');
    expect(chemicalsFor('Cu').map((c) => c.key)).toEqual(expect.arrayContaining(['cu', 'cuso4']));
    expect(recipesFor('Og')).toEqual([]);
  });
});
