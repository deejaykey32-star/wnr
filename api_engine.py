"""
api_engine.py - Automated API Video Generation Engine for RHZ365 / WnR365
Integrates:
1. ElevenLabs API (Voice cloning + Word Timestamps for Karaoke)
2. Replicate / Pollinations API (16:9 AI Sacred Art per bead)
3. Canvas Video Compositor (17-element vertical rosary + 175-day progress bar + Karaoke word highlighting)
"""

import os
import sys
import json
import time
import math
import re
import requests
import subprocess
from PIL import Image, ImageDraw, ImageFont

ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "yu6bC9aJwpEUndYOjPEg")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
REPLICATE_API_KEY = os.getenv("REPLICATE_API_KEY", "")

def fetch_elevenlabs_voice_with_timestamps(text: str, output_audio: str, voice_id: str = ELEVENLABS_VOICE_ID) -> list:
    """
    Calls ElevenLabs API with-timestamps endpoint to generate TTS narration audio with exact word timing.
    Returns list of dicts: [{"word": str, "start": float, "end": float}]
    """
    api_key = ELEVENLABS_API_KEY or os.getenv("ELEVEN_API_KEY", "")
    if not api_key:
        print("[ELEVENLABS] API Key not set. Using Edge TTS fallback.", flush=True)
        return _fallback_edge_tts_with_timestamps(text, output_audio)

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        print(f"[ELEVENLABS API] Requesting narration with timestamps for voice {voice_id}...", flush=True)
        res = requests.post(url, json=payload, headers=headers, timeout=25)
        if res.status_code == 200:
            data = res.json()
            import base64
            audio_bytes = base64.b64decode(data["audio_base64"])
            with open(output_audio, "wb") as f:
                f.write(audio_bytes)
            
            alignment = data.get("alignment", {})
            chars = alignment.get("characters", [])
            starts = alignment.get("character_start_times_seconds", [])
            ends = alignment.get("character_end_times_seconds", [])

            # Aggregate character timestamps into word-level timestamps
            words_timing = []
            cur_word = ""
            w_start = None
            w_end = None

            for c, s, e in zip(chars, starts, ends):
                if c.strip():
                    if not cur_word:
                        w_start = s
                    cur_word += c
                    w_end = e
                else:
                    if cur_word:
                        words_timing.append({"word": cur_word, "start": w_start, "end": w_end})
                        cur_word = ""

            if cur_word:
                words_timing.append({"word": cur_word, "start": w_start, "end": w_end})

            print(f"[SUCCESS] ElevenLabs API audio saved ({len(words_timing)} word timestamps extracted)", flush=True)
            return words_timing
        else:
            print(f"[WARNING] ElevenLabs API returned status {res.status_code}: {res.text}", flush=True)
            return _fallback_edge_tts_with_timestamps(text, output_audio)
    except Exception as e:
        print(f"[ERROR] ElevenLabs API request failed: {e}", flush=True)
        return _fallback_edge_tts_with_timestamps(text, output_audio)

def _fallback_edge_tts_with_timestamps(text: str, output_audio: str) -> list:
    """Fallback TTS generator when ElevenLabs API key is unavailable."""
    try:
        import asyncio
        import edge_tts

        async def _gen():
            communicate = edge_tts.Communicate(text, "pl-PL-MarekNeural")
            submaker = edge_tts.SubMaker()
            with open(output_audio, "wb") as file:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        file.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        submaker.create_sub((chunk["offset"], chunk["duration"]), chunk["text"])

        asyncio.run(_gen())
        print(f"[EDGE TTS] Generated fallback audio at {output_audio}", flush=True)
    except Exception as e:
        print(f"[WARNING] Edge TTS failed: {e}. Generating silent audio file.", flush=True)
        os.makedirs(os.path.dirname(output_audio) or ".", exist_ok=True)
        cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-t", "10", output_audio]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    words = [w for w in re.split(r'\s+', text) if w.strip()]
    duration = max(5.0, len(text) / 11.0)
    word_dur = duration / max(len(words), 1)
    
    words_timing = []
    for i, w in enumerate(words):
        words_timing.append({
            "word": w,
            "start": round(i * word_dur, 2),
            "end": round((i + 1) * word_dur, 2)
        })
    return words_timing

