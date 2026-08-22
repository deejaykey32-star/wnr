import os
import sys
import json
import math
import re
import subprocess
import argparse

def format_srt_timestamp(seconds: float) -> str:
    """Converts seconds float into SRT timecode format HH:MM:SS,mmm."""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis = 0
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def format_ass_timestamp(seconds: float) -> str:
    """Converts seconds float into ASS timecode format H:MM:SS.cc."""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        secs += 1
        centis = 0
    return f"{hrs:d}:{mins:02d}:{secs:02d}.{centis:02d}"

def generate_ass_karaoke_subtitles(segments: list, timing_data: dict, output_ass: str) -> list:
    """
    Generates Advanced SubStation Alpha (.ass) Karaoke subtitles where each individual word
    highlights in bright gold as the narrator speaks it!
    """
    header = """[Script Info]
Title: WnR365 Rosary Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke, Arial, 22, &H0000FFFF, &H00FFFFFF, &H00000000, &H80000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 2, 1, 2, 40, 40, 65, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    current_time = 0.0

    for idx, seg in enumerate(segments, 1):
        raw_text = seg.get("text", "").strip()
        if not raw_text:
            continue

        # Split strictly by whitespace so words like "Stworzyciela" stay 100% intact
        words = [w for w in re.split(r'\s+', raw_text) if w.strip()]
        if not words:
            continue

        char_count = len(raw_text)
        duration = seg.get("duration") or max(3.5, char_count / 11.0)
        start_t = current_time
        end_t = current_time + duration
        current_time = end_t

        seg["start_time"] = start_t
        seg["end_time"] = end_t
        seg["duration"] = duration

        word_dur_cs = max(12, int((duration * 100) / len(words)))
        k_text = "".join([f"{{\\k{word_dur_cs}}}{w} " for w in words]).strip()

        start_str = format_ass_timestamp(start_t)
        end_str = format_ass_timestamp(end_t)
        lines.append(f"Dialogue: 0,{start_str},{end_str},Karaoke,,0,0,0,,{k_text}\n")

    with open(output_ass, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"[SUCCESS] ASS Karaoke subtitles saved to {output_ass}")
    return segments

def generate_srt_subtitles(segments: list, timing_data: dict, output_srt: str) -> list:
    """Generates standard ASS Karaoke subtitles first, falling back to SRT."""
    ass_path = output_srt.replace(".srt", ".ass")
    return generate_ass_karaoke_subtitles(segments, timing_data, ass_path)

def build_ffmpeg_concat_file(segments: list, concat_file_path: str):
    """Creates FFmpeg concat demuxer text file specifying image file paths and durations."""
    lines = []
    for seg in segments:
        img_path = os.path.abspath(seg.get("image_path", "")).replace("\\", "/")
        duration = seg.get("duration", 4.0)
        lines.append(f"file '{img_path}'\n")
        lines.append(f"duration {duration:.3f}\n")
    
    if segments:
        last_img = os.path.abspath(segments[-1].get("image_path", "")).replace("\\", "/")
        lines.append(f"file '{last_img}'\n")
        
    with open(concat_file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

def get_ffmpeg_bin(custom_path: str = "ffmpeg") -> str:
    """Resolves working FFmpeg executable path (system PATH, imageio_ffmpeg, or custom path)."""
    import shutil
    if custom_path and custom_path != "ffmpeg" and os.path.exists(custom_path):
        return custom_path
    if custom_path and shutil.which(custom_path):
        return custom_path
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(exe):
            print(f"[FFMPEG] Using imageio_ffmpeg binary at: {exe}", flush=True)
            return exe
    except Exception:
        pass
    return custom_path or "ffmpeg"

def run_ffmpeg_cmd(cmd: list) -> bool:
    """
    Executes FFmpeg while continuously draining stderr to prevent OS pipe buffer deadlocks.
    Parses real-time progress timestamps to keep UI progress advancing!
    """
    print(f"[FFMPEG] Running command: {' '.join(cmd)}", flush=True)
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
            bufsize=1
        )
        for line in proc.stderr:
            line_str = line.strip()
            if "time=" in line_str:
                m = re.search(r'time=(\d+:\d+:\d+\.\d+)', line_str)
                if m:
                    print(f"[PROGRESS 92%] Montowanie wideo FFmpeg (czas: {m.group(1)})...", flush=True)
            elif any(kw in line_str.lower() for kw in ["error", "invalid", "failed", "fatal"]):
                print(f"[FFMPEG LOG] {line_str}", flush=True)
        proc.wait()
        return proc.returncode == 0
    except Exception as e:
        print(f"[FFMPEG EXCEPTION] {e}", flush=True)
        return False

def render_video(segments: list, audio_path: str, output_mp4: str = "final_widokinaraj_169.mp4", srt_path: str = "narration.srt", ffmpeg_bin: str = "ffmpeg"):
    """
    Renders final 16:9 MP4 video combining images, narration audio, and karaoke subtitles.
    """
    ffmpeg_exe = get_ffmpeg_bin(ffmpeg_bin)
    work_dir = os.path.dirname(output_mp4) or "."
    concat_file = os.path.join(work_dir, "input_slides.txt")
    build_ffmpeg_concat_file(segments, concat_file)

    ass_path = srt_path.replace(".srt", ".ass")
    sub_file = ass_path if os.path.exists(ass_path) else srt_path
    escaped_sub = os.path.abspath(sub_file).replace("\\", "/").replace(":", "\\:")
    
    if sub_file.endswith(".ass"):
        vf_filter = f"scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,subtitles='{escaped_sub}'"
    else:
        sub_style = "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Alignment=2,MarginV=65"
        vf_filter = f"scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,subtitles='{escaped_sub}':force_style='{sub_style}'"

    audio_abs_path = os.path.abspath(audio_path)
    if os.path.exists(audio_abs_path):
        audio_input = ["-i", audio_abs_path]
        audio_map = ["-c:a", "aac", "-b:a", "128k"]
    else:
        print("[WARNING] Narration audio not found, generating silent audio stream.")
        total_duration = sum(s.get("duration", 4.0) for s in segments)
        audio_input = ["-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate=44100:duration={total_duration}"]
        audio_map = ["-c:a", "aac", "-b:a", "128k"]

    cmd = [
        ffmpeg_exe, "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        *audio_input,
        "-vf", vf_filter,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
        *audio_map,
        "-shortest",
        output_mp4
    ]

    print("[PROGRESS 88%] Renderowanie klatek wideo MP4 (FFmpeg)...", flush=True)
    if run_ffmpeg_cmd(cmd):
        print(f"[SUCCESS] Rendered final 16:9 video to {output_mp4}", flush=True)
        return True
    else:
        print("[NOTICE] FFmpeg subtitle render failed/timed out, attempting fallback without subtitles...", flush=True)
        fallback_cmd = [
            ffmpeg_exe, "-y",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            *audio_input,
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
            *audio_map,
            "-shortest",
            output_mp4
        ]
        if run_ffmpeg_cmd(fallback_cmd):
            print(f"[SUCCESS] Rendered fallback video to {output_mp4}", flush=True)
            return True
        else:
            print("[ERROR] Fallback video render also failed.", flush=True)
            return False

def assemble_video_pipeline(segments_file: str, output_dir: str = "output", output_mp4: str = "final_widokinaraj_169.mp4", ffmpeg_bin: str = "ffmpeg"):
    with open(segments_file, "r", encoding="utf-8") as f:
        segments = json.load(f)

    timing_file = os.path.join(output_dir, "narration_timestamps.json")
    timing_data = {}
    if os.path.exists(timing_file):
        with open(timing_file, "r", encoding="utf-8") as f:
            timing_data = json.load(f)

    srt_path = os.path.join(output_dir, "narration.srt")
    print("[PROGRESS 82%] Generowanie napisów i osi czasu slajdów...", flush=True)
    updated_segments = generate_srt_subtitles(segments, timing_data, srt_path)

    audio_path = os.path.join(output_dir, "narration.mp3")
    print("[PROGRESS 88%] Renderowanie końcowego filmu MP4 (FFmpeg)...", flush=True)
    success = render_video(updated_segments, audio_path, output_mp4=output_mp4, srt_path=srt_path, ffmpeg_bin=ffmpeg_bin)
    if success:
        print("[PROGRESS 98%] Montaż wideo ukończony pomyślnie!", flush=True)
    else:
        print("[ERROR] Montaż wideo nie powiódł się.", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Assemble 16:9 video with synced subtitles using FFmpeg.")
    parser.add_argument("--segments", type=str, default="segments.json", help="Path to segments JSON")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory containing media")
    parser.add_argument("--output-mp4", type=str, default="final_widokinaraj_169.mp4", help="Output MP4 filepath")
    args = parser.parse_args()

    assemble_video_pipeline(args.segments, args.output_dir, args.output_mp4)
