export interface RenderProgress {
  progress: number;
  message: string;
}

export const generateVideoClientSide = async (
  text: string,
  fishApiKey: string,
  voiceSampleUrlOrPath: string,
  onProgress: (state: RenderProgress) => void
): Promise<string> => {
  try {
    // 1. Podział tekstu na sceny
    onProgress({ progress: 10, message: "Dzielenie tekstu modlitwy na sceny..." });
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 3);
    if (sentences.length === 0) sentences.push(text);

    // 2. Generowanie obrazów w tle (Pollinations.ai)
    onProgress({ progress: 20, message: "Generowanie obrazów 16:9 z Pollinations.ai..." });
    const imageUrls = sentences.map((sentence, idx) => {
      const cleanPrompt = encodeURIComponent(`holy sacred christian painting, minimalist style, ${sentence.slice(0, 100)}`);
      const seed = Math.floor(Math.random() * 1000000);
      return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;
    });

    // Wstępne ładowanie obrazków do pamięci cache przeglądarki
    const images: HTMLImageElement[] = await Promise.all(
      imageUrls.map((url, i) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => {
            // Fallback na kolorowe tło w razie błędu sieciowego
            const canvas = document.createElement("canvas");
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = "#fbbf24";
            ctx.font = "bold 40px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Modlitwa Różańcowa", 640, 360);
            const fallbackImg = new Image();
            fallbackImg.src = canvas.toDataURL();
            fallbackImg.onload = () => resolve(fallbackImg);
          };
          img.src = url;
        });
      })
    );

    // 3. Synteza mowy lektora (Fish.audio z darmowym fallbackiem Google TTS)
    onProgress({ progress: 40, message: "Synteza głosu lektora..." });
    let audioBuffer: AudioBuffer | null = null;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    interface SceneTiming {
      start: number;
      end: number;
      duration: number;
    }
    const sceneTimings: SceneTiming[] = [];

    // Najpierw próbujemy Fish.audio (jeśli podano klucz)
    if (fishApiKey && fishApiKey !== "your_fish_audio_api_key_here") {
      try {
        onProgress({ progress: 42, message: "Klonowanie głosu w Fish.audio API..." });
        const refRes = await fetch(voiceSampleUrlOrPath);
        const refBlob = await refRes.blob();

        const formData = new FormData();
        formData.append("reference_audio", refBlob, "voice_sample.mp3");
        formData.append("text", text);
        formData.append("format", "mp3");
        formData.append("normalize", "true");
        formData.append("latency", "normal");

        const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${fishApiKey}`
          },
          body: formData
        });

        if (ttsRes.ok) {
          const audioData = await ttsRes.arrayBuffer();
          audioBuffer = await audioContext.decodeAudioData(audioData);
          console.log("Pomyślnie sklonowano głos za pomocą Fish.audio.");
        }
      } catch (e: any) {
        console.warn("Błąd Fish.audio, przechodzenie do darmowego syntezatora:", e);
      }
    }

    // Darmowy fallback - pobieramy i łączymy pliki audio z naszego proxy Cloudflare Pages (/api/tts)
    if (!audioBuffer) {
      try {
        onProgress({ progress: 45, message: "Generowanie darmowego lektora pl-PL..." });
        const sentenceBuffers: AudioBuffer[] = [];

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i].trim();
          onProgress({ 
            progress: 45 + Math.floor((i / sentences.length) * 12), 
            message: `Generowanie audio dla sceny ${i + 1}/${sentences.length}...` 
          });

          const ttsUrl = `/api/tts?lang=pl&text=${encodeURIComponent(sentence)}`;
          const ttsRes = await fetch(ttsUrl);
          if (!ttsRes.ok) {
            throw new Error(`Błąd syntezy API: ${ttsRes.statusText}`);
          }

          const audioData = await ttsRes.arrayBuffer();
          const decoded = await audioContext.decodeAudioData(audioData);
          sentenceBuffers.push(decoded);
        }

        if (sentenceBuffers.length > 0) {
          const totalLength = sentenceBuffers.reduce((acc, val) => acc + val.length, 0);
          const numberOfChannels = sentenceBuffers[0].numberOfChannels;
          const sampleRate = sentenceBuffers[0].sampleRate;

          audioBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

          let currentOffset = 0;
          for (let i = 0; i < sentenceBuffers.length; i++) {
            const buf = sentenceBuffers[i];
            const startSec = currentOffset / sampleRate;
            const durationSec = buf.duration;
            const endSec = startSec + durationSec;

            sceneTimings.push({
              start: startSec,
              end: endSec,
              duration: durationSec
            });

            for (let channel = 0; channel < numberOfChannels; channel++) {
              audioBuffer.getChannelData(channel).set(buf.getChannelData(channel), currentOffset);
            }
            currentOffset += buf.length;
          }
          console.log(`Zmontowano lektora: ${audioBuffer.duration.toFixed(2)}s`);
        }
      } catch (err: any) {
        console.error("Błąd generowania darmowego TTS:", err);
        audioBuffer = null;
      }
    }

    // Uzupełnienie czasów scen, jeśli używamy Fish.audio lub wideo jest nieme
    if (sceneTimings.length === 0) {
      const dur = audioBuffer ? audioBuffer.duration : sentences.length * 5.0;
      const avgDuration = dur / sentences.length;
      for (let i = 0; i < sentences.length; i++) {
        sceneTimings.push({
          start: i * avgDuration,
          end: (i + 1) * avgDuration,
          duration: avgDuration
        });
      }
    }

    // 4. Montaż wideo za pomocą HTML Canvas i MediaRecorder
    onProgress({ progress: 60, message: "Renderowanie klatek wideo i nagrywanie..." });

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;

    const stream = canvas.captureStream(25); // 25 FPS
    
    let mediaRecorder: MediaRecorder;
    const audioTracks: MediaStreamTrack[] = [];
    
    if (audioBuffer) {
      const dest = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(dest);
      dest.stream.getAudioTracks().forEach(track => audioTracks.push(track));
      
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioTracks
      ]);
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm;codecs=vp9,opus" });
      bufferSource.start(0);
    } else {
      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const duration = audioBuffer ? audioBuffer.duration : sentences.length * 5.0;
    const totalFrames = Math.ceil(duration * 25);
    let currentFrame = 0;

    return new Promise<string>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(finalBlob);
        resolve(videoUrl);
      };

      mediaRecorder.start();

      const renderLoop = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const currentTimeSec = currentFrame / 25;
        const progressPct = 60 + Math.floor((currentFrame / totalFrames) * 38);
        onProgress({ progress: progressPct, message: `Nagrywanie klatek wideo (${currentFrame}/${totalFrames})...` });

        // Określamy, który obrazek narysować
        let sceneIndex = 0;
        for (let i = 0; i < sceneTimings.length; i++) {
          if (currentTimeSec >= sceneTimings[i].start && currentTimeSec <= sceneTimings[i].end) {
            sceneIndex = i;
            break;
          }
        }
        if (currentTimeSec > sceneTimings[sceneTimings.length - 1].end) {
          sceneIndex = sceneTimings.length - 1;
        }

        const activeImg = images[sceneIndex];
        const activeText = sentences[sceneIndex] || "";

        // Rysuj tło z obrazka Pollinations
        ctx.drawImage(activeImg, 0, 0, 1280, 720);

        // Nakładka cieniująca (gradient)
        const gradient = ctx.createLinearGradient(0, 500, 0, 720);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 500, 1280, 220);

        // Rysuj "Paciorek różańca"
        const beadPulse = 15 + Math.sin(currentTimeSec * 5) * 3;
        ctx.beginPath();
        ctx.arc(80, 640, beadPulse, 0, 2 * Math.PI);
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rysuj tekst modlitwy
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        const maxWidth = 1000;
        const words = activeText.split(" ");
        let line = "";
        const lines = [];

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + " ";
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        lines.forEach((lineText, idx) => {
          ctx.fillText(lineText, 130, 620 + (idx * 40) - ((lines.length - 1) * 20));
        });

        currentFrame++;
        requestAnimationFrame(renderLoop);
      };

      renderLoop();
    });
  } catch (error: any) {
    onProgress({ progress: 0, message: `Błąd renderowania: ${error.message}` });
    throw error;
  }
};
