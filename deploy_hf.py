import os
import sys
import subprocess

def main():
    print("=== Automatyczny Wdrożyciel Hugging Face Spaces (WnR365 / RHZ365) ===")
    
    try:
        from huggingface_hub import HfApi, create_repo
    except ImportError:
        print("Instalowanie biblioteki huggingface_hub...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
        from huggingface_hub import HfApi, create_repo

    token = os.environ.get("HF_TOKEN")
    if not token:
        if len(sys.argv) > 1:
            token = sys.argv[1]
        else:
            token = input("\nWklej swój Hugging Face User Access Token (z https://huggingface.co/settings/tokens): ").strip()

    if not token:
        print("❌ Błąd: Brak tokena. Aby wdrożyć serwer w chmurze za darmo, potrzebujesz tokena z Hugging Face.")
        return

    space_name = input("Podaj nazwę dla serwera w chmurze [domyślnie: wnr-mp4-backend]: ").strip() or "wnr-mp4-backend"

    try:
        api = HfApi(token=token)
        user_info = api.whoami()
        username = user_info['name']
    except Exception as e:
        print(f"❌ Błąd autoryzacji tokena Hugging Face: {e}")
        return

    repo_id = f"{username}/{space_name}"
    print(f"\n[1/3] Tworzenie kontenera Docker na Hugging Face Spaces: {repo_id}...")

    try:
        create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="docker",
            private=False,
            token=token,
            exist_ok=True
        )
    except Exception as e:
        print(f"   Uwaga: {e}")

    print("\n[2/3] Wgrywanie plików serwera Python + FFmpeg do chmury...")
    files_to_upload = [
        "Dockerfile",
        "requirements.txt",
        "server.py",
        "pipeline.py",
        "generate_media.py",
        "assemble_video.py"
    ]

    for f in files_to_upload:
        if os.path.exists(f):
            print(f"  -> Wgrywanie: {f}")
            api.upload_file(
                path_or_fileobj=f,
                path_in_repo=f,
                repo_id=repo_id,
                repo_type="space"
            )

    space_url = f"https://{username}-{space_name.replace('_', '-')}.hf.space"
    print("\n" + "="*60)
    print("✅ SUKCES! Serwer został automatycznie skonfigurowany i wdrożony!")
    print(f"🔗 Twój darmowy adres serwera w chmurze: {space_url}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
