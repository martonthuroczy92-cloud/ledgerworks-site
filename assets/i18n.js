/* assets/i18n.js — in-page language switching for a two-language static site.
 *
 * One file per page holds both languages: the markup carries data-i18n keys and
 * the page supplies a dictionary. Switching swaps text in place, with no
 * navigation and no second copy of the page to keep in sync.
 *
 * The trade-off that choice makes is discoverability — a crawler fetching one
 * URL sees one language. Two things soften it without reintroducing duplicate
 * files:
 *   - the switcher renders REAL links to ?lang=xx, so each language has a
 *     crawlable, shareable, linkable address;
 *   - the page declares hreflang alternates pointing at those addresses.
 * A JS-executing crawler landing on ?lang=hu therefore indexes Hungarian. A
 * crawler that does not execute JS still only sees the page's native language,
 * which is why each page's `default` is the language its audience arrives in.
 *
 * Only the non-native language needs a dictionary: the native one is read out
 * of the markup on load.
 *
 * Usage:
 *   var i18n = LWI18n.init({
 *     default: 'en',                         // the language the markup is in
 *     strings: { hu: {...} },                // plus en: {} for JS-only strings
 *     meta:    { hu: { title, description, locale } },
 *     onChange: function (lang, t) { ... }   // optional, for JS-rendered text
 *   });
 *   i18n.t('some.key')            -> string in the current language
 *   i18n.t('greet', { n: 3 })     -> fills {n} placeholders
 */
(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'lw_lang';
  var LANGS = ['en', 'hu'];

  function isLang(v) { return LANGS.indexOf(v) !== -1; }

  function stored() {
    // A private window or blocked site data throws here rather than returning
    // null, so every access is guarded and the page falls back to its default.
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function remember(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function fromUrl() {
    try { return new URLSearchParams(window.location.search).get('lang'); } catch (e) { return null; }
  }

  function format(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function setMeta(selector, value) {
    var el = document.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  }

  var LWI18n = {};

  LWI18n.init = function (config) {
    var strings = config.strings || {};
    var meta = config.meta || {};
    var fallback = config.default;

    // URL wins over the remembered choice so a ?lang= link always shows what it
    // promises — otherwise someone sharing a Hungarian link would send an
    // English reader to their own stored English.
    var urlLang = fromUrl();
    var lang = isLang(urlLang) ? urlLang : (isLang(stored()) ? stored() : fallback);

    function t(key, vars) {
      var table = strings[lang] || {};
      var value = table[key];
      if (value === undefined) {
        // Missing key falls back to the page's native language, then to the key
        // itself, so a gap in one dictionary degrades to readable text rather
        // than a blank element.
        value = (strings[fallback] || {})[key];
        if (value === undefined) return key;
      }
      return format(value, vars);
    }

    function applyAttr(attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) {
        apply(nodes[i], t(nodes[i].getAttribute(attr)));
      }
    }

    // The markup is already written in the page's native language, so that
    // language is read out of the DOM rather than restated in a dictionary.
    // Only the other language needs writing, and the two can't drift apart.
    // Keys already present in the supplied dictionary win — that's how
    // JS-rendered strings, which have no element to read from, get their
    // native-language text.
    function captureDefaults() {
      var table = strings[fallback] || (strings[fallback] = {});
      function grab(attr, read) {
        var nodes = document.querySelectorAll('[' + attr + ']');
        for (var i = 0; i < nodes.length; i++) {
          var key = nodes[i].getAttribute(attr);
          if (table[key] === undefined) table[key] = read(nodes[i]);
        }
      }
      grab('data-i18n', function (el) { return el.textContent; });
      grab('data-i18n-html', function (el) { return el.innerHTML; });
      grab('data-i18n-placeholder', function (el) { return el.placeholder || ''; });
      grab('data-i18n-aria', function (el) { return el.getAttribute('aria-label') || ''; });
      grab('data-i18n-href', function (el) { return el.getAttribute('href') || ''; });

      var m = meta[fallback] || (meta[fallback] = {});
      if (!m.title) m.title = document.title;
      if (!m.description) {
        var d = document.querySelector('meta[name="description"]');
        m.description = d ? d.getAttribute('content') : '';
      }
      if (!m.locale) {
        var l = document.querySelector('meta[property="og:locale"]');
        m.locale = l ? l.getAttribute('content') : '';
      }
    }

    function apply() {
      document.documentElement.lang = lang;

      applyAttr('data-i18n', function (el, v) { el.textContent = v; });
      // innerHTML is only ever fed dictionary values authored in this repo —
      // never anything a visitor typed — so the markup in them is intentional.
      applyAttr('data-i18n-html', function (el, v) { el.innerHTML = v; });
      applyAttr('data-i18n-placeholder', function (el, v) { el.placeholder = v; });
      applyAttr('data-i18n-aria', function (el, v) { el.setAttribute('aria-label', v); });
      applyAttr('data-i18n-href', function (el, v) { el.setAttribute('href', v); });

      var m = meta[lang] || {};
      if (m.title) document.title = m.title;
      setMeta('meta[name="description"]', m.description);
      setMeta('meta[property="og:title"]', m.title);
      setMeta('meta[property="og:description"]', m.description);
      setMeta('meta[name="twitter:title"]', m.title);
      setMeta('meta[name="twitter:description"]', m.description);
      setMeta('meta[property="og:locale"]', m.locale);

      renderSwitch();
      if (typeof config.onChange === 'function') config.onChange(lang, t);
    }

    function setLang(next) {
      if (!isLang(next) || next === lang) return;
      lang = next;
      remember(lang);
      // Keep the address bar honest so the page can be shared or reloaded in
      // the language actually on screen. The hash is preserved: someone
      // switching language halfway down the pricing section stays there.
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url.pathname + url.search + window.location.hash);
      } catch (e) {}
      apply();
    }

    function renderSwitch() {
      var hosts = document.querySelectorAll('[data-lang-switch]');
      for (var h = 0; h < hosts.length; h++) {
        var host = hosts[h];
        host.textContent = '';
        host.setAttribute('role', 'group');
        host.setAttribute('aria-label', t('lang.switchLabel'));

        LANGS.forEach(function (code, i) {
          if (i > 0) {
            var sep = document.createElement('span');
            sep.className = 'lang-sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '/';
            host.appendChild(sep);
          }
          var a = document.createElement('a');
          a.className = 'lang-opt' + (code === lang ? ' active' : '');
          a.textContent = code.toUpperCase();
          a.href = '?lang=' + code + window.location.hash;
          a.lang = code;
          a.setAttribute('aria-label', t('lang.to.' + code));
          if (code === lang) a.setAttribute('aria-current', 'true');
          a.addEventListener('click', function (e) {
            // Plain left-click switches in place; modifier-clicks and
            // middle-clicks fall through so "open in new tab" still works.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            setLang(code);
          });
          host.appendChild(a);
        });
      }
    }

    captureDefaults();
    apply();

    return { t: t, get lang() { return lang; }, set: setLang };
  };

  window.LWI18n = LWI18n;
})(window, document);
