import { describe, expect, it } from 'vitest';
import { speechText } from '../web/speech';

describe('speechText', () => {
  it('thay tên tiếng Anh bằng công thức, giữ nguyên phần còn lại', () => {
    expect(speechText('Ống (2): lấy 2 mL dung dịch copper(II) sulfate.')).toBe('Ống 2: lấy 2 mL dung dịch CuSO₄.');
    expect(speechText('Magnesium cháy tạo thành magnesium oxide.')).toBe('mờ gờ cháy tạo thành MgO.');
    expect(speechText('khí hydrogen, ion hydroxide, hydrochloric acid')).toBe('khí H₂, ion OH⁻, HCl');
    expect(speechText('kết tủa copper(II) hydroxide')).toBe('kết tủa Cu(OH)₂');
  });
  it('ngoại lệ Mg: đọc "mờ gờ" khi đứng riêng', () => {
    expect(speechText('2Mg + O₂ → 2MgO')).toBe('2 mờ gờ + O₂ → 2MgO');
    expect(speechText('kết tủa Mg(OH)₂')).toBe('kết tủa mờ gờ(OH)₂');
  });
  it('bỏ ngoặc quanh số thứ tự ống', () => {
    expect(speechText('ở ống (1) và ống (3).')).toBe('ở ống 1 và ống 3.');
  });
  it('tên kèm công thức trong ngoặc: đọc tên, bỏ công thức', () => {
    expect(speechText('Ống (1): thêm một ít sodium oxide (Na₂O).')).toBe('Ống 1: thêm một ít sodium oxide.');
    expect(speechText('tạo magnesium hydroxide (Mg(OH)₂) ít tan')).toBe('tạo magnesium hydroxide ít tan');
    expect(speechText('dung dịch copper(II) sulfate (CuSO₄)')).toBe('dung dịch copper(II) sulfate');
    expect(speechText('từ sodium (Na) đến phosphorus (P)')).toBe('từ sodium đến phosphorus');
  });
  it('chỉ bỏ ngoặc ngay sau tên chất', () => {
    expect(speechText('màu trắng (AgCl), V(HCl) = 10 mL, khử Cu(OH)₂')).toBe('màu trắng (AgCl), V(HCl) = 10 mL, khử Cu(OH)₂');
    expect(speechText('phosphoric acid (acid trung bình)')).toBe('H₃PO₄ (acid trung bình)');
  });
  it('không đụng tới công thức và chữ tiếng Việt', () => {
    expect(speechText('Zn + 2HCl → ZnCl₂ + H₂↑')).toBe('Zn + 2HCl → ZnCl₂ + H₂↑');
    expect(speechText('Bột sắt và bột lưu huỳnh')).toBe('Bột sắt và bột lưu huỳnh');
  });
});
