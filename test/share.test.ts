import { describe, expect, it } from 'vitest';
import { RECIPES } from '../web/recipes';
import { cleanTitle, decodeShare, encodeShare, Recorder, SHARE_VERSION, TITLE_MAX } from '../web/share';

const pack = async (s: unknown[], t = 'x') => {
  // Tạo link "giả" do người khác sửa tay: nén JSON tùy ý
  const json = JSON.stringify({ v: 1, t, s });
  const out = new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const b = new Uint8Array(await new Response(out).arrayBuffer());
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('Thí nghiệm tự làm (link chia sẻ)', () => {
  it('ghi thao tác: chèn bước chờ theo thời gian, tua nhanh khi chờ lâu', () => {
    const r = new Recorder();
    r.start(10);
    r.push({ kind: 'add', chem: 'bacl2', amount: 4, vessel: 0 }, 10.2);
    r.push({ kind: 'add', chem: 'na2so4', amount: 4, vessel: 1 }, 15.2);
    r.push({ kind: 'predict' }, 15.5);
    r.push({ kind: 'pour', src: 0, dst: 1 }, 315.5);
    const steps = r.stop(315.5);
    expect(steps.map((s) => s.kind)).toEqual(['add', 'wait', 'add', 'predict', 'wait', 'pour', 'wait']);
    expect(steps[1]).toEqual({ kind: 'wait', seconds: 5 });
    expect(steps[4]).toMatchObject({ kind: 'wait', seconds: 300, speed: 25 });
    expect(r.active).toBe(false);
  });

  it('mã hóa rồi giải mã cho lại đúng các bước, link ngắn', async () => {
    const steps = RECIPES.find((x) => x.id === 'bao-toan-khoi-luong')!.steps.filter((s) => s.kind !== 'say' && s.kind !== 'focus')
      .map((s) => ({ ...s, text: undefined }));
    const data = await encodeShare({ version: SHARE_VERSION, title: 'Bảo toàn khối lượng của em', steps });
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(data.length).toBeLessThan(300);
    const back = await decodeShare(data);
    expect(back.title).toBe('Bảo toàn khối lượng của em');
    expect(back.steps).toEqual(steps.map((s) => {
      const { text: _t, ...rest } = s as typeof s & { until?: unknown };
      delete (rest as { until?: unknown }).until;
      return rest;
    }));
  });

  it('tiêu đề: một dòng, bỏ kí tự điều khiển, tối đa 60 kí tự', () => {
    expect(cleanTitle('  Thử\n\tđun   nóng‮ ')).toBe('Thử đun nóng');
    expect([...cleanTitle('ạ'.repeat(100))].length).toBe(TITLE_MAX);
  });

  it('từ chối link bị sửa: hóa chất lạ, dụng cụ lạ, lượng quá lớn, link hỏng', async () => {
    await expect(decodeShare(await pack([['a', 'thuoc-no', 1, 0]]))).rejects.toThrow('hóa chất');
    await expect(decodeShare(await pack([['a', 'hcl', 2, 9]]))).rejects.toThrow();
    await expect(decodeShare(await pack([['a', 'hcl', 1e6, 0]]))).rejects.toThrow();
    await expect(decodeShare(await pack([['z']]))).rejects.toThrow();
    await expect(decodeShare(await pack([['w', 1e9, 1]]))).rejects.toThrow();
    await expect(decodeShare('abc$%')).rejects.toThrow();
    await expect(decodeShare('AAAA')).rejects.toThrow();
  });

  it('tiêu đề chứa HTML vẫn chỉ là chữ (được làm sạch, hiển thị bằng textContent/esc)', async () => {
    const e = await decodeShare(await pack([['s', 0]], '<img src=x onerror=alert(1)>'));
    expect(e.title).toBe('<img src=x onerror=alert(1)>');
    expect(e.steps).toEqual([{ kind: 'stir', vessel: 0 }]);
  });
});

describe('Thí nghiệm mẫu và thí nghiệm tự làm', () => {
  it('thí nghiệm mẫu hiện kết luận soạn sẵn, thí nghiệm chia sẻ thì không', async () => {
    const { isRecipe } = await import('../web/recipePlayer');
    for (const r of RECIPES) expect(isRecipe(r), r.id).toBe(true);
    expect(isRecipe({ id: 'x', title: 'Tự làm', steps: [], shared: { data: 'abc' } })).toBe(false);
  });
});
