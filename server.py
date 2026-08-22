import os
import sys
import json
import time
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Globalny stan zadania generowania wideo
job_lock = threading.Lock()
current_job = {
    "jobId": None,
    "status": "idle", # "idle", "running", "done", "error"
    "progress": 0,
    "message": "",
    "output_mp4": None
}

PORT = int(os.environ.get("PORT", 7860))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
OUTPUT_MP4 = os.path.join(OUTPUT_DIR, "final_widokinaraj_169.mp4")
PYTHON_BIN = sys.executable
PIPELINE_SCRIPT = os.path.join(BASE_DIR, "pipeline.py")

# Upewnij się, że katalog wyjściowy istnieje
os.makedirs(OUTPUT_DIR, exist_ok=True)

class LocalAPIServer(BaseHTTPRequestHandler):
    def end_headers(self):
        # CORS Headers for React Frontend
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "version": "1.0.0-py"}).encode('utf-8'))
            return

        elif parsed_path.path == "/api/youtube/playlists":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            try:
                from youtube_uploader import fetch_user_playlists
                playlists = fetch_user_playlists()
                self.wfile.write(json.dumps({"playlists": playlists}).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"playlists": [], "error": str(e)}).encode('utf-8'))
            return

        elif parsed_path.path == "/api/generate-mp4/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            with job_lock:
                status_payload = {
                    "jobId": current_job["jobId"],
                    "status": current_job["status"],
                    "progress": current_job["progress"],
                    "message": current_job["message"],
                    "youtubeUrl": current_job.get("youtubeUrl"),
                    "downloadReady": current_job["status"] == "done",
                    "downloadUrl": "/api/generate-mp4/download" if current_job["status"] == "done" else None
                }
            self.wfile.write(json.dumps(status_payload).encode('utf-8'))
            return

        elif parsed_path.path == "/api/generate-mp4/download":
            if os.path.exists(OUTPUT_MP4) and os.path.getsize(OUTPUT_MP4) > 1000:
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Disposition", 'attachment; filename="widokinaraj_169.mp4"')
                self.send_header("Content-Length", str(os.path.getsize(OUTPUT_MP4)))
                self.end_headers()
                with open(OUTPUT_MP4, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Plik MP4 nie jest jeszcze gotowy."}).encode('utf-8'))
            return

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        try:
            parsed_path = urlparse(self.path)
            
            if parsed_path.path == "/api/generate-mp4":
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
                try:
                    body = json.loads(post_data.decode('utf-8'))
                except Exception:
                    body = {}

                text_to_generate = body.get("text", "")
                if not text_to_generate or len(text_to_generate.strip()) < 5:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Brak tekstu modlitwy (pole 'text' musi mieć min. 5 znaków)."}).encode('utf-8'))
                    return

                auto_upload_yt = body.get("autoUploadYoutube", False)
                playlist_id = body.get("playlistId", "")
                yt_title = body.get("title", "RHZ365 / WnR365 - Rozważania Modlitewne")
                yt_privacy = body.get("privacy", "public")

                with job_lock:
                    if current_job["status"] == "running":
                        self.send_response(409)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "Generowanie wideo już trwa w tle. Poczekaj na ukończenie."}).encode('utf-8'))
                        return

                    # Zainicjuj nowe zadanie
                    job_id = f"job_{int(time.time() * 1000)}"
                    current_job["jobId"] = job_id
                    current_job["status"] = "running"
                    current_job["progress"] = 5
                    current_job["message"] = "Rozpoczynanie generowania modlitwy..."
                    current_job["output_mp4"] = OUTPUT_MP4
                    current_job["youtubeUrl"] = None

                # Uruchom potok w osobnym wątku w tle
                threading.Thread(
                    target=run_pipeline_worker,
                    args=(text_to_generate.strip(), auto_upload_yt, playlist_id, yt_title, yt_privacy),
                    daemon=True
                ).start()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"jobId": job_id, "status": "started"}).encode('utf-8'))
                return

            elif parsed_path.path == "/api/youtube/upload":
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
                try:
                    body = json.loads(post_data.decode('utf-8'))
                except Exception:
                    body = {}

                playlist_id = body.get("playlistId", "")
                yt_title = body.get("title", "RHZ365 / WnR365 - Film Modlitewny")
                yt_desc = body.get("description", "Oficjalny film modlitewny ze strony widokinaraj.pl")
                yt_privacy = body.get("privacy", "public")

                if not os.path.exists(OUTPUT_MP4):
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Brak wygenerowanego pliku MP4 na serwerze."}).encode('utf-8'))
                    return

                from youtube_uploader import upload_video_to_youtube
                upload_res = upload_video_to_youtube(OUTPUT_MP4, yt_title, yt_desc, playlist_id, yt_privacy)

                self.send_response(200 if upload_res.get("success") else 500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(upload_res).encode('utf-8'))
                return
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as err:
            print(f"[POST-ERROR] {err}")
            try:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))
            except Exception:
                pass


