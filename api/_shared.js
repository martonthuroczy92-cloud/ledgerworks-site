// /api/_shared.js
// Single source of truth for values that must agree across endpoints.
// Underscore prefix keeps Vercel from exposing this as a route.

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
// Every paid generator on the site is one entry here. An endpoint never hard-
// codes a price: it looks the product up and compares what Stripe reports
// against `amount` and `currency`, so a tampered client can't buy a 34 900 Ft
// product for 190 EUR or vice versa.
//
// Currency note — HUF is charged as a 2-decimal currency (34 900 Ft is
// 3_490_000, not 34_900). Stripe only treats it as zero-decimal for *payouts*,
// where the integer must divide by 100. Keeping charge amounts divisible by
// 100 as well means payouts never strand a remainder. Getting this wrong is a
// silent 100x error in either direction, so the arithmetic is spelled out.
const HUF = ft => ft * 100;

const PRODUCTS = {
  // The original English build brief. Paths and KV prefixes are unchanged
  // from before this file grew a registry — in-flight sessions keep working.
  brief: {
    amount: 19000,                 // €190.00
    currency: 'eur',
    name: 'Ledgerworks — Automated build brief',
    description: 'AI-generated architecture recommendation, risk flags, and prompt pack.',
    successPath: '/?session_id={CHECKOUT_SESSION_ID}#brief',
    cancelPath: '/?checkout=cancelled#brief',
    kvPrefix: 'brief_',
    requiredField: 'idea',
    limits: {
      idea: 1200, custody: 200, rails: 200, jurisdiction: 200,
      users: 600, stack: 200, extra: 1200
    }
  },

  // Hungarian eÁFA migration diagnosis. See
  // docs/opportunity-eafa-reconciliation.md for why this product exists.
  eafa: {
    amount: HUF(34900),            // 34 900 Ft
    currency: 'huf',
    name: 'Ledgerworks — eÁFA-átállási diagnózis',
    description: 'Személyre szabott eÁFA-átállási terv: útvonal, határidők, adatminőségi kockázatok, heti teendők.',
    successPath: '/eafa?session_id={CHECKOUT_SESSION_ID}#diagnozis',
    cancelPath: '/eafa?checkout=cancelled#diagnozis',
    kvPrefix: 'eafa_',
    requiredField: 'tevekenyseg',
    limits: {
      tevekenyseg: 1200, bevallas: 120, kimeno: 120, bejovo: 120,
      szoftver: 400, ki_keszit: 200, nyugta: 200, specialis: 1200
    }
  }
};

function getProduct(id) {
  // Default to 'brief' so the live page, which posts no product field, is
  // unaffected.
  const product = PRODUCTS[typeof id === 'string' && id ? id : 'brief'];
  if (!product) throw new Error('Unknown product: ' + id);
  return product;
}

// Kept for older callers that import the brief price directly.
const BRIEF_PRICE_CENTS = PRODUCTS.brief.amount;
const BRIEF_CURRENCY = PRODUCTS.brief.currency;

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

