/**
 * Edge- and Node-compatible constant-time HTTP Basic Auth check for
 * `/admin/visits` and internal diagnostic endpoints.
 */

export function constantTimeEqualStrings(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(String(a ?? ''));
  const bufB = enc.encode(String(b ?? ''));
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < bufA.length ? bufA[i] : 0;
    const byteB = i < bufB.length ? bufB[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

export function isVisitsAdminAuthorized(authHeader) {
  const user = process.env.VISITS_ADMIN_USER;
  const pass = process.env.VISITS_ADMIN_PASS;
  if (!user || !pass) return false;
  const header = String(authHeader || '');
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6).trim());
    return constantTimeEqualStrings(decoded, `${user}:${pass}`);
  } catch {
    return false;
  }
}

export function isInternalDiagAuthorized(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (isVisitsAdminAuthorized(authHeader)) return true;
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (cronSecret && authHeader.startsWith('Bearer ')) {
    return constantTimeEqualStrings(authHeader.slice(7).trim(), cronSecret);
  }
  return false;
}
