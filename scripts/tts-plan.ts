/**
 * In ra (JSON) mọi câu thuyết minh cần giọng đọc: lời từng bước và phần giải thích kết luận
 * của các thí nghiệm mẫu. scripts/tts.py đọc danh sách này để tạo file âm thanh.
 */
import { describeStep } from '../web/narration';
import { RECIPES } from '../web/recipes';
import { clipKey, speechText } from '../web/speech';

const seen = new Map<string, { key: string; text: string; speech: string }>();
for (const r of RECIPES) {
  const texts = [...r.steps.map(describeStep), r.result.explain];
  for (const text of texts) {
    if (!text || text === 'Quan sát…') continue;
    const speech = speechText(text);
    const key = clipKey(speech);
    if (!seen.has(key)) seen.set(key, { key, text, speech });
  }
}
process.stdout.write(JSON.stringify([...seen.values()], null, 1));
