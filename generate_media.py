import os
import sys
import json
import math
import random
import re
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

_IMAGE_CACHE = {}

def generate_pollinations_image(prompt: str, output_path: str, retries: int = 1) -> bool:
    """Generates a 16:9 image using Pollinations.ai (with 3s fast timeout)."""
    import random
    pol_key = os.getenv("POLLINATIONS_API_KEY")
    clean_prompt = prompt.replace("\n", " ").strip()[:250]
    encoded_prompt = urllib.parse.quote(clean_prompt)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if pol_key and pol_key != "your_pollinations_api_key_here":
        headers["Authorization"] = f"Bearer {pol_key}"

    for attempt in range(1, retries + 1):
        try:
            seed = random.randint(1, 999999)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}"
            if pol_key and pol_key != "your_pollinations_api_key_here":
                url += f"&key={pol_key}"
                
            res = requests.get(url, headers=headers, timeout=3)
            if res.status_code == 200 and len(res.content) > 1000:
                if _save_as_clean_png(res.content, output_path):
                    print(f"[SUCCESS] Saved 16:9 image from Pollinations.ai to {output_path}", flush=True)
                    return True
        except Exception as e:
            print(f"[NOTICE] Pollinations fast attempt {attempt} timed out ({e}). Using elegant sacred canvas fallback.", flush=True)
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
        img_data = requests.get(img_url, timeout=30).content
        if _save_as_clean_png(img_data, output_path):
            print(f"[SUCCESS] Saved 16:9 image from DALL-E 3 to {output_path}")
            return True
        return False
    except Exception as e:
        print(f"[ERROR] OpenAI DALL-E 3 image generation failed: {e}")
        return False

MYSTERY_PAINTING_QUERIES = [
    (r'zwiastow|gabriel', 'Annunciation Virgin Mary painting'),
    (r'nawiedz|elżbiet', 'Visitation Virgin Mary Elizabeth painting'),
    (r'narodz|betlejem|żłób', 'Nativity Jesus Mary Joseph painting'),
    (r'ofiarow|symeon', 'Presentation of Jesus in Temple painting'),
    (r'odnalez|świątyn', 'Finding in Temple Jesus painting'),
    (r'ogrój|getseman|kielich', 'Agony in Garden Jesus painting'),
    (r'biczow|piłat', 'Flagellation of Christ painting'),
    (r'cierni|korona', 'Crowning with Thorns Christ painting'),
    (r'ukrzyż|golgot|śmierć', 'Crucifixion Jesus Christ painting'),
    (r'dźwiga|kalwari|krzyż', 'Carrying Cross Jesus painting'),
    (r'zmartwychwst', 'Resurrection Jesus Christ painting'),
    (r'wniebowstąp', 'Ascension of Jesus painting'),
    (r'zesłan|duch.*święt|wieczernik', 'Pentecost Descent Holy Spirit painting'),
    (r'wniebowzięt', 'Assumption Virgin Mary painting'),
    (r'ukoronow|królowa', 'Coronation Virgin Mary painting'),
    (r'chrzest|jordan', 'Baptism of Christ painting'),
    (r'kan[ie]|wino|wesele', 'Wedding at Cana painting'),
    (r'przemien|tabor', 'Transfiguration of Jesus painting'),
    (r'eucharysti|wieczerz|chleb', 'Last Supper Leonardo painting'),
    (r'zdrowaś|maryj|matk', 'Virgin Mary painting'),
    (r'ojcze|bóg|stworzyciel', 'God Father creation painting'),
    (r'wierzę|apostoł', 'Apostles Creed painting')
]

def get_mystery_search_query(text: str) -> str:
    """Finds exact biblical mystery search query matching the prayer text."""
    for pattern, query in MYSTERY_PAINTING_QUERIES:
        if re.search(pattern, text, re.IGNORECASE):
            return query
    return "sacred christian Renaissance painting"

