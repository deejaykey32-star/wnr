import os
import sys
import json
import asyncio
import urllib.parse
import requests
import argparse
from dotenv import load_dotenv

load_dotenv()

def _save_as_clean_png(image_bytes: bytes, output_path: str) -> bool:
    """Helper to convert any downloaded image format (JPEG, WebP, PNG) into standard clean RGB PNG."""
    import io
    from PIL import Image
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.save(output_path, "PNG")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to convert image to PNG: {e}")
        return False

def generate_pollinations_image(prompt: str, output_path: str, retries: int = 3) -> bool:
    """Generates a 16:9 image using Pollinations.ai (with API Key support and retries)."""
    import random
    pol_key = os.getenv("POLLINATIONS_API_KEY")
    encoded_prompt = urllib.parse.quote(prompt)
    
    headers = {}
    if pol_key and pol_key != "your_pollinations_api_key_here":
        headers["Authorization"] = f"Bearer {pol_key}"

    for attempt in range(1, retries + 1):
        try:
            seed = random.randint(1, 999999)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}"
            if pol_key and pol_key != "your_pollinations_api_key_here":
                url += f"&key={pol_key}"
                
            res = requests.get(url, headers=headers, timeout=30)
            if res.status_code == 200 and len(res.content) > 1000:
                if _save_as_clean_png(res.content, output_path):
                    print(f"[SUCCESS] Saved 16:9 image from Pollinations.ai (API Key Active) to {output_path} (Attempt {attempt})")
                    return True
            else:
                print(f"[WARNING] Pollinations API attempt {attempt} status: {res.status_code}")
        except Exception as e:
            print(f"[WARNING] Pollinations attempt {attempt} failed: {e}")
    return False

def generate_openai_image(prompt: str, output_path: str, api_key: str = None) -> bool:
    """Generates a 16:9 image using OpenAI DALL-E 3."""
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key or key == "your_openai_api_key_here":
        print("[WARNING] OPENAI_API_KEY missing for DALL-E 3 image generation.")
        return False

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        res = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            n=1
        )
        img_url = res.data[0].url
        img_data = requests.get(img_url, timeout=60).content
        if _save_as_clean_png(img_data, output_path):
            print(f"[SUCCESS] Saved 16:9 OpenAI DALL-E 3 image to {output_path}")
            return True
        return False
    except Exception as e:
        print(f"[ERROR] OpenAI DALL-E 3 image generation failed: {e}")
        return False

def generate_image(prompt: str, negative_prompt: str, output_path: str, provider: str = None) -> bool:
    """
    Main router for image generation.
    Supports providers: 'pollinations' (Pollinations AI with API key), 'openai' (DALL-E 3).
    """
    chosen_provider = (provider or os.getenv("IMAGE_PROVIDER", "pollinations")).lower()

    if chosen_provider == "openai":
        if generate_openai_image(prompt, output_path):
            return True

    # Primary: Pollinations.ai
    if generate_pollinations_image(prompt, output_path):
        return True

    return _generate_placeholder_image(prompt, output_path)

def _generate_placeholder_image(prompt: str, output_path: str) -> bool:
    """Generates a clean 16:9 minimalist pastel background image with text summary as fallback."""
    try:
        from PIL import Image, ImageDraw
        width, height = 1344, 768
        img = Image.new("RGB", (width, height), color=(235, 240, 245))
        draw = ImageDraw.Draw(img)
        draw.ellipse([width*0.2, height*0.15, width*0.8, height*0.85], fill=(220, 230, 240), outline=(200, 210, 225), width=2)
        draw.rectangle([0, height-80, width, height], fill=(210, 220, 235))
        label = "widokinaraj.pl | Minimalist Visual Scene"
        draw.text((40, 40), label, fill=(100, 110, 130))
        draw.text((40, height - 60), f"Prompt: {prompt[:80]}...", fill=(80, 90, 110))
        img.save(output_path)
        print(f"[FALLBACK] Created 16:9 canvas at {output_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to generate placeholder image: {e}")
        return False