// Do NOT pin an apiVersion string by hand — Stripe version strings now carry a
// codename suffix (e.g. "2026-03-25.dahlia") and a malformed one is rejected.
// Letting the SDK use the version pinned in your Stripe dashboard is safer.
function makeStripe() {
  const Stripe = require('stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key);
}

// Never trust Host/Origin headers to build redirect URLs — a forged Host can
// point success_url at an attacker's domain. Set PUBLIC_BASE_URL in Vercel.
function baseUrl() {
  const url = process.env.PUBLIC_BASE_URL;
  if (!url) throw new Error('PUBLIC_BASE_URL not set');
  return url.replace(/\/+$/, '');
}

let kv = null;
try { kv = require('@vercel/kv').kv; } catch (e) { kv = null; }

// Field caps: bound what reaches the model so a huge paste can't run up cost
// or push the real instructions out of the context window.
function sanitizeAnswers(raw, limits) {
  const caps = limits || PRODUCTS.brief.limits;
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(caps)) {
    const v = raw[key];
    if (typeof v !== 'string') continue;
    // Strip control chars, collapse runaway whitespace, then hard-truncate.
    out[key] = v
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, caps[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Paid-session gate
// ---------------------------------------------------------------------------
// Shared by every generator endpoint. Returns either
//   { ok: false, status, code }            — refuse, endpoint words the error
//   { ok: true, answers, claimed, release } — go ahead
// `code` is a stable symbol the caller maps to a message in its own language,
// which is why this helper returns codes rather than prose.
async function claimPaidSession({ sessionId, product, fallbackAnswers }) {
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    return { ok: false, status: 402, code: 'payment_required' };
  }

  // ---------- 1. Verify payment with Stripe itself ----------
  // The browser's word is never accepted as proof of payment.
  let session;
  try {
    session = await makeStripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('Stripe verify failed:', err.message);
    return { ok: false, status: 402, code: 'unverifiable' };
  }

  if (session.payment_status !== 'paid') {
    return { ok: false, status: 402, code: 'not_paid' };
  }
  if (session.amount_total !== product.amount || session.currency !== product.currency) {
    console.error('Amount mismatch on', sessionId, session.amount_total, session.currency);
    return { ok: false, status: 402, code: 'amount_mismatch' };
  }
  // A paid session stays "paid" forever. Without an age bound, a leaked
  // session id is a permanent free pass.
  const ageHours = (Date.now() / 1000 - (session.created || 0)) / 3600;
  if (ageHours > 48) {
    return { ok: false, status: 410, code: 'too_old' };
  }

  // ---------- 2. Claim the session atomically (replay protection) ----------
  // set with nx:true either creates the key or fails — no check-then-act gap
  // where two concurrent requests both pass the check.
  const claimKey = product.kvPrefix + 'claim:' + sessionId;
  let claimed = false;
  if (kv) {
    try {
      const ok = await kv.set(claimKey, 'in_progress', { nx: true, ex: 60 * 60 * 24 * 30 });
      if (!ok) return { ok: false, status: 409, code: 'already_used' };
      claimed = true;
    } catch (err) {
      console.error('KV claim failed — replay protection degraded:', err);
    }
  }

  async function release() {
    if (kv && claimed) {
      try { await kv.del(claimKey); } catch (e) { /* buyer can email */ }
    }
  }
  async function settle() {
    if (kv && claimed) {
      try { await kv.set(claimKey, 'done', { ex: 60 * 60 * 24 * 30 }); } catch (e) {}
    }
  }

  // ---------- 3. Recover the answers that were paid for ----------
  let answers = null;
  if (kv) {
    try { answers = await kv.get(product.kvPrefix + 'answers:' + sessionId); } catch (e) { answers = null; }
  }
  if (!answers) answers = sanitizeAnswers(fallbackAnswers, product.limits);
  if (!answers[product.requiredField]) {
    await release();
    return { ok: false, status: 400, code: 'answers_lost' };
  }

  return { ok: true, answers, release, settle };
}

// ---------------------------------------------------------------------------
// Model call
// ---------------------------------------------------------------------------
// Returns { text, truncated } or throws. Bounded below Vercel's function
// timeout so a hung upstream surfaces as an error the buyer can retry rather
// than a dead request.
async function generate({ apiKey, model, maxTokens, system, user }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: user }]
      })
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, await response.text());
      const err = new Error('upstream_error');
      err.code = 'upstream_error';
      throw err;
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    if (!text) {
      const err = new Error('empty_generation');
      err.code = 'empty_generation';
      throw err;
    }
    // Tell the buyer rather than silently handing them a cut-off document.
    return { text, truncated: data.stop_reason === 'max_tokens' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  PRODUCTS, getProduct, BRIEF_PRICE_CENTS, BRIEF_CURRENCY,
  makeStripe, baseUrl, kv, sanitizeAnswers, claimPaidSession, generate
};
