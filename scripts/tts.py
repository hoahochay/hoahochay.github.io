"""Tạo giọng đọc cho lời thuyết minh thí nghiệm mẫu bằng VieNeu-TTS v3 (Turbo hoặc Nano, Apache-2.0).
Tên chất đánh dấu ⟦...⟧ (xem web/speech.ts) do Kokoro-82M (Apache-2.0, giọng bf_isabella) đọc tiếng Anh,
rồi ghép vào câu. Cần thêm gói `kokoro-onnx`; file mô hình tự tải về ~/.cache/kokoro.

Chạy: npm run tts   (cần môi trường ảo có gói `vieneu`, mặc định ../.venv)
Đọc danh sách câu từ stdin (scripts/tts-plan.ts), tạo public/tts/<khóa>.mp3 cho câu còn thiếu,
xóa file không còn dùng, ghi public/tts/index.json: {"voice": ..., "clips": {khóa: thời lượng giây}}.
Giữ mô hình và giọng ghi trong index.json; đổi bằng biến môi trường (đổi thì tạo lại toàn bộ):
  TTS_MODEL=v3turbo|v3nano  TTS_VOICE="Mai Anh"  npm run tts
"""
import json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "tts"
SEED = 7
MODELS = {
    # mô hình: (tên ghi trong index.json, tần số lấy mẫu mp3, bitrate)
    "v3turbo": ("VieNeu-TTS v3 Turbo (Apache-2.0)", "48000", "64k"),
    "v3nano": ("VieNeu-TTS v3 Nano (Apache-2.0)", "24000", "40k"),
}
# Giọng đọc tên chất tiếng Anh: đổi thì tạo lại các câu có đánh dấu
EN = {"model": "Kokoro-82M v1.0 (Apache-2.0)", "voice": "bf_isabella", "lang": "en-gb"}
KOKORO_DIR = Path.home() / ".cache" / "kokoro"
KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
EN_TAG = re.compile(r"⟦(.+?)⟧")
GAP_S, PAUSE_S, TAIL_S = 0.07, 0.18, 0.3  # nghỉ ở chỗ nối, sau dấu phẩy/chấm đứng riêng, cuối câu


def load_kokoro():
    from kokoro_onnx import Kokoro
    KOKORO_DIR.mkdir(parents=True, exist_ok=True)
    files = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
    for f in files:
        if not (KOKORO_DIR / f).exists():
            print(f"Tải {f}…", file=sys.stderr)
            urllib.request.urlretrieve(KOKORO_URL + f, KOKORO_DIR / (f + ".part"))
            (KOKORO_DIR / (f + ".part")).rename(KOKORO_DIR / f)
    return Kokoro(*(str(KOKORO_DIR / f) for f in files))


