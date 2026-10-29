import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addRequest, listRequests, weekUsage } from '@/lib/investigationStore.mjs';
import { INVESTIGATION_QUOTAS, parseRequestInput, weekKey } from '@/lib/investigations.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function authenticatedUser(request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return { error: 'Bitte melde dich mit einem bestätigten Konto an.', status: 401 };
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: 'Anmeldung ist nicht konfiguriert.', status: 500 };
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await authClient.auth.getUser(accessToken);
  if (error || !user?.email || !user.email_confirmed_at) {
    return { error: 'Bitte bestätige zuerst deine E-Mail-Adresse.', status: 403 };
  }
  return { user };
}

export async function GET(request) {
  try {
    const { user, error, status } = await authenticatedUser(request);
    if (error) return NextResponse.json({ error }, { status });
    const week = weekKey();
    const [usage, mine] = await Promise.all([
      weekUsage(week, user.id),
      listRequests({ email: user.email.toLowerCase(), limit: 20 }),
    ]);
    return NextResponse.json({
      week,
      quota: usage,
      requests: mine,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Investigation request GET failed:', err.message);
    return NextResponse.json({ error: 'Wünsche konnten nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, error, status } = await authenticatedUser(request);
    if (error) return NextResponse.json({ error }, { status });

    let input;
    try {
      input = parseRequestInput(await request.json());
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const week = weekKey();
    const usage = await weekUsage(week, user.id);
    if (usage.siteLeft <= 0) {
      return NextResponse.json({
        error: `Die Wunschliste für diese Woche ist voll (${INVESTIGATION_QUOTAS.wishesPerWeek} Wünsche). Nächste Woche wieder.`,
        quota: usage,
      }, { status: 429 });
    }
    if (usage.mineLeft <= 0) {
      return NextResponse.json({
        error: `Du hast diese Woche bereits ${INVESTIGATION_QUOTAS.wishesPerReaderPerWeek} Themen vorgeschlagen.`,
        quota: usage,
      }, { status: 429 });
    }

    const created = await addRequest({
      userId: user.id,
      email: user.email.toLowerCase(),
      ...input,
      week,
    });
    const after = await weekUsage(week, user.id);
    return NextResponse.json({ request: created, quota: after }, { status: 201 });
  } catch (err) {
    console.error('Investigation request POST failed:', err.message);
    return NextResponse.json({ error: 'Wunsch konnte nicht gespeichert werden.' }, { status: 500 });
  }
}