def run_pipeline_worker(text: str, auto_upload_yt: bool = False, playlist_id: str = None, yt_title: str = None, yt_privacy: str = "public"):
    print(f"[WORKER] Rozpoczęto zadanie generowania w tle.")
    try:
        # Wywołanie pipeline.py w trybie bez buforowania (-u)
        cmd = [
            PYTHON_BIN,
            "-u",
            PIPELINE_SCRIPT,
            "--text", text,
            "--type", "prayer",
            "--output-dir", OUTPUT_DIR,
            "--output-mp4", OUTPUT_MP4
        ]
        
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='ignore',
            bufsize=1,
            env=env
        )

        output_lines = []
        for line in process.stdout:
            line_str = line.strip()
            if not line_str:
                continue
            print(f"[PIPELINE-STDOUT] {line_str}", flush=True)
            output_lines.append(line_str)
            
            # Mapowanie faz i logów na progress
            prog = None
            msg = None
            if "PHASE 2" in line_str:
                prog, msg = 15, "Analiza tekstu i planowanie scen modlitewnych..."
            elif "PHASE 3" in line_str:
                prog, msg = 30, "Generowanie grafik (Pollinations) i głosu lektora..."
            elif "img_" in line_str or "Saved 16:9" in line_str or "Pollinations" in line_str:
                prog, msg = 50, "Pobieranie ilustracji 16:9 (Pollinations.ai)..."
            elif "audio" in line_str.lower() or "tts" in line_str.lower() or "narration" in line_str.lower():
                prog, msg = 70, "Generowanie głosu lektora (TTS)..."
            elif "PHASE 4" in line_str or "ffmpeg" in line_str.lower():
                prog, msg = 85, "Montowanie wideo MP4 (FFmpeg)..."
            elif "[SUCCESS]" in line_str:
                prog, msg = 90, "Wideo MP4 wyrenderowane! Przygotowanie publikacji..."

            if prog is not None or msg is not None:
                with job_lock:
                    if prog is not None:
                        current_job["progress"] = prog
                    if msg is not None:
                        current_job["message"] = msg

        process.wait()
        
        # Weryfikacja wyniku
        if process.returncode == 0 and os.path.exists(OUTPUT_MP4) and os.path.getsize(OUTPUT_MP4) > 1000:
            yt_url = None
            if auto_upload_yt or playlist_id:
                with job_lock:
                    current_job["progress"] = 92
                    current_job["message"] = "Przesyłanie filmu na YouTube i dodawanie do playlisty..."
                try:
                    from youtube_uploader import upload_video_to_youtube
                    title = yt_title or "RHZ365 / WnR365 - Rozważania Modlitewne"
                    desc = f"Film modlitewny wygenerowany automatycznie na stronie widokinaraj.pl\n\nTreść:\n{text[:500]}..."
                    res_yt = upload_video_to_youtube(OUTPUT_MP4, title, desc, playlist_id, yt_privacy)
                    if res_yt.get("success"):
                        yt_url = res_yt.get("youtubeUrl")
                        print(f"[WORKER] ✅ Wygenerowano i przesłano na YouTube: {yt_url}")
                except Exception as ex_yt:
                    print(f"[WORKER ERROR] Publikacja YouTube nie powiodła się: {ex_yt}")

            with job_lock:
                current_job["status"] = "done"
                current_job["progress"] = 100
                current_job["youtubeUrl"] = yt_url
                current_job["message"] = "Gotowe! Wideo wygenerowane poprawnie." if not yt_url else f"Gotowe! Opublikowano na YouTube: {yt_url}"
            print(f"[WORKER] ✅ Sukces. Wyjściowy plik MP4: {OUTPUT_MP4}")
        else:
            err_detail = " | ".join(output_lines[-3:]) if output_lines else f"Kod: {process.returncode}"
            with job_lock:
                current_job["status"] = "error"
                current_job["progress"] = 0
                current_job["message"] = f"Błąd montowania: {err_detail}"
            print(f"[WORKER] ❌ Błąd rurociągu (kod: {process.returncode})")

    except Exception as e:
        with job_lock:
            current_job["status"] = "error"
            current_job["progress"] = 0
            current_job["message"] = f"Wyjątek serwera: {str(e)}"
        print(f"[WORKER] ❌ Wyjątek: {e}")

if __name__ == "__main__":
    server = HTTPServer(('0.0.0.0', PORT), LocalAPIServer)
    print(f"\n[SERVER] API Server (Python) running on http://0.0.0.0:{PORT}")
    print(f"   Przycisk 'Generuj MP4' wywola teraz ten proces w tle.")
    print(f"   Wymagany wlaczony serwer do generowania filmow.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nZamykanie serwera.")
        server.server_close()
