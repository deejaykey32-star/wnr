/**
 * local-test.js
 * Skrypt testowy Node.js (v18+) do generowania wideo w Fliki AI API (16:9) z mechanizmem pollingu.
 * Uruchamianie: node local-test.js "Twój opcjonalny prompt lub rozważanie"
 */

import dotenv from 'dotenv';
dotenv.config();

const FLIKI_API_KEY = process.env.FLIKI_API_KEY;

if (!FLIKI_API_KEY) {
  console.error('❌ BŁĄD: Brak klucza FLIKI_API_KEY. Ustaw go w pliku .env lub jako zmienną środowiskową.');
  process.exit(1);
}

/**
 * Funkcja asynchroniczna tworząca zadanie generowania wideo we Fliki AI
 */
async function createFlikiVideoJob(promptText, apiKey) {
  console.log('🚀 Zlecanie wygenerowania wideo w Fliki AI...');
  
  const payload = {
    title: 'RHZ365 — Wersja Minimalistyczna 16:9 (Test)',
    aspectRatio: '16:9',
    scenes: [
      {
        text: promptText || 'Zdrowaś Maryjo, łaski pełna, Pan z Tobą, błogosławionaś Ty między niewiastami...',
        mediaQuery: 'Blessed Virgin Mary Catholic sacred art classical painting'
      }
    ]
  };

  const res = await fetch('https://api.fliki.ai/v1/generate/video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Błąd HTTP ${res.status} z Fliki API: ${errText || res.statusText}`);
  }

  const data = await res.json();
  console.log('✅ Zadanie generowania zostało utworzone w Fliki AI!');
  console.log(`🆔 ID zadania: ${data.id || data.videoId || data.jobId}`);
  return data;
}

/**
 * Funkcja pollingu sprawdzająca status generowania wideo do skutku
 */
async function pollFlikiVideoStatus(jobId, apiKey, intervalMs = 5000, maxAttempts = 60) {
  console.log(`⏳ Rozpoczęcie sprawdzania statusu (polling co ${intervalMs / 1000}s)...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api.fliki.ai/v1/generate/video/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.warn(`⚠️ Próba ${attempt}/${maxAttempts}: Problem z pobraniem statusu HTTP ${res.status}`);
    } else {
      const data = await res.json();
      const status = data.status || (data.downloadUrl ? 'completed' : 'processing');
      const progress = data.progress || (status === 'completed' ? 100 : Math.min(attempt * 5, 95));

      console.log(`📊 Próba ${attempt}/${maxAttempts} [Status: ${status}, Postęp: ${progress}%]`);

      if (status === 'completed' || data.downloadUrl || data.url) {
        const downloadUrl = data.downloadUrl || data.url;
        console.log('\n🎉 =================================================== 🎉');
        console.log('✅ WIDEO ZOSTASY WYGENEROWANE POMYŚLNIE!');
        console.log(`📥 Link do pobrania pliku MP4 (YouTube 16:9):\n${downloadUrl}`);
        console.log('🎉 =================================================== 🎉\n');
        return downloadUrl;
      }

      if (status === 'failed') {
        throw new Error(`Generowanie wideo we Fliki nie powiodło się: ${data.message || 'Nieznany błąd'}`);
      }
    }

    // Odczekaj intervalMs przed kolejną próbą
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('⏱️ Przekroczono limit czasu oczekiwania (timeout) na wygenerowanie wideo.');
}

// Główna funkcja uruchomieniowa
(async () => {
  try {
    const customPrompt = process.argv[2];
    const jobData = await createFlikiVideoJob(customPrompt, FLIKI_API_KEY);
    const jobId = jobData.id || jobData.videoId || jobData.jobId;

    if (jobData.downloadUrl || jobData.url) {
      console.log(`✅ Gotowy plik MP4: ${jobData.downloadUrl || jobData.url}`);
    } else if (jobId) {
      await pollFlikiVideoStatus(jobId, FLIKI_API_KEY);
    } else {
      console.log('ℹ️ Otrzymano odpowiedź z Fliki API:', jobData);
    }
  } catch (err) {
    console.error('\n❌ BŁĄD PODCZAS GENEROWANIA WIDEO:', err.message || err);
    process.exit(1);
  }
})();
