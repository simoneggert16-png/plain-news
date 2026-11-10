/**
 * Defensive URL & JSON-LD sanitizers to prevent DOM/Stored XSS via
 * `javascript:` / `data:` / `vbscript:` schemes or `</script>` breakouts.
 */

export function safeHttpUrl(raw, fallback = '') {
  const str = String(raw ?? '').trim();
  if (!str) return fallback;
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // Invalid or non-absolute URL
  }
  return fallback;
}

export function safeHref(raw, fallback = '#') {
  const str = String(raw ?? '').trim();
  if (!str) return fallback;
  if (str.startsWith('/') && !str.startsWith('//') && !/[\u0000-\u001f\\]/.test(str)) {
    return str;
  }
  return safeHttpUrl(str, fallback);
}

export function safeJsonLd(value) {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
