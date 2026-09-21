// /api/create-checkout.js
// Creates a Stripe Checkout Session for any paid generator on the site.
// Which one is decided by the `product` field in the body; it defaults to
// 'brief' so the original English page, which sends no such field, is
// unaffected.
//
// The answers are stored SERVER-SIDE against the session id here, rather than
// being sent up again after payment. Two reasons:
//   1. The buyer can't lose their answers if the tab reloads or they pay on
//      another device — they've paid, so losing the input would mean a refund.
//   2. The answers that get generated are provably the ones that were paid for.
//
// Env vars required: STRIPE_SECRET_KEY, PUBLIC_BASE_URL
// Env vars recommended: Vercel KV (answer storage + replay protection)

const {
  getProduct, makeStripe, baseUrl, kv, sanitizeAnswers
} = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let stripe, origin, product;
  try {
    product = getProduct(req.body && req.body.product);
    stripe = makeStripe();
    origin = baseUrl();
  } catch (err) {
    console.error('create-checkout config error:', err.message);
    res.status(500).json({ error: 'Server is not configured.' });
    return;
  }

  const answers = sanitizeAnswers(req.body && req.body.answers, product.limits);
  if (!answers[product.requiredField]) {
    res.status(400).json({ error: 'Answer the questions before paying.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: { name: product.name, description: product.description }
        },
        quantity: 1
      }],
      // Collected so you can reach the buyer if generation fails after payment.
      customer_creation: 'always',
      // Managed Payments (Stripe's new default) requires a product tax code
      // we don't have on this inline price_data line item — disable it here
      // rather than maintain a persistent Stripe Product just to satisfy it.
      managed_payments: { enabled: false },
      success_url: origin + product.successPath,
      cancel_url: origin + product.cancelPath
    });

    if (kv) {
      try {
        // Expires well after the Checkout Session itself (Stripe sessions
        // expire in 24h), so there's no orphaned data sitting around.
        await kv.set(product.kvPrefix + 'answers:' + session.id, answers, { ex: 60 * 60 * 48 });
      } catch (err) {
        console.error('KV answer store failed:', err);
        // Fall through — the generator falls back to client-supplied answers.
      }
    }

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('create-checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
};
