// /api/_shared.js
// Single source of truth for values that must agree across endpoints.
// Underscore prefix keeps Vercel from exposing this as a route.

const BRIEF_PRICE_CENTS = 19000;   // €190.00
const BRIEF_CURRENCY = 'eur';

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
const FIELD_LIMITS = {
  idea: 1200, custody: 200, rails: 200, jurisdiction: 200,
  users: 600, stack: 200, extra: 1200
};

function sanitizeAnswers(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(FIELD_LIMITS)) {
    const v = raw[key];
    if (typeof v !== 'string') continue;
    // Strip control chars, collapse runaway whitespace, then hard-truncate.
    out[key] = v
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, FIELD_LIMITS[key]);
  }
  return out;
}

module.exports = {
  BRIEF_PRICE_CENTS, BRIEF_CURRENCY, makeStripe, baseUrl, kv, sanitizeAnswers
};
