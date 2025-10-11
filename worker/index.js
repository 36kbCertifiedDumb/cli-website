addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const token = formData.get('cf-turnstile-response');
    const pathIdentifier = formData.get('path_identifier'); // Get the path identifier from the form data

    const SECRET_KEY = 'YOUR_TURNSTILE_SECRET_KEY'; // Replace with your Turnstile secret key

    // Define the mapping of path identifiers to actual redirect URLs
    const redirectMap = {
      '/sfwart/': 'https://gallery.yueplush.com/share/aCzBqUgJiEh8rbjCdR8LFsXaiR01gCYI2VkcFhYI6utzqiZfvPuwMFcB0An7-qvlgaw',
      '/suggestiveart/': 'https://gallery.yueplush.com/share/QELUgJIyrmi8V_iuGfmU2_y4sWEHst_62GhPVNGERDheWObyYqvyl34LotmZ-Imgv8Q',
      '/oldart/': 'https://gallery.yueplush.com/share/dsSCzu2fgAVI6xopCxbIWU13dOyjMQdTjZE-yCQcyEZOi0S0w_HhOSiwRXDh0GwqwiI',
      // Add other mappings as needed
    };

    let ip = request.headers.get('CF-Connecting-IP');

    let formDataVerify = new FormData();
    formDataVerify.append('secret', SECRET_KEY);
    formDataVerify.append('response', token);
    formDataVerify.append('remoteip', ip);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
      body: formDataVerify,
      method: 'POST',
    });

    const outcome = await result.json();

    if (outcome.success) {
      console.log('Turnstile verification successful.'); // Log success
      console.log('Received pathIdentifier:', pathIdentifier); // Log received pathIdentifier

      const finalRedirectUrl = redirectMap[pathIdentifier];
      console.log('Determined finalRedirectUrl:', finalRedirectUrl); // Log determined redirect URL

      if (finalRedirectUrl) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': finalRedirectUrl,
          },
        });
      } else {
        console.error('No valid redirect path identifier found in map for:', pathIdentifier); // Log if path not found
        return new Response('CAPTCHA verification successful! No valid redirect path identifier provided.', { status: 200 });
      }
    } else {
      console.error('CAPTCHA verification failed. Error codes:', outcome['error-codes']); // Log error codes
      return new Response('CAPTCHA verification failed. Please try again.', { status: 403 });
    }
  }

  // Handle GET requests or other methods (e.g., serve a simple page or redirect)
  return new Response('This is a Turnstile verification endpoint. Please submit a POST request with a Turnstile token.', { status: 200 });
}