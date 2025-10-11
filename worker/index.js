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
      // CAPTCHA verification successful
      const finalRedirectUrl = redirectMap[pathIdentifier];
      if (finalRedirectUrl) {
        return Response.redirect(finalRedirectUrl, 302); // Redirect to the mapped URL
      } else {
        return new Response('CAPTCHA verification successful! No valid redirect path identifier provided.', { status: 200 });
      }
    } else {
      // CAPTCHA verification failed
      console.log(outcome['error-codes']);
      return new Response('CAPTCHA verification failed. Please try again.', { status: 403 });
    }
  }

  // Handle GET requests or other methods (e.g., serve a simple page or redirect)
  return new Response('This is a Turnstile verification endpoint. Please submit a POST request with a Turnstile token.', { status: 200 });
}