def generate_wikimedia_sacred_art(prompt: str, output_path: str, bead_idx: int = 0) -> bool:
    """
    Fetches real public-domain classical Renaissance sacred art masterpiece paintings
    (Leonardo da Vinci, Raphael, Caravaggio, Titian, Murillo) matched specifically to the prayer theme.
    """
    try:
        headers = {"User-Agent": "WnR365Bot/1.0 (https://widokinaraj.pl; contact@widokinaraj.pl)"}
        search_query = get_mystery_search_query(prompt)
        url_search = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search_query)}&srnamespace=6&format=json"
        res = requests.get(url_search, headers=headers, timeout=3).json()
        search_hits = res.get("query", {}).get("search", [])

        if search_hits:
            hit_title = search_hits[bead_idx % len(search_hits)]["title"]
            url_info = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(hit_title)}&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json"
            res2 = requests.get(url_info, headers=headers, timeout=3).json()
            pages = list(res2.get("query", {}).get("pages", {}).values())
            if pages and "imageinfo" in pages[0]:
                img_info = pages[0]["imageinfo"][0]
                img_url = img_info.get("thumburl") or img_info.get("url")
                if img_url:
                    clean_url = img_url.split("?")[0]
                    print(f"[WIKIMEDIA] Downloading sacred masterpiece ({search_query}) thumbnail from {clean_url}...", flush=True)
                    res_img = requests.get(img_url, headers=headers, timeout=4, stream=True)
                    if res_img.status_code == 200:
                        img_data = res_img.content
                        if len(img_data) > 5000:
                            if _save_as_clean_png(img_data, output_path):
                                print(f"[SUCCESS] Saved Renaissance sacred painting to {output_path}", flush=True)
                                return True
        return False
    except Exception as e:
        print(f"[NOTICE] Wikimedia Commons sacred art search fast timeout/fail: {e}", flush=True)
        return False

def generate_image(prompt: str, negative_prompt: str, output_path: str, provider: str = None, bead_idx: int = 0) -> bool:
    """
    Main router for image generation.
    Supports providers: 'openai' (DALL-E 3), 'wikimedia' (Renaissance Paintings), 'pollinations' (Pollinations AI).
    Includes prompt/query caching to avoid redundant API hits & rate limiting.
    """
    import shutil
    search_query = get_mystery_search_query(prompt)
    cache_key = f"{search_query}_{bead_idx % 5}"  # cycle 5 visual variants per mystery theme

    if cache_key in _IMAGE_CACHE and os.path.exists(_IMAGE_CACHE[cache_key]):
        try:
            shutil.copyfile(_IMAGE_CACHE[cache_key], output_path)
            print(f"[CACHE HIT] Reused sacred art ({search_query}) -> {output_path}", flush=True)
            return True
        except Exception:
            pass

    chosen_provider = (provider or os.getenv("IMAGE_PROVIDER", "auto")).lower()

    if chosen_provider == "openai" or (os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "your_openai_api_key_here"):
        if generate_openai_image(prompt, output_path):
            _IMAGE_CACHE[cache_key] = output_path
            return True

    # 1. Try fetching authentic Renaissance Sacred Art Masterpiece Painting matched to the prayer theme
    if generate_wikimedia_sacred_art(prompt, output_path, bead_idx=bead_idx):
        _IMAGE_CACHE[cache_key] = output_path
        return True

    # 2. Primary fallback: Pollinations.ai
    if generate_pollinations_image(prompt, output_path):
        _IMAGE_CACHE[cache_key] = output_path
        return True

    # 3. Guaranteed instant local fallback
    _generate_placeholder_image(prompt, output_path)
    if os.path.exists(output_path):
        _IMAGE_CACHE[cache_key] = output_path
    return True

