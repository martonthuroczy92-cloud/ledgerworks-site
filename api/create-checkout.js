// /api/create-checkout.js
// Creates a Stripe Checkout Session for the automated build brief.
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
  BRIEF_PRICE_CENTS, BRIEF_CURRENCY, makeStripe, baseUrl, kv, sanitizeAnswers
} = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let stripe, origin;
  try {
    stripe = makeStripe();
    origin = baseUrl();
  } catch (err) {
    console.error('create-checkout config error:', err.message);
    res.status(500).json({ error: 'Server is not configured.' });
    return;
  }

  const answers = sanitizeAnswers(req.body && req.body.answers);
  if (!answers.idea) {
    res.status(400).json({ error: 'Describe what you want to build before paying.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: BRIEF_CURRENCY,
          unit_amount: BRIEF_PRICE_CENTS,
          product_data: {
            name: 'Ledgerworks — Automated build brief',
            description: 'AI-generated architecture recommendation, risk flags, and prompt pack.'
          }
        },
        quantity: 1
      }],
      // Collected so you can reach the buyer if generation fails after payment.
      customer_creation: 'always',
      // Managed Payments (Stripe's new default) requires a product tax code
      // we don't have on this inline price_data line item — disable it here
      // rather than maintain a persistent Stripe Product just to satisfy it.
      managed_payments: { enabled: false },
      success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}#brief',
      cancel_url: origin + '/?checkout=cancelled#brief'
    });

    if (kv) {
      try {
        // Expires well after the Checkout Session itself (Stripe sessions
        // expire in 24h), so there's no orphaned data sitting around.
        await kv.set('brief_answers:' + session.id, answers, { ex: 60 * 60 * 48 });
      } catch (err) {
        console.error('KV answer store failed:', err);
        // Fall through — brief.js will fall back to client-supplied answers.
      }
    }

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('create-checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
};