def trim(w, sr, top_db=35.0):
    """Cắt khoảng lặng hai đầu (theo năng lượng từng khung 10 ms), chừa 20 ms"""
    import numpy as np
    n = max(1, sr // 100)
    frames = len(w) // n
    if frames == 0:
        return w
    e = np.sqrt((w[: frames * n].reshape(frames, n) ** 2).mean(axis=1))
    on = np.nonzero(e > e.max() * 10 ** (-top_db / 20))[0]
    if len(on) == 0:
        return w
    pad = 2
    return w[max(0, on[0] - pad) * n: min(frames, on[-1] + 1 + pad) * n]


def loudness(w):
    """RMS của phần có tiếng"""
    import numpy as np
    a = np.abs(w)
    v = w[a > 0.02 * a.max()]
    return float(np.sqrt((v ** 2).mean())) if len(v) else 1.0


class Mixer:
    """Đọc câu có đánh dấu ⟦tên⟧: tiếng Việt bằng VieNeu, tên chất bằng Kokoro, nối lại"""

    def __init__(self, tts, voice):
        self.tts, self.voice, self.kokoro, self.cache = tts, voice, None, {}

    def vi(self, text):
        import numpy as np
        np.random.seed(SEED)
        return np.asarray(self.tts.infer(text, voice=self.voice, seed=SEED), dtype=np.float32)

    def en(self, name):
        if name not in self.cache:
            import numpy as np, soxr
            self.kokoro = self.kokoro or load_kokoro()
            w, sr = self.kokoro.create(name, voice=EN["voice"], lang=EN["lang"], speed=1.0)
            w = soxr.resample(np.asarray(w, dtype=np.float32), sr, self.tts.sample_rate)
            self.cache[name] = trim(w, self.tts.sample_rate)
        return self.cache[name]

    def speak(self, speech):
        import numpy as np
        sr = self.tts.sample_rate
        parts = EN_TAG.split(speech)
        if len(parts) == 1:
            return self.vi(speech)
        segs = []  # ("vi" | "en" | "pause", âm thanh)
        for i, p in enumerate(parts):
            p = p.strip()
            if not p:
                continue
            if i % 2:
                segs.append(("en", self.en(p)))
            elif re.fullmatch(r"[.,;:!?…]+", p):
                segs.append(("pause", None))
            else:
                segs.append(("vi", trim(self.vi(p), sr)))
        level = [loudness(w) for k, w in segs if k == "vi"]
        target = float(np.mean(level)) if level else 0.1
        out = []
        for k, w in segs:
            if k == "pause":
                out.append(np.zeros(int((PAUSE_S - GAP_S) * sr), np.float32))
                continue
            if k == "en":
                w = w * (target / loudness(w))
            out += [w, np.zeros(int(GAP_S * sr), np.float32)]
        out.append(np.zeros(int(TAIL_S * sr), np.float32))
        return np.concatenate(out)


def main() -> None:
    items = json.load(sys.stdin)
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text()) if index_path.exists() else {}
    # Giữ giọng đang dùng; chỉ đổi khi đặt TTS_VOICE
    voice = os.environ.get("TTS_VOICE") or old.get("voice") or "Mai Anh"
    mode = os.environ.get("TTS_MODEL") or old.get("mode") or "v3nano"
    label, rate, bitrate = MODELS[mode]
    redo = "--all" in sys.argv or old.get("voice") != voice or old.get("mode", "v3nano") != mode
    redo_en = old.get("en") != EN  # đổi giọng tiếng Anh: tạo lại các câu có đánh dấu
    clips = {} if redo else dict(old.get("clips", {}))
    todo = [it for it in items if redo or it["key"] not in clips or not (OUT / f"{it['key']}.mp3").exists()
            or (redo_en and EN_TAG.search(it["speech"]))]
    print(f"{len(items)} câu, cần tạo {len(todo)} (giọng {voice}, {label})", file=sys.stderr)

    if todo:
        from vieneu import Vieneu
        tts = Vieneu(mode=mode)
        mixer = Mixer(tts, voice)
        tmp = Path(tempfile.mkdtemp())
        try:
            for n, it in enumerate(todo, 1):
                t0 = time.time()
                wav = mixer.speak(it["speech"])
                w = tmp / "a.wav"
                tts.save(wav, str(w))
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(w), "-ac", "1", "-ar", rate,
                                "-b:a", bitrate, str(OUT / f"{it['key']}.mp3")], check=True)
                clips[it["key"]] = round(len(wav) / tts.sample_rate, 2)
                print(f"[{n}/{len(todo)}] {clips[it['key']]:5.1f}s ({time.time() - t0:.1f}s) {it['text'][:70]}", file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    keep = {it["key"] for it in items}
    clips = {k: v for k, v in clips.items() if k in keep}
    for f in OUT.glob("*.mp3"):
        if f.stem not in keep:
            f.unlink()
    index_path.write_text(json.dumps({"voice": voice, "mode": mode, "model": label, "en": EN,
                                      "clips": dict(sorted(clips.items()))}, ensure_ascii=False, indent=1) + "\n")
    size = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"Xong: {len(clips)} file, {size / 1e6:.2f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
