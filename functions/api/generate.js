/**
 * functions/api/generate.js
 * Cloudflare Pages Function Handler do integracji z Fliki AI API (16:9 MP4 Video Export).
 * Ścieżka endpointu: /api/generate
 */

// Nagłówki CORS zezwalające na zapytania z dowolnej domeny (w tym localhost i Cloudflare Pages)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
};

/**
 * Obsługa zapytań OPTIONS (CORS preflight)
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Obsługa zapytań POST /api/generate
 */
export async function onRequestPost({ request, env }) {
  try {
    // 1. Odczyt klucza API z otoczenia Cloudflare (env.FLIKI_API_KEY) lub fallback z process.env
    const apiKey = env.FLIKI_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.FLIKI_API_KEY : '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Brak aktywnego klucza FLIKI_API_KEY w zmiennych środowiskowych Cloudflare Pages.',
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Pobranie i walidacja danych z ciała zapytania (JSON body)
    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Nieprawidłowy ładunek JSON w ciele zapytania.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, title, voiceId, scenes, pollJobId } = body;

    // A. Jeśli przekazano pollJobId -> wykonaj zapytanie GET o status zadania
    if (pollJobId) {
      const pollRes = await fetch(`https://api.fliki.ai/v1/generate/video/${pollJobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => '');
        return new Response(
          JSON.stringify({ success: false, error: `Błąd pollingu Fliki API (${pollRes.status}): ${errText}` }),
          { status: pollRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      const pollData = await pollRes.json();
      return new Response(
        JSON.stringify({
          success: true,
          status: pollData.status || (pollData.downloadUrl ? 'completed' : 'processing'),
          progress: pollData.progress || 50,
          downloadUrl: pollData.downloadUrl || pollData.url || null,
          data: pollData,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // B. Utworzenie nowego zadania generowania wideo we Fliki AI
    const formattedScenes = Array.isArray(scenes) && scenes.length > 0
      ? scenes.map((s) => ({
          text: (s.text || '').replace(/[\r\n]+/g, ' ').trim(),
          mediaQuery: (s.mediaQuery || s.imagePrompt || '').trim(),
          notes: s.notes || undefined,
        }))
      : [
          {
            text: (prompt || 'Zdrowaś Maryjo, łaski pełna...').replace(/[\r\n]+/g, ' ').trim(),
            mediaQuery: 'Blessed Virgin Mary Catholic sacred art classical painting',
          },
        ];

    const flikiPayload = {
      title: title || 'RHZ365 — Wersja Minimalistyczna 16:9',
      aspectRatio: '16:9',
      scenes: formattedScenes,
    };

    if (voiceId && typeof voiceId === 'string' && voiceId.trim()) {
      flikiPayload.voiceId = voiceId.trim();
    }

    const flikiRes = await fetch('https://api.fliki.ai/v1/generate/video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flikiPayload),
    });

    if (!flikiRes.ok) {
      const errText = await flikiRes.text().catch(() => '');
      return new Response(
        JSON.stringify({
          success: false,
          error: `Błąd Fliki API (${flikiRes.status}): ${errText || flikiRes.statusText}`,
        }),
        { status: flikiRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const flikiData = await flikiRes.json();
    const jobId = flikiData.id || flikiData.videoId || flikiData.jobId;
    const downloadUrl = flikiData.downloadUrl || flikiData.url || null;

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        downloadUrl,
        status: downloadUrl ? 'completed' : 'processing',
        message: downloadUrl ? 'Plik MP4 został wygenerowany!' : 'Utworzono zadanie generowania wideo.',
        data: flikiData,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Wewnętrzny wyjątek serwera Cloudflare Pages: ${err.message || err}`,
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