def fetch_ai_image(prompt: str, output_path: str, bead_idx: int = 1) -> bool:
    """
    Generates a 16:9 sacred art painting via Replicate API or Pollinations API.
    1. Replicate API (FLUX.1-schnell / SDXL) if REPLICATE_API_KEY is available.
    2. Pollinations AI (16:9 sacred prompt with retries).
    3. Smooth Renaissance sacred oil painting canvas fallback.
    """
    clean_text = prompt.replace("\n", " ").strip()
    sacred_prompt = (
        f"hyperrealistic biblical oil painting masterpiece, classical Renaissance art style, "
        f"sacred scene depicting: {clean_text[:90]}, Rembrandt lighting, divine atmosphere, 8k cinematic masterpiece, 16:9"
    )

    if REPLICATE_API_KEY:
        try:
            print(f"[REPLICATE API] Requesting 16:9 FLUX.1 image for bead {bead_idx}...", flush=True)
            res = requests.post(
                "https://api.replicate.com/v1/predictions",
                headers={
                    "Authorization": f"Token {REPLICATE_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "version": "black-forest-labs/flux-1-schnell",
                    "input": {
                        "prompt": sacred_prompt,
                        "aspect_ratio": "16:9"
                    }
                },
                timeout=12
            )
            if res.status_code == 201:
                prediction = res.json()
                poll_url = prediction["urls"]["get"]
                for _ in range(15):
                    time.sleep(1)
                    poll_res = requests.get(poll_url, headers={"Authorization": f"Token {REPLICATE_API_KEY}"})
                    if poll_res.status_code == 200:
                        p_data = poll_res.json()
                        if p_data["status"] == "succeeded":
                            img_url = p_data["output"][0]
                            img_data = requests.get(img_url).content
                            with open(output_path, "wb") as f:
                                f.write(img_data)
                            print(f"[SUCCESS] Saved Replicate AI image to {output_path}", flush=True)
                            return True
                        elif p_data["status"] in ("failed", "canceled"):
                            break
        except Exception as e:
            print(f"[NOTICE] Replicate API attempt failed: {e}", flush=True)

    # Pollinations AI Primary Provider with 12s timeout & retries
    encoded_prompt = requests.utils.quote(sacred_prompt)
    seed = (bead_idx * 7919 + int(time.time())) % 99999
    urls = [
        f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}&model=flux",
        f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}",
    ]
    
    for attempt, url in enumerate(urls, 1):
        try:
            print(f"[POLLINATIONS AI] Requesting 16:9 sacred image (attempt {attempt}) for bead {bead_idx}...", flush=True)
            res = requests.get(url, timeout=12)
            if res.status_code == 200 and len(res.content) > 5000:
                with open(output_path, "wb") as f:
                    f.write(res.content)
                print(f"[SUCCESS] Saved Pollinations 16:9 biblical masterpiece to {output_path}", flush=True)
                return True
        except Exception as e:
            print(f"[NOTICE] Pollinations AI attempt {attempt} timed out: {e}", flush=True)

    # Smooth Renaissance Sacred Oil Canvas Background Fallback (NO harsh geometric lines or circles)
    return _create_procedural_sacred_canvas(sacred_prompt, output_path)

