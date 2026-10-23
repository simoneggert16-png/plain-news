// Shared visitor metadata helper for API routes (Node runtime).
// Keeps IP handling identical to the middleware: raw IP only when
// VISITS_FULL_IP=1, otherwise masked + salted hash.

export function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.length >= 3 ? `${parts.slice(0, 3).join(':')}::` : null;
  }
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0` : null;
}

export async function hashIp(ip) {
  const salt = process.env.VISIT_HASH_SALT || 'plain-news';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${salt}`));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function decode(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function visitorMeta(request) {
  const h = request.headers;
  const xff = h.get('x-forwarded-for');
  const ip = (xff ? xff.split(',')[0] : h.get('x-real-ip') || '').trim();

  const meta = {
    ip_masked: maskIp(ip),
    ip_hash: ip ? await hashIp(ip) : null,
    country: h.get('x-vercel-ip-country') || null,
    region: decode(h.get('x-vercel-ip-country-region')),
    city: decode(h.get('x-vercel-ip-city')),
    ua: (h.get('user-agent') || '').slice(0, 300) || null,
  };
  if (ip && process.env.VISITS_FULL_IP === '1') meta.ip = ip;
  return meta;
}
