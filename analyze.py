import os
import sys
import json
import argparse
from dotenv import load_dotenv

load_dotenv()

import re

PROMPT_PREFIX = "Minimalist art style, clean composition, tranquil background, high quality, soft pastel lighting"
DEFAULT_NEGATIVE_PROMPT = "ugly, overcrowded, blurry, text, watermark, complex details, saturated colors"

def clean_text_for_speech(text: str) -> str:
    """
    Cleans prayer and blog text for TTS narration by removing:
    - Bible citations (e.g. Mt 5, 1-12, Łk 1, 26-38, Ps 23)
    - Bracketed text [..], {..}, (...) containing citations/headers/decorations
    - Emojis, icons (🌹, 📿, ✨, ✦, ---)
    - Header labels (e.g. Cykl II, Dzień 58 z 175, Różaniec Tradycyjny)
    - Common Polish abbreviations expanded for speech (św. -> Święty, ks. -> Ksiądz)
    """
    if not text:
        return ""

    cleaned = text

    # 1. Remove bracketed contents [..] or {..}
    cleaned = re.sub(r'\[.*?\]', '', cleaned)
    cleaned = re.sub(r'\{.*?\}', '', cleaned)

    # 2. Remove Bible citations inside parentheses e.g. (Łk 1, 26-38), (por. Mt 1, 18-24), (2 J 1, 3)
    cleaned = re.sub(r'\([^\)]*(?:Mt|Marek|Łk|Łukasz|J|Jan|Dz|Rz|1\s*Kor|2\s*Kor|Ga|Ef|Flp|Kol|1\s*Tes|2\s*Tes|1\s*Tm|2\s*Tm|Tt|Flm|Hbr|Jk|1\s*P|2\s*P|1\s*J|2\s*J|3\s*J|Jd|Ap|Rdz|Wyj|Kpł|Licz|Pwt|Joz|Sdz|Rut|1\s*Sam|2\s*Sam|1\s*Krl|2\s*Krl|1\s*Krn|2\s*Krn|Ezd|Ne|Tb|Jdt|Est|1\s*Mch|2\s*Mch|Hi|Ps|Prz|Koh|Pieśń|Mąd|Syr|Iz|Jer|Lm|Bar|Ez|Dn|Oz|Joel|Am|Ob|Jon|Mik|Nah|Hab|Sof|Ag|Zach|Mal|por\.|zob\.|cyt\.)[^\)]*\)', '', cleaned, flags=re.IGNORECASE)

    # 3. Remove header tags in parentheses e.g. (Różaniec Tradycyjny), (Cykl I), (Cykl II)
    cleaned = re.sub(r'\([^\)]*(?:Różaniec|Cykl|Dzień|Tajemnica)[^\)]*\)', '', cleaned, flags=re.IGNORECASE)

    # 4. Remove standalone Bible citations e.g. "Mt 5, 1-12", "Łk 1, 26"
    cleaned = re.sub(r'\b(?:Mt|Łk|Dz|Rz|1\s*Kor|2\s*Kor|Ga|Ef|Flp|Kol|1\s*J|2\s*J|Ap|Ps)\.?\s*\d+[\,\:\d\s\-\–]*\b', '', cleaned, flags=re.IGNORECASE)

    # 5. Remove header labels e.g. "Cykl II", "Dzień 58 z 175"
    cleaned = re.sub(r'\b(?:Cykl\s+[I|V|X\d]+|Dzień\s+\d+\s+z\s+\d+)\b', '', cleaned, flags=re.IGNORECASE)

    # 6. Remove emojis and decorative symbols
    cleaned = re.sub(r'[\U00010000-\U0010FFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u200D\uFE0F]', '', cleaned)
    cleaned = re.sub(r'[\✦\★\☆\•\▪\■\□\▲\▼\◆\◇\–\—\=\-\*]{2,}', ' ', cleaned)

    # 7. Expand common Polish abbreviations for smooth natural speech
    abbrevs = [
        (r'\bśw\.\b', 'święty'),
        (r'\bŚw\.\b', 'Święty'),
        (r'\bks\.\b', 'ksiądz'),
        (r'\bKs\.\b', 'Ksiądz'),
        (r'\bbł\.\b', 'błogosławiony'),
        (r'\bBł\.\b', 'Błogosławiony'),
        (r'\bbp\.\b', 'biskup'),
        (r'\bBp\.\b', 'Biskup'),
        (r'\bitd\.\b', 'i tak dalej'),
        (r'\bitp\.\b', 'i tym podobne'),
        (r'\bnp\.\b', 'na przykład'),
        (r'\bok\.\b', 'około'),
        (r'\bo\.\b', 'ojciec'),
        (r'\bO\.\b', 'Ojciec'),
    ]
    for pat, repl in abbrevs:
        cleaned = re.sub(pat, repl, cleaned)

    # 8. Cleanup leftover empty parentheses (), trailing punctuation, and whitespace
    cleaned = re.sub(r'\(\s*\)', '', cleaned)
    cleaned = re.sub(r'\[\s*\]', '', cleaned)
    cleaned = re.sub(r'^\s*[\-\–\—\:\.]+\s*', '', cleaned)
    cleaned = re.sub(r'\s*\.\s*\.', '.', cleaned)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    return cleaned.strip()

