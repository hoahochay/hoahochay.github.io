"""Tạo giọng đọc cho lời thuyết minh thí nghiệm mẫu bằng VieNeu-TTS v3 (Turbo hoặc Nano, Apache-2.0).

Chạy: npm run tts   (cần môi trường ảo có gói `vieneu`, mặc định ../.venv)
Đọc danh sách câu từ stdin (scripts/tts-plan.ts), tạo public/tts/<khóa>.mp3 cho câu còn thiếu,
xóa file không còn dùng, ghi public/tts/index.json: {"voice": ..., "clips": {khóa: thời lượng giây}}.
Giữ mô hình và giọng ghi trong index.json; đổi bằng biến môi trường (đổi thì tạo lại toàn bộ):
  TTS_MODEL=v3turbo|v3nano  TTS_VOICE="Mai Anh"  npm run tts
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "tts"
SEED = 7
MODELS = {
    # mô hình: (tên ghi trong index.json, tần số lấy mẫu mp3, bitrate)
    "v3turbo": ("VieNeu-TTS v3 Turbo (Apache-2.0)", "48000", "64k"),
    "v3nano": ("VieNeu-TTS v3 Nano (Apache-2.0)", "24000", "40k"),
}


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
    clips = {} if redo else dict(old.get("clips", {}))
    todo = [it for it in items if redo or it["key"] not in clips or not (OUT / f"{it['key']}.mp3").exists()]
    print(f"{len(items)} câu, cần tạo {len(todo)} (giọng {voice}, {label})", file=sys.stderr)

    if todo:
        from vieneu import Vieneu
        tts = Vieneu(mode=mode)
        import numpy as np
        tmp = Path(tempfile.mkdtemp())
        for n, it in enumerate(todo, 1):
            t0 = time.time()
            np.random.seed(SEED)
            wav = tts.infer(it["speech"], voice=voice, seed=SEED)
            w = tmp / "a.wav"
            tts.save(wav, str(w))
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(w), "-ac", "1", "-ar", rate,
                            "-b:a", bitrate, str(OUT / f"{it['key']}.mp3")], check=True)
            clips[it["key"]] = round(len(wav) / tts.sample_rate, 2)
            print(f"[{n}/{len(todo)}] {clips[it['key']]:5.1f}s ({time.time() - t0:.1f}s) {it['text'][:70]}", file=sys.stderr)

    keep = {it["key"] for it in items}
    clips = {k: v for k, v in clips.items() if k in keep}
    for f in OUT.glob("*.mp3"):
        if f.stem not in keep:
            f.unlink()
    index_path.write_text(json.dumps({"voice": voice, "mode": mode, "model": label,
                                      "clips": dict(sorted(clips.items()))}, ensure_ascii=False, indent=1) + "\n")
    size = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"Xong: {len(clips)} file, {size / 1e6:.2f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
