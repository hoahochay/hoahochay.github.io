"""Tạo giọng đọc cho lời thuyết minh thí nghiệm mẫu bằng VieNeu-TTS v3 Nano (Apache-2.0).

Chạy: npm run tts   (cần môi trường ảo có gói `vieneu`, mặc định ../.venv)
Đọc danh sách câu từ stdin (scripts/tts-plan.ts), tạo public/tts/<khóa>.mp3 cho câu còn thiếu,
xóa file không còn dùng, ghi public/tts/index.json: {"voice": ..., "clips": {khóa: thời lượng giây}}.
Đổi giọng: TTS_VOICE="Mai Anh" npm run tts -- --all
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "tts"
VOICE = os.environ.get("TTS_VOICE", "Trúc Ly")
SEED = 7


def main() -> None:
    items = json.load(sys.stdin)
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text()) if index_path.exists() else {}
    redo = "--all" in sys.argv or old.get("voice") != VOICE
    clips = {} if redo else dict(old.get("clips", {}))
    todo = [it for it in items if redo or it["key"] not in clips or not (OUT / f"{it['key']}.mp3").exists()]
    print(f"{len(items)} câu, cần tạo {len(todo)} (giọng {VOICE})", file=sys.stderr)

    if todo:
        from vieneu import Vieneu
        tts = Vieneu(mode="v3nano")
        tmp = Path(tempfile.mkdtemp())
        for n, it in enumerate(todo, 1):
            t0 = time.time()
            wav = tts.infer(it["speech"], voice=VOICE, seed=SEED)
            w = tmp / "a.wav"
            tts.save(wav, str(w))
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(w), "-ac", "1", "-ar", "24000",
                            "-b:a", "40k", str(OUT / f"{it['key']}.mp3")], check=True)
            clips[it["key"]] = round(len(wav) / tts.sample_rate, 2)
            print(f"[{n}/{len(todo)}] {clips[it['key']]:5.1f}s ({time.time() - t0:.1f}s) {it['text'][:70]}", file=sys.stderr)

    keep = {it["key"] for it in items}
    clips = {k: v for k, v in clips.items() if k in keep}
    for f in OUT.glob("*.mp3"):
        if f.stem not in keep:
            f.unlink()
    index_path.write_text(json.dumps({"voice": VOICE, "model": "VieNeu-TTS v3 Nano (Apache-2.0)",
                                      "clips": dict(sorted(clips.items()))}, ensure_ascii=False, indent=1) + "\n")
    size = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"Xong: {len(clips)} file, {size / 1e6:.2f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