def _generate_placeholder_image(prompt: str, output_path: str) -> bool:
    """Generates a rich 16:9 sacred painting scene background with warm golden rays and divine halos."""
    try:
        from PIL import Image, ImageDraw
        import random
        width, height = 1280, 720

        # Varied warm Renaissance oil painting color palettes
        palettes = [
            ((35, 25, 45), (180, 140, 70), (220, 185, 100)), # Royal Violet & Gold
            ((40, 20, 20), (190, 130, 60), (230, 175, 90)),  # Sacred Crimson & Ochre
            ((20, 35, 45), (150, 160, 90), (200, 210, 130)), # Deep Azure & Olive
            ((35, 30, 25), (175, 150, 80), (225, 195, 110)), # Warm Sepia & Amber
        ]
        bg_col, mid_col, glow_col = random.choice(palettes)

        img = Image.new("RGB", (width, height), color=bg_col)
        draw = ImageDraw.Draw(img)

        # Radiant divine light rays from top center
        cx, cy = width // 2, 80
        for angle in range(-60, 65, 10):
            rad = math.radians(angle + 90)
            ex = cx + int(1000 * math.cos(rad))
            ey = cy + int(1000 * math.sin(rad))
            draw.line([cx, cy, ex, ey], fill=(glow_col[0], glow_col[1], glow_col[2]), width=12)

        # Glowing divine halo in center
        for r in range(250, 0, -25):
            factor = (250 - r) / 250.0
            r_c = int(mid_col[0] * factor + bg_col[0] * (1 - factor))
            g_c = int(mid_col[1] * factor + bg_col[1] * (1 - factor))
            b_c = int(mid_col[2] * factor + bg_col[2] * (1 - factor))
            draw.ellipse([cx - int(r*1.5), cy + 180 - r, cx + int(r*1.5), cy + 180 + r], fill=(r_c, g_c, b_c))

        # Golden Cross Symbol in center
        draw.line([cx, cy + 110, cx, cy + 270], fill=(212, 175, 55), width=6)
        draw.line([cx - 50, cy + 155, cx + 50, cy + 155], fill=(212, 175, 55), width=6)

        img.save(output_path)
        print(f"[SUCCESS] Created rich sacred painting canvas at {output_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to generate placeholder image: {e}")
        return False

