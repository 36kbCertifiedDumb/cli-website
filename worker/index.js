addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    if (request.method !== 'POST') {
      return new Response('This endpoint expects POST with Turnstile token.', { status: 200 });
    }

    // parse form body
    const formData = await request.formData();
    const token = formData.get('cf-turnstile-response');
    const pathIdentifierRaw = formData.get('path_identifier') || '';

    if (!token) {
      console.error('No Turnstile token in request.');
      return new Response('Missing Turnstile token.', { status: 400 });
    }

    // SECRET should be configured as a worker secret binding named TURNSTILE_SECRET
    const SECRET_KEY = TURNSTILE_SECRET;
    if (!SECRET_KEY) {
      console.error('TURNSTILE_SECRET is not configured in worker bindings.');
      return new Response('Server configuration error.', { status: 500 });
    }

    // normalize incoming path identifier: trim, lowercase, strip leading/trailing slashes
    const raw = pathIdentifierRaw.toString();
    const key = raw.trim().toLowerCase().replace(/^\/|\/$/g, ''); // e.g. "/sfwart/" -> "sfwart"
    console.log('Received path_identifier raw:', raw, 'normalized:', key);

    // canonical redirect map (canonical keys)
    const redirectMap = {
      'sfwart': 'https://gallery.yueplush.com/share/aCzBqUgJiEh8rbjCdR8LFsXaiR01gCYI2VkcFhYI6utzqiZfvPuwMFcB0An7-qvlgaw',
      'suggestive': 'https://gallery.yueplush.com/share/QELUgJIyrmi8V_iuGfmU2_y4sWEHst_62GhPVNGERDheWObyYqvyl34LotmZ-Imgv8Q',
      'oldart': 'https://gallery.yueplush.com/share/dsSCzu2fgAVI6xopCxbIWU13dOyjMQdTjZE-yCQcyEZOi0S0w_HhOSiwRXDh0GwqwiI',
    };

    // alias map to absorb common typos / alternative names
    const aliasMap = {
      'suggesitve': 'suggestive',
      'suggesitveart': 'suggestive',
      'suggestiveart': 'suggestive',
      'sfw': 'sfwart',
      'sfw-art': 'sfwart',
    };

    // determine final redirect URL
    let finalRedirectUrl = redirectMap[key];
    if (!finalRedirectUrl && aliasMap[key]) {
      const canonical = aliasMap[key];
      finalRedirectUrl = redirectMap[canonical];
      console.log('Used alias mapping:', key, '->', canonical);
    }

    // verify with Cloudflare Turnstile - use URLSearchParams (x-www-form-urlencoded)
    const verifyBody = new URLSearchParams();
    verifyBody.append('secret', SECRET_KEY);
    verifyBody.append('response', token);

    // optional: attach remoteip if available
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
    if (ip) verifyBody.append('remoteip', ip);

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyBody,
    });

    if (!verifyRes.ok) {
      console.error('Turnstile siteverify fetch failed:', verifyRes.status, verifyRes.statusText);
      return new Response('Verification service error.', { status: 502 });
    }

    const outcome = await verifyRes.json();
    console.log('Turnstile outcome:', JSON.stringify(outcome));

    if (!outcome.success) {
      console.error('Turnstile verification failed. error-codes:', outcome['error-codes']);
      return new Response('CAPTCHA verification failed. Please try again.', { status: 403 });
    }

    // optional hostname check (uncomment if you want to enforce)
    if (outcome.hostname && outcome.hostname !== 'www.yueplush.com') {
      console.warn('Token hostname mismatch:', outcome.hostname);
      // you may choose to reject here if strict
    }

    if (!finalRedirectUrl) {
      console.error('Unknown pathIdentifier after normalization:', key);
      // helpful JSON for debugging (remove or simplify in production)
      const payload = {
        ok: false,
        message: 'Verification succeeded but unknown target.',
        received: key,
        valid_keys: Object.keys(redirectMap),
      };
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // detect whether client expects JSON (AJAX/fetch) and respond accordingly
    const accept = (request.headers.get('accept') || '').toLowerCase();
    const isAjax = request.headers.get('x-requested-with') === 'XMLHttpRequest' || accept.includes('application/json');

    if (isAjax) {
      // return JSON with redirect URL so client-side JS can navigate
      return new Response(JSON.stringify({ ok: true, redirect: finalRedirectUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // native form submit: redirect with 302 so browser navigates
      return Response.redirect(finalRedirectUrl, 302);
    }
  } catch (err) {
    console.error('Worker error:', err);
    return new Response('Server error', { status: 500 });
  }
}
