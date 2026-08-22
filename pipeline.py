import os
import sys
import json
import argparse
from dotenv import load_dotenv

from analyze import analyze_text
from generate_media import process_media_generation
from assemble_video import assemble_video_pipeline, render_video

load_dotenv()

DEFAULT_SAMPLE_PRAYER = """Różańcowy Gaj - Tajemnica Pierwsza: Zwiastowanie Najświętszej Maryi Pannie.
Anioł Gabriel przybywa do Maryi w cichym Nazarecie z przesłaniem nadziei i pokoju.
W cichości serca Maryja odpowiada 'Oto ja służebnica Pańska, niech mi się stanie według słowa twego'.
Zaczyna się nowa era miłości, światła i wewnętrznej spokojnej modlitwy."""

DEFAULT_SAMPLE_BLOG = """Witamy na widokinaraj.pl - Odkryj piękno minimalistycznego życia w harmonii z naturą.
Zatrzymaj się na chwilę i poczuj spokój porannego wiatru musującego w koronie drzew.
Minimalizm to nie brak wszystkiego, ale świadomy wybór tego, co najważniejsze dla duszy.
Stwórz własną przestrzeń ciszy i powróć do prostych radostek dnia powszedniego."""

def run_pipeline(text_input: str, input_type: str = "blog", output_dir: str = "output", final_video: str = "final_widokinaraj_169.mp4", ffmpeg_bin: str = "ffmpeg"):
    print("=" * 60)
    print("  widokinaraj.pl Ultra Low-Cost Widescreen Video Pipeline  ")
    print("=" * 60)
    
    os.makedirs(output_dir, exist_ok=True)
    segments_file = os.path.join(output_dir, "segments.json")
    
    # Phase 2: Content Parsing & Prompt Generation (GPT-4o)
    print("\n--- PHASE 2: Content Parsing & Prompt Generation (GPT-4o) ---", flush=True)
    print("[PROGRESS 10%] Oczyszczanie tekstu modlitwy i usuwanie odnośników...", flush=True)
    segments = analyze_text(text_input, input_type=input_type)
    with open(segments_file, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    print(f"[PROGRESS 15%] Przygotowano {len(segments)} segmentów modlitewnych.", flush=True)
    
    # Phase 3: Media Generation (Stable Diffusion 16:9 & ElevenLabs)
    print("\n--- PHASE 3: Media Generation (Stable Diffusion 16:9 & ElevenLabs) ---")
    process_media_generation(segments_file, output_dir=output_dir)
    
    # Phase 4: Video Assembly (FFmpeg & Synced Subtitles)
    print("\n--- PHASE 4: Video Assembly (FFmpeg & Subtitles) ---")
    assemble_video_pipeline(segments_file, output_dir=output_dir, output_mp4=final_video, ffmpeg_bin=ffmpeg_bin)
    
    # Phase 5: Verification & Deliverables (STRICT MODE: "Albo wszystko albo nic")
    print("\n--- PHASE 5: Strict Verification & Deliverables ---", flush=True)
    if os.path.exists(final_video) and os.path.getsize(final_video) > 10000:
        size_mb = os.path.getsize(final_video) / (1024 * 1024)
        print(f"[SUCCESS] Video successfully rendered with 100% strict verification: {final_video} ({size_mb:.2f} MB)", flush=True)
        return True
    else:
        raise RuntimeError(f"[STRICT ERROR] Failed to render complete video at {final_video}. Process aborted as requested ('albo wszystko albo nic').")

def main():
    parser = argparse.ArgumentParser(description="Automated Video Pipeline for widokinaraj.pl")
    parser.add_argument("--text", type=str, default="", help="Source text or path to text file")
    parser.add_argument("--type", type=str, default="blog", choices=["blog", "prayer"], help="INPUT_TYPE ('blog' or 'prayer')")
    parser.add_argument("--output-dir", type=str, default="output", help="Directory for intermediate media files")
    parser.add_argument("--output-mp4", type=str, default="final_widokinaraj_169.mp4", help="Final output MP4 path")
    parser.add_argument("--ffmpeg-path", type=str, default="ffmpeg", help="Path to ffmpeg executable")
    args = parser.parse_args()

    text_input = args.text
    if not text_input:
        text_input = DEFAULT_SAMPLE_PRAYER if args.type == "prayer" else DEFAULT_SAMPLE_BLOG
    elif os.path.exists(args.text):
        with open(args.text, "r", encoding="utf-8") as f:
            text_input = f.read()

    run_pipeline(text_input, input_type=args.type, output_dir=args.output_dir, final_video=args.output_mp4, ffmpeg_bin=args.ffmpeg_path)

if __name__ == "__main__":
    main()
