import { describe, expect, it } from 'vitest';
import { speechText } from '../web/speech';

describe('speechText', () => {
  it('đánh vần công thức, phương trình và ion', () => {
    expect(speechText('Zn + 2HCl → ZnCl₂ + H₂↑')).toBe('dét nờ cộng hai hát xê lờ tạo thành dét nờ xê lờ hai cộng hát hai');
    expect(speechText('kết tủa Cu(OH)₂')).toBe('kết tủa xê u ô hát hai lần');
    expect(speechText('ion Cu²⁺ và SO₄²⁻')).toBe('ion xê u hai cộng và ét ô bốn hai trừ');
    expect(speechText('Fe + S → FeS')).toBe('ép e cộng ét tạo thành ép e ét');
  });
  it('không đụng tới chữ tiếng Việt trùng kí hiệu nguyên tố', () => {
    expect(speechText('Ba ống nghiệm')).toBe('Ba ống nghiệm');
  });
  it('số thứ tự ống, hóa trị, nồng độ, tỉ lệ', () => {
    expect(speechText('Ống (1): cho 0,7 g bột sắt.')).toBe('Ống số một: cho 0,7 g bột sắt.');
    expect(speechText('copper(II) sulfate 0,5M')).toBe('copper hai sulfate 0,5 mol trên lít');
    expect(speechText('tỉ lệ 7 : 4')).toBe('tỉ lệ 7 trên 4');
  });
});
