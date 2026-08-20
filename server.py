import os
import sys
import json
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

PORT = 3333
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
OUTPUT_MP4 = os.path.join(OUTPUT_DIR, "final_widokinaraj_169.mp4")
PYTHON_BIN = os.path.join(BASE_DIR, "venv", "Scripts", "python.exe")
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
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/api/generate-mp4":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Niepoprawny format JSON body."}).encode('utf-8'))
                return

            text_to_generate = body.get("text", "")
            if not text_to_generate or len(text_to_generate.strip()) < 5:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Brak tekstu modlitwy (pole 'text' musi mieć min. 5 znaków)."}).encode('utf-8'))
                return

            with job_lock:
                if current_job["status"] == "running":
                    self.send_response(409)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Generowanie wideo już trwa w tle. Poczekaj na ukończenie."}).encode('utf-8'))
                    return

                # Zainicjuj nowe zadanie
                job_id = f"job_{int(threading.Event()._time() * 1000)}"
                current_job["jobId"] = job_id
                current_job["status"] = "running"
                current_job["progress"] = 5
                current_job["message"] = "Rozpoczynanie generowania modlitwy..."
                current_job["output_mp4"] = OUTPUT_MP4

            # Uruchom potok w osobnym wątku leżącym w tle
            threading.Thread(target=run_pipeline_worker, args=(text_to_generate.strip(),), daemon=True).start()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"jobId": job_id, "status": "started"}).encode('utf-8'))
            return
        else:
            self.send_response(404)
            self.end_headers()


def run_pipeline_worker(text: str):
    print(f"[WORKER] Rozpoczęto zadanie generowania w tle.")
    try:
        # Wywołanie pipeline.py
        cmd = [
            PYTHON_BIN,
            PIPELINE_SCRIPT,
            "--text", text,
            "--type", "prayer",
            "--output-dir", OUTPUT_DIR,
            "--output-mp4", OUTPUT_MP4
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='ignore',
            bufsize=1
        )

        for line in process.stdout:
            line_str = line.strip()
            if not line_str:
                continue
            print(f"[PIPELINE-STDOUT] {line_str}")
            
            # Mapowanie faz i logów na progress
            prog = None
            msg = None
            if "PHASE 2" in line_str:
                prog, msg = 15, "Analiza tekstu i planowanie scen modlitewnych..."
            elif "PHASE 3" in line_str:
                prog, msg = 30, "Generowanie grafik (Pollinations) i głosu lektora (Fish.audio)..."
            elif "img_001" in line_str:
                prog, msg = 45, "Generowanie grafiki dla sceny 1..."
            elif "img_002" in line_str:
                prog, msg = 55, "Generowanie grafiki dla sceny 2..."
            elif "img_003" in line_str:
                prog, msg = 65, "Generowanie grafiki dla sceny 3..."
            elif "Voice Cloning" in line_str or "cloned voice saved" in line_str or "narration.mp3" in line_str:
                prog, msg = 75, "Klonowanie głosu lektora za pomocą Fish.audio API..."
            elif "PHASE 4" in line_str:
                prog, msg = 85, "Montowanie wideo MP4 z przewijanym tekstem i lektorem..."
            elif "[SUCCESS]" in line_str:
                prog, msg = 100, "Wideo wygenerowane pomyślnie!"

            if prog is not None or msg is not None:
                with job_lock:
                    if prog is not None:
                        current_job["progress"] = prog
                    if msg is not None:
                        current_job["message"] = msg

        process.wait()
        
        # Weryfikacja wyniku
        if process.returncode == 0 and os.path.exists(OUTPUT_MP4) and os.path.getsize(OUTPUT_MP4) > 1000:
            with job_lock:
                current_job["status"] = "done"
                current_job["progress"] = 100
                current_job["message"] = "Gotowe! Wideo wygenerowane poprawnie."
            print(f"[WORKER] ✅ Sukces. Wyjściowy plik MP4: {OUTPUT_MP4}")
        else:
            with job_lock:
                current_job["status"] = "error"
                current_job["progress"] = 0
                current_job["message"] = f"Błąd w skrypcie montującym. Kod powrotu: {process.returncode}"
            print(f"[WORKER] ❌ Błąd rurociągu (kod: {process.returncode})")

    except Exception as e:
        with job_lock:
            current_job["status"] = "error"
            current_job["progress"] = 0
            current_job["message"] = f"Wyjątek serwera: {str(e)}"
        print(f"[WORKER] ❌ Wyjątek: {e}")

if __name__ == "__main__":
    server = HTTPServer(('localhost', PORT), LocalAPIServer)
    print(f"\n[SERVER] Local API Server (Python) running on http://localhost:{PORT}")
    print(f"   Przycisk 'Generuj MP4' wywola teraz ten proces w tle.")
    print(f"   Wymagany wlaczony serwer do generowania filmow.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nZamykanie serwera.")
        server.server_close()