def _create_procedural_sacred_canvas(prompt: str, output_path: str) -> bool:
    """Generates a rich, dark atmospheric Renaissance sacred oil canvas background."""
    try:
        width, height = 1280, 720
        # Dark royal indigo / warm sepia ambient canvas
        img = Image.new("RGB", (width, height), color=(18, 14, 26))
        draw = ImageDraw.Draw(img)

        # Smooth soft golden halo vignette in top-center (NO geometric lines)
        cx, cy = width // 2, 120
        for r in range(350, 0, -10):
            alpha_ratio = (350 - r) / 350.0
            r_c = int(180 * alpha_ratio + 18 * (1 - alpha_ratio))
            g_c = int(140 * alpha_ratio + 14 * (1 - alpha_ratio))
            b_c = int(70 * alpha_ratio + 26 * (1 - alpha_ratio))
            draw.ellipse([cx - int(r * 1.6), cy - r, cx + int(r * 1.6), cy + r], fill=(r_c, g_c, b_c))

        img.save(output_path)
        print(f"[SUCCESS] Created atmospheric sacred oil painting canvas at {output_path}", flush=True)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to create sacred canvas: {e}", flush=True)
        return False

def render_api_video_overlay(image_path: str, current_idx: int, total_count: int, bead_text: str = "", day_num: int = 58, total_days: int = 175):
    """
    Renders exact 16:9 overlays:
    - 17 Vertical Elements on Left (RGBA) & Right (CMYK): Cross + 1 large + 3 small + 1 large + 10 small + 1 large bead.
    - 175 Day beads progress bar across bottom.
    - Text banner overlay with prayer text at bottom (guarantees text is 100% visible from t = 0.0s).
    """
    try:
        img = Image.open(image_path).convert("RGB")
        width, height = img.size
        draw = ImageDraw.Draw(img)

        # 17 Vertical Elements on Left & Right Strips
        TOTAL_STRIP_BEADS = 17
        active_bead_slot = (current_idx - 1) % TOTAL_STRIP_BEADS

        # 1. Left RGBA Strip
        left_x = 40
        start_y, end_y = 65, height - 145
        draw.line([left_x, start_y, left_x, end_y], fill=(50, 70, 110), width=2)

        for i in range(TOTAL_STRIP_BEADS):
            by = int(start_y + i * ((end_y - start_y) / (TOTAL_STRIP_BEADS - 1)))
            is_active = (i == active_bead_slot)

            if i == 0:  # Cross
                color = (255, 235, 120) if is_active else (212, 175, 55)
                r = 10 if is_active else 6
            elif i in (1, 5, 16):  # Large beads
                color = (255, 235, 120) if is_active else (220, 160, 60)
                r = 9 if is_active else 6
            else:  # Small beads
                color = (255, 235, 120) if is_active else (70, 130, 200)
                r = 7 if is_active else 4

            if is_active:
                draw.ellipse([left_x - r - 4, by - r - 4, left_x + r + 4, by + r + 4], fill=(255, 235, 120), outline=(255, 215, 0), width=2)
            else:
                draw.ellipse([left_x - r, by - r, left_x + r, by + r], fill=color)

        # 2. Right CMYK Strip
        right_x = width - 40
        draw.line([right_x, start_y, right_x, end_y], fill=(110, 70, 50), width=2)

        for i in range(TOTAL_STRIP_BEADS):
            by = int(start_y + i * ((end_y - start_y) / (TOTAL_STRIP_BEADS - 1)))
            is_active = (i == active_bead_slot)

            if i == 0:  # Cross
                color = (255, 215, 100) if is_active else (212, 175, 55)
                r = 10 if is_active else 6
            elif i in (1, 5, 16):  # Large beads
                color = (255, 215, 100) if is_active else (210, 130, 60)
                r = 9 if is_active else 6
            else:  # Small beads
                color = (255, 215, 100) if is_active else (180, 90, 60)
                r = 7 if is_active else 4

            if is_active:
                draw.ellipse([right_x - r - 4, by - r - 4, right_x + r + 4, by + r + 4], fill=(255, 215, 100), outline=(255, 180, 0), width=2)
            else:
                draw.ellipse([right_x - r, by - r, right_x + r, by + r], fill=color)

        # 3. Bottom 175 Cycle Days Progress Bar
        bar_height = 55
        bar_y = height - bar_height
        draw.rectangle([0, bar_y, width, height], fill=(12, 10, 20))

        margin_x = 60
        usable_w = width - (margin_x * 2)
        day_step = usable_w / max(total_days - 1, 1)
        bead_y = bar_y + 30

        draw.line([margin_x, bead_y, width - margin_x, bead_y], fill=(45, 50, 65), width=1)
        for d in range(total_days):
            bx = margin_x + int(d * day_step)
            d_num = d + 1
            if d_num < day_num:
                draw.ellipse([bx - 1, bead_y - 1, bx + 1, bead_y + 1], fill=(212, 175, 55))
            elif d_num == day_num:
                draw.ellipse([bx - 5, bead_y - 5, bx + 5, bead_y + 5], fill=(255, 235, 120), outline=(255, 215, 0), width=2)

        # 4. Top Header & Badge
        draw.rectangle([0, 0, width, 45], fill=(18, 16, 28))
        draw.text((20, 14), f"RHZ365 • Dzień {day_num} z {total_days} (Cykl II)", fill=(212, 175, 55))
        draw.text((width - 440, 14), f"📿 Paciorek {current_idx} z {total_count}", fill=(240, 220, 140))

        # 5. Bottom Prayer Text Overlay Banner
        if bead_text:
            text_box_y1 = height - 135
            text_box_y2 = height - 58
            draw.rectangle([0, text_box_y1, width, text_box_y2], fill=(10, 12, 22))

            display_text = bead_text.strip()
            if len(display_text) > 90:
                display_text = display_text[:87] + "..."

            draw.text((width // 2, text_box_y1 + 22), display_text, fill=(255, 255, 255), anchor="mm")

        img.save(image_path)
    except Exception as e:
        print(f"[WARNING] Overlay error on {image_path}: {e}", flush=True)

def run_api_pipeline(text: str, output_dir: str = "output", output_mp4: str = "final_widokinaraj_169.mp4"):
    """Full API automated video pipeline execution."""
    os.makedirs(output_dir, exist_ok=True)
    from analyze import analyze_text
    
    # 1. Parse prayer text into bead segments
    print("[API PIPELINE] Parsing prayer text into bead segments...", flush=True)
    segments = analyze_text(text, input_type="prayer")
    total_segs = max(len(segments), 1)

    # 2. Generate AI images per bead
    for idx, seg in enumerate(segments, 1):
        img_path = os.path.join(output_dir, f"img_{idx:03d}.png")
        seg["image_path"] = img_path
        fetch_ai_image(seg["text"], img_path, bead_idx=idx)
        render_api_video_overlay(img_path, idx, total_segs, bead_text=seg["text"])

    # 3. Generate narration audio & timestamps via ElevenLabs API
    full_text = " ".join(seg["text"] for seg in segments)
    audio_path = os.path.join(output_dir, "narration.mp3")
    word_timestamps = fetch_elevenlabs_voice_with_timestamps(full_text, audio_path)

    # 4. Generate ASS Karaoke Subtitles with intact word splitting
    from assemble_video import generate_ass_karaoke_subtitles, render_video
    ass_path = os.path.join(output_dir, "narration.ass")
    generate_ass_karaoke_subtitles(segments, {}, ass_path)

    # 5. Assemble final video via FFmpeg
    render_video(segments, audio_path, output_mp4, srt_path=ass_path)
    print(f"[API PIPELINE SUCCESS] Final video rendered to {output_mp4}", flush=True)
    return output_mp4

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Automated API Video Engine for RHZ365")
    parser.add_argument("--text", type=str, required=True, help="Prayer text input")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory")
    parser.add_argument("--output-mp4", type=str, default="output/final_widokinaraj_169.mp4", help="Output MP4 file path")
    args = parser.parse_args()

    run_api_pipeline(args.text, args.output_dir, args.output_mp4)
