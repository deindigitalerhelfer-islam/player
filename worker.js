// IPTV Stream Proxy Worker — Cloudflare Workers
// Tüm HTTP stream'lerini HTTPS sayfasından erişilebilir kılar
// HLS manifest + segment + Stalker Portal isteklerini proxy'ler

export default {
  async fetch(request) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);

    // Hedef URL: ?url=http://... veya /http://...
    let target = url.searchParams.get('url');
    if (!target) {
      target = decodeURIComponent(url.pathname.slice(1));
    }

    // Query string varsa ekle
    if (!target && url.search) {
      target = url.search.slice(1);
    }

    if (!target || (!target.startsWith('http://') && !target.startsWith('https://'))) {
      return new Response(
        JSON.stringify({ error: 'URL eksik veya geçersiz', received: target }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Stalker portal için query string'i koru
    const targetUrl = new URL(target);
    const extraParams = url.searchParams;
    for (const [k, v] of extraParams.entries()) {
      if (k !== 'url') targetUrl.searchParams.set(k, v);
    }

    try {
      // İstek header'larını aktar (Cookie, Authorization vs.)
      const reqHeaders = {
        'User-Agent': request.headers.get('User-Agent') ||
          'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3',
        'X-User-Agent': 'Model: MAG250; Link: WiFi',
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': 'tr,de;q=0.9,en;q=0.8',
      };

      // Stalker portal için kritik headerlar
      const cookie = request.headers.get('Cookie');
      if (cookie) reqHeaders['Cookie'] = cookie;

      const auth = request.headers.get('Authorization');
      if (auth) reqHeaders['Authorization'] = auth;

      const referer = request.headers.get('Referer');
      if (referer) reqHeaders['Referer'] = referer;

      const resp = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: reqHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        // Stream için redirect takip et
        redirect: 'follow',
      });

      // Response header'larını kopyala + CORS ekle
      const newHeaders = new Headers();

      // Önemli header'ları aktar
      const passHeaders = [
        'content-type', 'content-length', 'content-range',
        'accept-ranges', 'cache-control', 'expires',
        'last-modified', 'etag', 'transfer-encoding',
      ];
      for (const h of passHeaders) {
        const v = resp.headers.get(h);
        if (v) newHeaders.set(h, v);
      }

      // CORS
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');
      newHeaders.set('Access-Control-Expose-Headers', '*');

      // HLS manifest içindeki relative URL'leri düzelt
      const contentType = resp.headers.get('content-type') || '';
      const isM3u8 = contentType.includes('mpegurl') ||
                     contentType.includes('m3u') ||
                     targetUrl.pathname.endsWith('.m3u8') ||
                     targetUrl.pathname.endsWith('.m3u');

      if (isM3u8) {
        // Manifest'i oku ve segment URL'lerini mutlak yap
        const text = await resp.text();
        const baseUrl = targetUrl.href.substring(0, targetUrl.href.lastIndexOf('/') + 1);
        const workerBase = url.origin + '/';

        const fixed = text.split('\n').map(line => {
          const trimmed = line.trim();
          // Boş satır veya yorum (EXT tag değil) → olduğu gibi bırak
          if (!trimmed || trimmed.startsWith('#EXT')) return line;
          if (trimmed.startsWith('#')) return line;

          // Segment veya alt-playlist URL'i
          let segUrl = trimmed;
          if (!segUrl.startsWith('http')) {
            // Relative → absolute
            segUrl = segUrl.startsWith('/')
              ? new URL(segUrl, targetUrl.origin).href
              : baseUrl + segUrl;
          }

          // http:// segment'leri worker üzerinden proxy'le
          if (segUrl.startsWith('http://')) {
            return workerBase + encodeURIComponent(segUrl);
          }
          return segUrl;
        }).join('\n');

        newHeaders.set('content-type', 'application/vnd.apple.mpegurl');
        newHeaders.delete('content-length'); // değişti

        return new Response(fixed, {
          status: resp.status,
          headers: newHeaders,
        });
      }

      // Binary stream (TS segments, FLV, vs.) → doğrudan aktar
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: newHeaders,
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message, target: targetUrl.toString() }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  }
};