def generate_fish_audio_voice_clone(full_text: str, speaker_wav: str = None, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Clones voice from sample audio file (e.g. VID-20260727-WA0000.mp3) using Fish.audio API.
    """
    wav_path = speaker_wav or os.getenv("VOICE_SAMPLE_PATH", r"c:\proj\wnr\VID-20260727-WA0000.mp3")
    fish_key = os.getenv("FISH_AUDIO_API_KEY")

    if not fish_key or fish_key == "your_fish_audio_api_key_here":
        print("[WARNING] FISH_AUDIO_API_KEY missing. Fallback to other providers.")
        return None

    if not os.path.exists(wav_path):
        print(f"[WARNING] Sample audio for voice cloning not found at {wav_path}")
        return None

    try:
        print(f"[VOICE CLONING] Cloning voice from {wav_path} using Fish.audio API...")
        
        # Fish.audio requires reference audio to clone. We can upload the file as a reference.
        # First, upload/register the reference audio to get reference_id, or send directly if API supports it.
        # To make it simple and robust, we use the standard TTS request sending the reference audio.
        url = "https://api.fish.audio/v1/tts"
        headers = {
            "Authorization": f"Bearer {fish_key}"
        }
        
        # Fish.audio expects multipart/form-data for TTS with reference audio
        with open(wav_path, "rb") as f_ref:
            files = {
                "reference_audio": (os.path.basename(wav_path), f_ref, "audio/mpeg")
            }
            data = {
                "text": full_text,
                "format": "mp3",
                "normalize": "true",
                "latency": "normal"
            }
            
            res = requests.post(url, headers=headers, data=data, files=files, timeout=120)
            
        if res.status_code != 200:
            print(f"[ERROR] Fish.audio request failed ({res.status_code}): {res.text}")
            return None
            
        with open(output_audio, "wb") as f_out:
            f_out.write(res.content)
            
        if os.path.exists(output_audio) and os.path.getsize(output_audio) > 0:
            total_chars = max(len(full_text), 1)
            duration_sec = max(3.0, total_chars / 14.5)
            characters = list(full_text)
            char_dur = duration_sec / total_chars
            alignment = {
                "characters": characters,
                "character_start_times_seconds": [i * char_dur for i in range(len(characters))],
                "character_end_times_seconds": [(i + 1) * char_dur for i in range(len(characters))]
            }
            with open(output_timing, "w", encoding="utf-8") as f:
                json.dump(alignment, f, ensure_ascii=False, indent=2)
                
            print(f"[SUCCESS] Fish.audio cloned voice saved to {output_audio}")
            return alignment
    except Exception as e:
        print(f"[WARNING] Fish.audio Voice Cloning failed: {e}")
        return None


def generate_edge_tts_audio(full_text: str, voice: str = None, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Generates narration using Microsoft Edge Neural TTS (100% FREE, zero cost, no API keys).
    """
    voice_name = voice or os.getenv("EDGE_VOICE", "pl-PL-MarekNeural")
    try:
        import edge_tts
        
        async def _run():
            communicate = edge_tts.Communicate(full_text, voice_name)
            await communicate.save(output_audio)
            
        asyncio.run(_run())
        
        if os.path.exists(output_audio) and os.path.getsize(output_audio) > 0:
            total_chars = max(len(full_text), 1)
            duration_sec = max(3.0, total_chars / 14.5)
            characters = list(full_text)
            char_dur = duration_sec / total_chars
            
            alignment = {
                "characters": characters,
                "character_start_times_seconds": [i * char_dur for i in range(len(characters))],
                "character_end_times_seconds": [(i + 1) * char_dur for i in range(len(characters))]
            }
            with open(output_timing, "w", encoding="utf-8") as f:
                json.dump(alignment, f, ensure_ascii=False, indent=2)
                
            print(f"[SUCCESS] Edge Neural TTS ({voice_name}) audio saved to {output_audio}")
            return alignment
        else:
            return None
    except Exception as e:
        print(f"[ERROR] Edge-TTS generation failed: {e}")
        return None

def generate_openai_audio(full_text: str, voice: str = "alloy", output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json", api_key: str = None) -> dict:
    """
    Generates narration using OpenAI TTS (tts-1 model, ultra low cost $0.015 / 1k chars).
    """
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key or key == "your_openai_api_key_here":
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=full_text
        )
        response.stream_to_file(output_audio)
        
        total_chars = max(len(full_text), 1)
        duration_sec = max(3.0, total_chars / 14.5)
        characters = list(full_text)
        char_dur = duration_sec / total_chars
        
        alignment = {
            "characters": characters,
            "character_start_times_seconds": [i * char_dur for i in range(len(characters))],
            "character_end_times_seconds": [(i + 1) * char_dur for i in range(len(characters))]
        }
        with open(output_timing, "w", encoding="utf-8") as f:
            json.dump(alignment, f, ensure_ascii=False, indent=2)

        print(f"[SUCCESS] OpenAI TTS audio saved to {output_audio}")
        return alignment
    except Exception as e:
        print(f"[ERROR] OpenAI TTS generation failed: {e}")
        return None

def generate_narration_audio(full_text: str, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Main voice/audio router.
    1. Tries Voice Cloning ('clone') from sample mp3 (VID-20260727-WA0000.mp3).
    2. Tries Microsoft Edge Neural TTS ('edge' - 100% Free).
    3. Tries OpenAI TTS ('openai').
    4. Fallback to synthetic timing.
    """
    provider = os.getenv("VOICE_PROVIDER", "clone").lower()
    
    if provider == "clone":
        alignment = generate_fish_audio_voice_clone(full_text, output_audio=output_audio, output_timing=output_timing)
        if alignment:
            return alignment

    if provider == "openai":
        alignment = generate_openai_audio(full_text, output_audio=output_audio, output_timing=output_timing)
        if alignment:
            return alignment

    # Default & primary: Edge Neural TTS (Free)
    alignment = generate_edge_tts_audio(full_text, output_audio=output_audio, output_timing=output_timing)
    if alignment:
        return alignment

    # Fallback to OpenAI TTS
    alignment = generate_openai_audio(full_text, output_audio=output_audio, output_timing=output_timing)
    if alignment:
        return alignment

    return _generate_fallback_audio(full_text, output_audio, output_timing)

def _generate_fallback_audio(text: str, output_audio: str, output_timing: str) -> dict:
    """Generates silent/tone audio file and estimated timestamps based on reading speed (approx 15 chars/sec)."""
    words = text.split()
    total_chars = max(len(text), 1)
    estimated_duration = max(3.0, total_chars / 14.0)
    
    characters = list(text)
    char_dur = estimated_duration / total_chars
    
    alignment = {
        "characters": characters,
        "character_start_times_seconds": [i * char_dur for i in range(len(characters))],
        "character_end_times_seconds": [(i + 1) * char_dur for i in range(len(characters))]
    }
    
    with open(output_timing, "w", encoding="utf-8") as f:
        json.dump(alignment, f, ensure_ascii=False, indent=2)
        
    try:
        import subprocess
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", f"{estimated_duration:.2f}",
            "-c:a", "libmp3lame",
            output_audio
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        print(f"[FALLBACK] Generated silent MP3 of duration {estimated_duration:.2f}s using ffmpeg.")
    except Exception as e:
        print(f"[ERROR] Failed to generate fallback silent MP3 using ffmpeg: {e}")
        
    print(f"[FALLBACK] Generated estimated timestamps for {len(words)} words over {estimated_duration:.2f}s")
    return alignment

def process_media_generation(segments_file: str, output_dir: str = "output"):
    os.makedirs(output_dir, exist_ok=True)
    with open(segments_file, "r", encoding="utf-8") as f:
        segments = json.load(f)

    # 1. Generate 16:9 images for each segment (Pollinations AI with API key / OpenAI DALL-E 3)
    for idx, seg in enumerate(segments, 1):
        img_filename = f"img_{idx:03d}.png"
        img_path = os.path.join(output_dir, img_filename)
        seg["image_path"] = img_path
        generate_image(seg["prompt"], seg["negative_prompt"], img_path)

    # 2. Combine text and generate narration audio & timestamps (Voice Cloning from MP3 / Edge TTS)
    full_text = "\n\n".join([seg["text"] for seg in segments])
    audio_path = os.path.join(output_dir, "narration.mp3")
    timing_path = os.path.join(output_dir, "narration_timestamps.json")
    alignment = generate_narration_audio(full_text, output_audio=audio_path, output_timing=timing_path)

    # Update segments file with image paths
    with open(segments_file, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Media generation complete for {len(segments)} segments.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate images & Voice audio (Voice Cloning / Edge Neural TTS / Pollinations).")
    parser.add_argument("--segments", type=str, default="segments.json", help="Path to segments JSON file")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory")
    args = parser.parse_args()

    process_media_generation(args.segments, args.output_dir)
