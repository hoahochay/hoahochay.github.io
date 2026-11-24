import { describe, expect, it } from 'vitest';
import { describeStep } from '../web/narration';
import { RECIPES } from '../web/recipes';
import { displayText, speechText } from '../web/speech';

describe('speechText', () => {
  it('thay tên tiếng Anh bằng công thức, giữ nguyên phần còn lại', () => {
    expect(speechText('Ống (2): lấy 2 mL dung dịch copper(II) sulfate.')).toBe('Ống 2: lấy 2 mL dung dịch CuSO₄.');
    expect(speechText('Magnesium cháy tạo thành magnesium oxide.')).toBe('mờ gờ cháy tạo thành MgO.');
    expect(speechText('khí hydrogen, ion hydroxide, hydrochloric acid')).toBe('khí H₂, ion OH trừ, HCl');
    expect(speechText('kết tủa copper(II) hydroxide')).toBe('kết tủa Cu(OH)₂');
  });
  it('ngoại lệ Mg: đọc "mờ gờ" khi đứng riêng', () => {
    expect(speechText('2Mg + O₂ → 2MgO')).toBe('2 mờ gờ + O₂ → 2MgO');
    expect(speechText('kết tủa Mg(OH)₂')).toBe('kết tủa mờ gờ(OH)₂');
  });
  it('bỏ ngoặc quanh số thứ tự ống', () => {
    expect(speechText('ở ống (1) và ống (3).')).toBe('ở ống 1 và ống 3.');
  });
  it('tên đánh dấu ⟦tên|công thức⟧: đọc bằng mô hình tiếng Anh, bỏ công thức', () => {
    expect(speechText('Ống (1): thêm một ít ⟦sodium oxide|Na₂O⟧.')).toBe('Ống 1: thêm một ít ⟦sodium oxide⟧.');
    expect(speechText('tạo ⟦magnesium hydroxide|Mg(OH)₂⟧ ít tan, khác magnesium oxide')).toBe('tạo ⟦magnesium hydroxide⟧ ít tan, khác MgO');
    expect(speechText('⟦copper(II) sulfate⟧ và Mg')).toBe('⟦copper(II) sulfate⟧ và mờ gờ');
  });
  it('tên tiếng Việt ⟦sắt|Fe|vi⟧: hiện công thức, đọc bằng mô hình tiếng Việt', () => {
    expect(displayText('Cho một đinh ⟦sắt|Fe|vi⟧ vào ống (1).')).toBe('Cho một đinh sắt (Fe) vào ống (1).');
    // Câu chỉ có tên tiếng Việt đọc y như khi chưa đánh dấu (giữ file đã tạo)
    expect(speechText('Cho một đinh ⟦sắt|Fe|vi⟧ vào ống (1).')).toBe(speechText('Cho một đinh sắt vào ống (1).'));
    expect(speechText('⟦sắt|Fe|vi⟧ khử ion Cu²⁺ trong ⟦copper(II) sulfate|CuSO₄⟧ thành ⟦đồng|Cu|vi⟧.'))
      .toBe('sắt khử ion Cu hai cộng trong ⟦copper(II) sulfate⟧ thành đồng.');
  });
  it('chữ hiển thị: tên kèm công thức trong ngoặc', () => {
    expect(displayText('Đi từ ⟦sodium|Na⟧ đến ⟦magnesium hydroxide|Mg(OH)₂⟧.')).toBe('Đi từ sodium (Na) đến magnesium hydroxide (Mg(OH)₂).');
    expect(displayText('⟦copper(II) sulfate⟧ 5%')).toBe('copper(II) sulfate 5%');
    expect(displayText('ống (1), màu trắng (AgCl)')).toBe('ống (1), màu trắng (AgCl)');
  });
  it('mọi đánh dấu trong thí nghiệm mẫu đều đóng mở đúng', () => {
    for (const r of RECIPES) {
      const texts = [r.summary, ...r.steps.map(describeStep), ...r.result.phenomena, r.result.explain, ...r.result.equations, r.title];
      for (const t of texts) expect(displayText(t), `${r.id}: ${t}`).not.toMatch(/[⟦⟧|]/);
      for (const t of [r.title, ...r.result.equations]) expect(t, `${r.id}: chỉ đánh dấu lời thuyết minh`).not.toMatch(/⟦/);
    }
  });
  it('điện tích ion, số oxi hóa, lũy thừa đọc bằng chữ (không đọc "bình phương")', () => {
    expect(speechText('thành ion Fe²⁺, ion H⁺ và OH⁻')).toBe('thành ion Fe hai cộng, ion H cộng và OH trừ');
    expect(speechText('ion SO₄²⁻, Al³⁺')).toBe('ion SO₄ hai trừ, Al ba cộng');
    expect(speechText('Fe⁰ → Fe⁺² + 2e; 2H⁺ + 2e → H₂⁰')).toBe('Fe không → Fe cộng hai + 2e; 2H cộng + 2e → H₂ không');
    expect(speechText('Ksp ≈ 2·10⁻²⁰')).toBe('Ksp ≈ 2·10 mũ trừ hai mươi');
  });
  it('ion nhiều nguyên tử: chỉ số dưới, không nhầm thành điện tích', () => {
    expect(speechText('ion ammonium, ion nitrate, ion sulfate')).toBe('ion NH₄ cộng, ion NO₃ trừ, ion SO₄ hai trừ');
  });
  it('không đụng tới công thức và chữ tiếng Việt', () => {
    expect(speechText('Zn + 2HCl → ZnCl₂ + H₂↑')).toBe('Zn + 2HCl → ZnCl₂ + H₂↑');
    expect(speechText('Bột sắt và bột lưu huỳnh')).toBe('Bột sắt và bột lưu huỳnh');
  });
});
