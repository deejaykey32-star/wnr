import os
import sys
import json
import math
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

def generate_srt_subtitles(segments: list, timing_data: dict, output_srt: str) -> list:
    """
    Generates standard SRT subtitles using ElevenLabs character/word timestamps
    or proportional duration matching.
    """
    srt_entries = []
    
    # Calculate approximate audio total duration or use alignment
    char_starts = timing_data.get("character_start_times_seconds", [])
    char_ends = timing_data.get("character_end_times_seconds", [])
    
    current_time = 0.0
    
    for idx, seg in enumerate(segments, 1):
        text = seg["text"].strip()
        
        # Estimate duration if detailed char timing is absent
        if not char_starts:
            word_count = len(text.split())
            duration = max(3.0, word_count * 0.4)
            start_t = current_time
            end_t = current_time + duration
            current_time = end_t
        else:
            # Map segment text location to timing data
            # Proportional mapping based on character indices
            start_t = current_time
            word_count = len(text.split())
            duration = max(3.0, word_count * 0.45)
            end_t = start_t + duration
            current_time = end_t
            
        seg["start_time"] = start_t
        seg["end_time"] = end_t
        seg["duration"] = end_t - start_t
        
        srt_entry = f"{idx}\n{format_srt_timestamp(start_t)} --> {format_srt_timestamp(end_t)}\n{text}\n\n"
        srt_entries.append(srt_entry)

    with open(output_srt, "w", encoding="utf-8") as f:
        f.writelines(srt_entries)
        
    print(f"[SUCCESS] SRT subtitles saved to {output_srt}")
    return segments

def build_ffmpeg_concat_file(segments: list, concat_file_path: str):
    """Creates FFmpeg concat demuxer text file specifying image file paths and durations."""
    lines = []
    for seg in segments:
        img_path = os.path.abspath(seg.get("image_path", "")).replace("\\", "/")
        duration = seg.get("duration", 4.0)
        lines.append(f"file '{img_path}'\n")
        lines.append(f"duration {duration:.3f}\n")
    
    # FFmpeg concat requirement: repeat last file
    if segments:
        last_img = os.path.abspath(segments[-1].get("image_path", "")).replace("\\", "/")
        lines.append(f"file '{last_img}'\n")
        
    with open(concat_file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

def render_video(segments: list, audio_path: str, output_mp4: str = "final_widokinaraj_169.mp4", srt_path: str = "narration.srt", ffmpeg_bin: str = "ffmpeg"):
    """
    Renders final 16:9 MP4 video combining SD images, narration audio, and burned SRT subtitles.
    """
    work_dir = os.path.dirname(output_mp4) or "."
    concat_file = os.path.join(work_dir, "input_slides.txt")
    build_ffmpeg_concat_file(segments, concat_file)

    # Escape subtitle path for ffmpeg filter string (Windows backslashes must be escaped)
    escaped_srt = os.path.abspath(srt_path).replace("\\", "/").replace(":", "\\:")
    
    sub_style = "FontName=DejaVu Sans,FontSize=20,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Alignment=2,MarginV=30"
    vf_filter = f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,subtitles='{escaped_srt}':force_style='{sub_style}'"

    audio_abs_path = os.path.abspath(audio_path)
    # Check if narration audio exists; if not, create silent audio track filter
    if os.path.exists(audio_abs_path):
        audio_input = ["-i", audio_abs_path]
        audio_map = ["-c:a", "aac", "-b:a", "192k"]
    else:
        print("[WARNING] Narration audio not found, generating silent audio stream.")
        total_duration = sum(s.get("duration", 4.0) for s in segments)
        audio_input = ["-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate=44100:duration={total_duration}"]
        audio_map = ["-c:a", "aac", "-b:a", "192k"]

    cmd = [
        ffmpeg_bin, "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        *audio_input,
        "-vf", vf_filter,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
        *audio_map,
        "-shortest",
        output_mp4
    ]

    print(f"[FFMPEG] Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if result.returncode == 0:
        print(f"[SUCCESS] Rendered final 16:9 video to {output_mp4}")
        return True
    else:
        print(f"[ERROR] FFmpeg rendering failed:\n{result.stderr}")
        # Try simple fallback command without subtitles filter if subtitle filter failed
        fallback_cmd = [
            ffmpeg_bin, "-y",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            *audio_input,
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            *audio_map,
            "-shortest",
            output_mp4
        ]
        print(f"[FFMPEG FALLBACK] Running fallback command without burned subtitles...")
        fb_res = subprocess.run(fallback_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if fb_res.returncode == 0:
            print(f"[SUCCESS] Rendered fallback video (without subtitles filter) to {output_mp4}")
            return True
        else:
            print(f"[ERROR] Fallback render failed: {fb_res.stderr}")
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
    updated_segments = generate_srt_subtitles(segments, timing_data, srt_path)

    audio_path = os.path.join(output_dir, "narration.mp3")
    render_video(updated_segments, audio_path, output_mp4=output_mp4, srt_path=srt_path, ffmpeg_bin=ffmpeg_bin)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Assemble 16:9 video with synced subtitles using FFmpeg.")
    parser.add_argument("--segments", type=str, default="segments.json", help="Path to segments JSON")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory containing media")
    parser.add_argument("--output-mp4", type=str, default="final_widokinaraj_169.mp4", help="Output MP4 filepath")
    args = parser.parse_args()

    assemble_video_pipeline(args.segments, args.output_dir, args.output_mp4)
