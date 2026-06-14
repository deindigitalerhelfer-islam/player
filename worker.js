export default {
  async fetch(request) {
    // OPTIONS (preflight) isteklerini hemen yanıtla
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const url = new URL(request.url);
    const target = decodeURIComponent(url.pathname.slice(1));

    if (!target || !target.startsWith('http')) {
      return new Response("Hedef URL eksik", { status: 400 });
    }

    const resp = await fetch(target, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3',
        'X-User-Agent': 'Model: MAG250; Link: WiFi',
        'Cookie': request.headers.get('Cookie') || '',
        'Authorization': request.headers.get('Authorization') || '',
        'Accept': '*/*',
      },
      body: request.method === 'GET' ? null : request.body,
    });

    const newHeaders = new Headers(resp.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(resp.body, {
      status: resp.status,
      headers: newHeaders,
    });
  }
};