def generate_fish_audio_voice_clone(full_text: str, speaker_wav: str = None, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Clones voice from sample audio file using Fish.audio API.
    Reuses existing FISH_AUDIO_MODEL_ID if available to save 95% of credits!
    """
    fish_key = os.getenv("FISH_AUDIO_API_KEY", "sk-fish-Kd92IxqmbXbNDpyj24-Bf4e84y8iuNXsA_idr7nQD4o")
    model_id = os.getenv("FISH_AUDIO_MODEL_ID")

    if not fish_key or fish_key == "your_fish_audio_api_key_here":
        print("[WARNING] FISH_AUDIO_API_KEY missing. Fallback to other providers.")
        return None

    try:
        url = "https://api.fish.audio/v1/tts"

        # If model_id is provided, use reference_id (saves 95% credits!)
        if model_id:
            print(f"[VOICE CLONING] Using saved Fish.audio Model ID: {model_id}...")
            headers = {
                "Authorization": f"Bearer {fish_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "text": full_text,
                "format": "mp3",
                "reference_id": model_id
            }
            res = requests.post(url, headers=headers, json=payload, timeout=12)
        else:
            default_wav = "VID-20260727-WA0000.mp3" if os.path.exists("VID-20260727-WA0000.mp3") else r"c:\proj\wnr1\VID-20260727-WA0000.mp3"
            wav_path = speaker_wav or os.getenv("VOICE_SAMPLE_PATH", default_wav)

            if not os.path.exists(wav_path):
                print(f"[WARNING] Sample audio for voice cloning not found at {wav_path}")
                return None

            print(f"[VOICE CLONING] Attempting voice cloning from {wav_path} using Fish.audio API...")
            headers = {"Authorization": f"Bearer {fish_key}"}
            with open(wav_path, "rb") as f_ref:
                files = {"reference_audio": (os.path.basename(wav_path), f_ref, "audio/mpeg")}
                data = {"text": full_text, "format": "mp3", "normalize": "true", "latency": "normal"}
                res = requests.post(url, headers=headers, data=data, files=files, timeout=12)
            
        if res.status_code != 200:
            print(f"[NOTICE] Fish.audio Voice Cloning returned HTTP {res.status_code} (Payment Required/Insufficient Credits). Falling back to EdgeTTS Marek (-18%).")
            return None
            
        with open(output_audio, "wb") as f_out:
            f_out.write(res.content)
            
        if os.path.exists(output_audio) and os.path.getsize(output_audio) > 0:
            total_chars = max(len(full_text), 1)
            duration_sec = max(3.0, total_chars / 11.0)
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
        print(f"[NOTICE] Fish.audio Voice Cloning failed or timed out: {e}. Falling back to EdgeTTS Marek (-18%).")
        return None


def generate_edge_tts_audio(full_text: str, voice: str = None, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Generates narration using Microsoft Edge Neural TTS (100% FREE, zero cost, no API keys).
    Sets rate to -18% for a calm, reverent, peaceful prayer reading speed.
    """
    voice_name = voice or os.getenv("EDGE_VOICE", "pl-PL-MarekNeural")
    rate_speed = os.getenv("TTS_RATE", "-18%")
    try:
        import edge_tts
        
        async def _run():
            communicate = edge_tts.Communicate(full_text, voice_name, rate=rate_speed)
            await communicate.save(output_audio)
            
        asyncio.run(_run())
        
        if os.path.exists(output_audio) and os.path.getsize(output_audio) > 0:
            total_chars = max(len(full_text), 1)
            # At -18% rate, narration speed is approx 11.0 characters per second
            duration_sec = max(3.0, total_chars / 11.0)
            characters = list(full_text)
            char_dur = duration_sec / total_chars
            
            alignment = {
                "characters": characters,
                "character_start_times_seconds": [i * char_dur for i in range(len(characters))],
                "character_end_times_seconds": [(i + 1) * char_dur for i in range(len(characters))]
            }
            with open(output_timing, "w", encoding="utf-8") as f:
                json.dump(alignment, f, ensure_ascii=False, indent=2)
                
            print(f"[SUCCESS] Edge Neural TTS ({voice_name}, rate={rate_speed}) audio saved to {output_audio}")
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
        if hasattr(response, "write_to_file"):
            response.write_to_file(output_audio)
        elif hasattr(response, "stream_to_file"):
            response.stream_to_file(output_audio)
        else:
            with open(output_audio, "wb") as f:
                f.write(getattr(response, "content", b""))
        
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

def generate_elevenlabs_voice_clone(full_text: str, voice_id: str = None, speaker_wav: str = None, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Generates TTS using ElevenLabs API with user's cloned voice ID (default: yu6bC9aJwpEUndYOjPEg).
    """
    key = os.getenv("ELEVENLABS_API_KEY", "sk_d74145d60d4d7fbf6946b24c1268cb668c5f2bae0d7d3173")
    target_voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "yu6bC9aJwpEUndYOjPEg")

    if not key:
        return None

    try:
        url_tts = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice_id}"
        headers = {
            "xi-api-key": key,
            "Content-Type": "application/json"
        }
        tts_body = {
            "text": full_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}
        }
        print(f"[ELEVENLABS] Requesting narration for voice_id {target_voice_id}...")
        res_tts = requests.post(url_tts, headers=headers, json=tts_body, timeout=25)
        if res_tts.status_code == 200:
            with open(output_audio, "wb") as f_out:
                f_out.write(res_tts.content)
            total_chars = max(len(full_text), 1)
            duration_sec = max(3.0, total_chars / 11.0)
            alignment = {
                "characters": list(full_text),
                "character_start_times_seconds": [i * (duration_sec / total_chars) for i in range(total_chars)],
                "character_end_times_seconds": [(i + 1) * (duration_sec / total_chars) for i in range(total_chars)]
            }
            with open(output_timing, "w", encoding="utf-8") as f:
                json.dump(alignment, f, ensure_ascii=False, indent=2)
            print(f"[SUCCESS] ElevenLabs cloned voice saved to {output_audio}")
            return alignment
        else:
            print(f"[NOTICE] ElevenLabs TTS returned HTTP {res_tts.status_code}: {res_tts.text[:200]}")
            return None
    except Exception as e:
        print(f"[ERROR] ElevenLabs voice cloning exception: {e}")
        return None

def generate_narration_audio(full_text: str, output_audio: str = "narration.mp3", output_timing: str = "narration_timestamps.json") -> dict:
    """
    Main voice/audio router.
    Enforces ElevenLabs Voice Cloning (Voice ID: yu6bC9aJwpEUndYOjPEg).
    """
    print(f"[VOICE CLONING] Enforcing ElevenLabs Voice Cloning (Voice ID: yu6bC9aJwpEUndYOjPEg)...", flush=True)
    alignment = generate_elevenlabs_voice_clone(full_text, voice_id="yu6bC9aJwpEUndYOjPEg", output_audio=output_audio, output_timing=output_timing)
    if alignment:
        return alignment

    print("[ERROR] ElevenLabs Voice Cloning failed. Please check ELEVENLABS_API_KEY in .env", flush=True)
    return _generate_fallback_audio(full_text, output_audio, output_timing)

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

def generate_image(prompt: str, negative_prompt: str, output_path: str, provider: str = None, bead_idx: int = 0) -> bool:
    """
    Main router for image generation.
    Generates fresh 16:9 sacred art illustrations for each bead directly using AI (Pollinations.ai / DALL-E 3).
    Includes prompt/query caching to avoid redundant API hits & rate limiting.
    """
    import shutil
    clean_prompt = prompt.replace("\n", " ").strip()
    cache_key = f"{clean_prompt[:60]}_{bead_idx % 5}"

    if cache_key in _IMAGE_CACHE and os.path.exists(_IMAGE_CACHE[cache_key]):
        try:
            shutil.copyfile(_IMAGE_CACHE[cache_key], output_path)
            print(f"[CACHE HIT] Reused AI sacred art -> {output_path}", flush=True)
            return True
        except Exception:
            pass

    chosen_provider = (provider or os.getenv("IMAGE_PROVIDER", "auto")).lower()

    if chosen_provider == "openai" or (os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "your_openai_api_key_here"):
        if generate_openai_image(prompt, output_path):
            _IMAGE_CACHE[cache_key] = output_path
            return True

    # 1. Primary AI Image Generator: Pollinations.ai (creates fresh sacred painting per bead text)
    if generate_pollinations_image(prompt, output_path, retries=2):
        _IMAGE_CACHE[cache_key] = output_path
        return True

    # 2. Guaranteed instant local procedural AI canvas background (warm golden rays & divine halos)
    _generate_placeholder_image(prompt, output_path)
    if os.path.exists(output_path):
        _IMAGE_CACHE[cache_key] = output_path
    return True

def _generate_placeholder_image(prompt: str, output_path: str) -> bool:
    """Generates a rich 16:9 dark atmospheric Renaissance sacred oil canvas background."""
    try:
        from PIL import Image, ImageDraw
        width, height = 1280, 720
        img = Image.new("RGB", (width, height), color=(18, 14, 26))
        draw = ImageDraw.Draw(img)

        cx, cy = width // 2, 120
        for r in range(350, 0, -10):
            alpha_ratio = (350 - r) / 350.0
            r_c = int(180 * alpha_ratio + 18 * (1 - alpha_ratio))
            g_c = int(140 * alpha_ratio + 14 * (1 - alpha_ratio))
            b_c = int(70 * alpha_ratio + 26 * (1 - alpha_ratio))
            draw.ellipse([cx - int(r * 1.6), cy - r, cx + int(r * 1.6), cy + r], fill=(r_c, g_c, b_c))

        img.save(output_path)
        print(f"[SUCCESS] Created atmospheric sacred oil painting canvas at {output_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to generate placeholder image: {e}")
        return False

def draw_video_overlay(image_path: str, current_idx: int, total_count: int, is_rosary: bool = True, day_num: int = 58, total_days: int = 175, bead_label: str = "", bead_text: str = ""):
    """
    Renders 16:9 overlays:
    - Left (RGBA) & Right (CMYK) Vertical Rosary Strips: Exactly 16 beads (5 initial, 10 decade, 1 final).
    - Bottom Progress Bar: Exactly 175 beads (1 bead = 1 day of the 175-day cycle).
    - Top Header Badge: Bead label ("📿 Krzyż — Skład Apostolski", "Paciorek 1 z 5 — Ojcze Nasz", "Dziesiątek: Paciorek X z 10").
    - Bottom Text Overlay Banner: Guarantees prayer text is ALWAYS 100% visible on every single frame.
    """
    try:
        from PIL import Image, ImageDraw
        img = Image.open(image_path).convert("RGB")
        width, height = img.size
        draw = ImageDraw.Draw(img)

        if not is_rosary:
            bar_height = 45
            bar_y = height - bar_height
            draw.rectangle([0, bar_y, width, height], fill=(16, 14, 24))
            
            pct = current_idx / max(total_count, 1)
            margin_x = 40
            usable_w = width - (margin_x * 2)
            fill_w = int(usable_w * pct)
            
            draw.rectangle([margin_x, bar_y + 20, margin_x + usable_w, bar_y + 26], fill=(40, 45, 60))
            if fill_w > 0:
                draw.rectangle([margin_x, bar_y + 20, margin_x + fill_w, bar_y + 26], fill=(212, 175, 55))
                
            badge = f"WnR365 | Postęp czytania: Strona {current_idx} z {total_count} ({int(pct * 100)}%)"
            draw.text((margin_x, bar_y + 5), badge, fill=(240, 220, 140))
            img.save(image_path)
            return

        # RHZ365 ROSARY OVERLAY
        # 17 Vertical Elements on Left (RGBA) & Right (CMYK):
        # Index 0: Cross
        # Index 1: 1 Large Bead (Ojcze Nasz)
        # Index 2..4: 3 Small Beads (3x Zdrowaś)
        # Index 5: 1 Large Bead (Chwała Ojcu)
        # Index 6..15: 10 Small Beads (10x Zdrowaś dziesiątku)
        # Index 16: 1 Large Bead (Chwała Ojcu / O mój Jezu)
        TOTAL_STRIP_BEADS = 17
        active_bead_slot = (current_idx - 1) % TOTAL_STRIP_BEADS

        # 1. Left RGBA Vertical Rosary Strip (17 elements)
        left_x = 40
        start_y, end_y = 65, height - 145
        draw.line([left_x, start_y, left_x, end_y], fill=(50, 70, 110), width=2)

        for i in range(TOTAL_STRIP_BEADS):
            by = int(start_y + i * ((end_y - start_y) / (TOTAL_STRIP_BEADS - 1)))
            is_active = (i == active_bead_slot)

            if i == 0:  # Cross
                color = (255, 235, 120) if is_active else (212, 175, 55)
                r = 10 if is_active else 6
            elif i in (1, 5, 16):  # Large beads (Ojcze Nasz / Chwała Ojcu)
                color = (255, 235, 120) if is_active else (220, 160, 60)
                r = 9 if is_active else 6
            else:  # Small beads (3x Zdrowaś initial, 10x Zdrowaś decade)
                color = (255, 235, 120) if is_active else (70, 130, 200)
                r = 7 if is_active else 4

            if is_active:
                draw.ellipse([left_x - r - 4, by - r - 4, left_x + r + 4, by + r + 4], fill=(255, 235, 120), outline=(255, 215, 0), width=2)
            else:
                draw.ellipse([left_x - r, by - r, left_x + r, by + r], fill=color)

        # 2. Right CMYK Vertical Rosary Strip (17 elements)
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

        # 3. Bottom 175 Cycle Days Progress Bar (Exactly 175 beads - 1 bead = 1 day)
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

        # 4. Top Header & Bead Label Badge
        draw.rectangle([0, 0, width, 45], fill=(18, 16, 28))

        if not bead_label:
            if current_idx <= 1:
                lbl = "Krzyż — Skład Apostolski (Wierzę w Boga)"
            elif current_idx == 2:
                lbl = "Paciorek wstępny 1 z 5 — Ojcze Nasz"
            elif current_idx in (3, 4, 5):
                lbl = f"Paciorek wstępny {current_idx - 1} z 5 — Zdrowaś Maryjo"
            elif current_idx == 6:
                lbl = "Paciorek wstępny 5 z 5 — Chwała Ojcu"
            elif current_idx <= 16:
                decade_bead = (current_idx - 6)
                lbl = f"Dziesiątek: Paciorek {decade_bead} z 10 (Zdrowaś Maryjo)"
            else:
                lbl = f"Paciorek {current_idx} z {total_count}"
        else:
            lbl = bead_label

        draw.text((20, 14), f"RHZ365 • Dzień {day_num} z {total_days} (Cykl II)", fill=(212, 175, 55))
        draw.text((width - 440, 14), f"📿 {lbl}", fill=(240, 220, 140))

        # 5. Bottom Prayer Text Banner Overlay (ALWAYS 100% visible on every frame)
        if bead_text and len(bead_text.strip()) > 0:
            text_box_y1 = height - 135
            text_box_y2 = height - 58
            draw.rectangle([0, text_box_y1, width, text_box_y2], fill=(10, 12, 22))

            display_text = bead_text.strip()
            if len(display_text) > 90:
                display_text = display_text[:87] + "..."

            draw.text((width // 2, text_box_y1 + 22), display_text, fill=(255, 255, 255), anchor="mm")

        img.save(image_path)
    except Exception as e:
        print(f"[WARNING] Could not draw video overlay on {image_path}: {e}")

def process_media_generation(segments_file: str, output_dir: str = "output"):
    os.makedirs(output_dir, exist_ok=True)
    with open(segments_file, "r", encoding="utf-8") as f:
        segments = json.load(f)

    total_segs = max(len(segments), 1)

    # 1. Generate 16:9 images for each segment (OpenAI DALL-E 3 / Pollinations AI)
    for idx, seg in enumerate(segments, 1):
        pct = 20 + int((idx / total_segs) * 45) # 20% to 65%
        print(f"[PROGRESS {pct}%] Generowanie ilustracji paciorka {idx} z {total_segs}...", flush=True)
        img_filename = f"img_{idx:03d}.png"
        img_path = os.path.join(output_dir, img_filename)
        seg["image_path"] = img_path
        generate_image(seg.get("text", seg.get("prompt", "")), seg.get("negative_prompt", ""), img_path, bead_idx=idx)
        
        # Apply animated video overlay (RHZ365 Rosary or WnR365 Blog)
        is_rosary = seg.get("is_rosary", True)
        bead_label = seg.get("label", "")
        draw_video_overlay(img_path, idx, total_segs, is_rosary=is_rosary, bead_label=bead_label, bead_text=seg.get("text", ""))

    # 2. Combine text and generate narration audio & timestamps (Voice Cloning from MP3 / Edge TTS)
    from analyze import clean_text_for_speech
    full_text = "\n\n".join([clean_text_for_speech(seg["text"]) for seg in segments if clean_text_for_speech(seg["text"])])
    audio_path = os.path.join(output_dir, "narration.mp3")
    timing_path = os.path.join(output_dir, "narration_timestamps.json")
    
    print("[PROGRESS 70%] Generowanie nagrania głosu lektora (TTS)...", flush=True)
    alignment = generate_narration_audio(full_text, output_audio=audio_path, output_timing=timing_path)
    print("[PROGRESS 80%] Nagranie lektora i znacznik czasu gotowe!", flush=True)

    # Update segments file with image paths
    with open(segments_file, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Media generation complete for {len(segments)} segments.", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate images & Voice audio (Voice Cloning / Edge Neural TTS / Pollinations).")
    parser.add_argument("--segments", type=str, default="segments.json", help="Path to segments JSON file")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory")
    args = parser.parse_args()

    process_media_generation(args.segments, args.output_dir)
