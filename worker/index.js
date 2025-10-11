addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const token = formData.get('cf-turnstile-response'); // The name of the Turnstile token field

    const SECRET_KEY = 'YOUR_TURNSTILE_SECRET_KEY'; // Replace with your Turnstile secret key

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
      // You can now serve the protected content or redirect the user
      return new Response('CAPTCHA verification successful! Access granted.', { status: 200 });
    } else {
      // CAPTCHA verification failed
      console.log(outcome['error-codes']);
      return new Response('CAPTCHA verification failed. Please try again.', { status: 403 });
    }
  }

  // Handle GET requests or other methods (e.g., serve a simple page or redirect)
  return new Response('This is a Turnstile verification endpoint. Please submit a POST request with a Turnstile token.', { status: 200 });
}