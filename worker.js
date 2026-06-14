export default {
  async fetch(request) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);

    // Hedef URL: ?url=http://... veya /http://...
    let target = url.searchParams.get('url');
    if (!target) {
      // Pathname'den al: /http://portal.example.com/...
      target = decodeURIComponent(url.pathname.slice(1));
    }

    if (!target || (!target.startsWith('http://') && !target.startsWith('https://'))) {
      return new Response(
        JSON.stringify({ error: 'Hedef URL eksik veya geçersiz', received: target }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Query string varsa ekle (worker path'ten gelince kaybolabilir)
    if (url.search && !target.includes('?')) {
      target += url.search;
    }

    try {
      const resp = await fetch(target, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3',
          'X-User-Agent': 'Model: MAG250; Link: WiFi',
          'Accept': '*/*',
          'Cookie': request.headers.get('Cookie') || '',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      });

      const newHeaders = new Headers(resp.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: newHeaders,
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message, target: target }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  }
};