def analyze_text(text_input: str, input_type: str = "blog", api_key: str = None) -> list:
    """
    Parses text_input based on input_type ('blog' or 'prayer') using OpenAI GPT-4o.
    Returns a list of segment dictionaries with text, prompt, and negative_prompt.
    """
    text_input = clean_text_for_speech(text_input)
    key = api_key or os.getenv("OPENAI_API_KEY")
    
    if not key or key == "your_openai_api_key_here":
        print("[WARNING] OPENAI_API_KEY not found or default. Using fallback text chunker.")
        return _fallback_chunking(text_input, input_type)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)

        system_instruction = (
            f"You are a video content visual designer. Split the given input text into logical visual segments.\n"
            f"Input Type: {input_type.upper()}.\n"
            f"For 'blog': split by distinct thematic paragraphs or major ideas.\n"
            f"For 'prayer': split by prayer sequence or beads/stanzas.\n\n"
            f"For EACH segment, produce:\n"
            f"1. 'text': The exact segment text narration.\n"
            f"2. 'prompt': Must strictly follow the template: '{PROMPT_PREFIX}, [specific visual description for this segment]'\n"
            f"3. 'negative_prompt': Must strictly be: '{DEFAULT_NEGATIVE_PROMPT}'\n\n"
            f"Return a valid JSON object with key 'segments', containing an array of segment objects: [{{\"id\": 1, \"text\": \"...\", \"prompt\": \"...\", \"negative_prompt\": \"...\"}}]."
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": text_input}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )

        res_content = response.choices[0].message.content
        data = json.loads(res_content)
        segments = data.get("segments", [])
        
        # Ensure formatting rules
        for idx, seg in enumerate(segments, 1):
            seg["id"] = idx
            if not seg.get("negative_prompt"):
                seg["negative_prompt"] = DEFAULT_NEGATIVE_PROMPT
            if not seg.get("prompt", "").startswith("Minimalist art style"):
                seg["prompt"] = f"{PROMPT_PREFIX}, {seg.get('prompt', '')}"

        return segments

    except Exception as e:
        print(f"[ERROR] GPT-4o Analysis failed: {e}. Falling back to rule-based chunker.")
        return _fallback_chunking(text_input, input_type)

def _fallback_chunking(text_input: str, input_type: str) -> list:
    """Rule-based text chunker fallback that splits text into distinct sentence/bead segments."""
    import re
    
    # Clean up text and split by newlines, periods, exclamation, question marks, or semicolons
    cleaned_text = text_input.strip()
    
    # Split by explicit prayer markers or punctuation
    raw_lines = re.split(r'(\n+|\. |\! |\? |\; )', cleaned_text)
    
    chunks = []
    current_chunk = ""
    
    for item in raw_lines:
        item_str = item.strip()
        if not item_str:
            continue
        current_chunk += (" " + item_str if current_chunk else item_str)
        # Create a new segment if current_chunk is at least 35 characters or ends with sentence punctuation
        if len(current_chunk) >= 35 or item_str in [".", "!", "?", ";"]:
            chunks.append(current_chunk.strip())
            current_chunk = ""
            
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    if not chunks:
        chunks = [cleaned_text]
    
    segments = []
    for idx, chunk in enumerate(chunks, 1):
        # Generate specific prompt variations for each segment/bead
        visual_desc = (
            f"peaceful sacred christian art, spiritual reflection, serene soft lighting, "
            f"scene depicting: {chunk[:60]}"
        )
        segments.append({
            "id": idx,
            "text": chunk,
            "prompt": f"{PROMPT_PREFIX}, {visual_desc}",
            "negative_prompt": DEFAULT_NEGATIVE_PROMPT
        })
        
    print(f"[ANALYZE] Created {len(segments)} distinct prayer/bead segments.")
    return segments

def main():
    parser = argparse.ArgumentParser(description="Analyze text & generate SD prompts using GPT-4o.")
    parser.add_argument("--text", type=str, required=True, help="Input text or file path")
    parser.add_argument("--type", type=str, default="blog", choices=["blog", "prayer"], help="Input type")
    parser.add_argument("--output", type=str, default="segments.json", help="Output JSON file path")
    args = parser.parse_args()

    text_content = args.text
    if os.path.exists(args.text):
        with open(args.text, "r", encoding="utf-8") as f:
            text_content = f.read()

    segments = analyze_text(text_content, input_type=args.type)
    
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Analyzed {len(segments)} segments. Saved to {args.output}")

if __name__ == "__main__":
    main()
