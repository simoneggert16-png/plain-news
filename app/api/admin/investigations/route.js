import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  getInvestigationStatus,
  listInvestigations,
  listOutreach,
  listRequests,
  requestOutreach,
  setInvestigationStatus,
  setOutreach,
  setRequestStatus,
  weekUsage,
} from '@/lib/investigationStore.mjs';
import { weekKey } from '@/lib/investigations.mjs';
import { listMessages } from '@/lib/inboxStore.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMINS = String(process.env.ADMIN_EMAILS || 'simoneggert16@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// The dossiers also live in the repository. If the database does not answer,
// the editor still gets to see what the desk has worked out - only the
// approval itself needs the table.
function dossiersFromFiles() {
  const dir = path.join(process.cwd(), 'content', 'investigations');
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json') && f !== 'state.json')
      .map((f) => {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return {
          slug: d.slug,
          title: d.title,
          angle: d.angle,
          status: d.status,
          priority: d.priority,
          source_count: (d.sources || []).length,
          verified_claims: (d.claims || []).length,
          open_questions: (d.gaps || []).length,
          gaps: (d.gaps || []).slice(0, 5),
          centre: d.centre || null,
          beat: d.beat || null,
          outreach_pending: 0,
          outreach_sent: 0,
          next_step: d.nextStep || null,
          updated_at: d.updatedAt || d.createdAt || null,
          published_at: d.published?.at || null,
          draft: d.draft || null,
        };
      })
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  } catch {
    return [];
  }
}

/**
 * The draft is not in the database - it is the work product in the repository.
 * An editor who approves a piece has to be able to read it first.
 */
function withDrafts(list) {
  const files = dossiersFromFiles();
  if (!files.length) return list;
  const byslug = new Map(files.map((f) => [f.slug, f]));
  return list.map((row) => {
    const file = byslug.get(row.slug);
    if (!file) return row;
    return {
      ...row,
      draft: file.draft || null,
      gaps: file.gaps || row.gaps || [],
      centre: file.centre || row.centre || null,
      beat: file.beat || row.beat || null,
    };
  });
}

/**
 * What the desk remembers between shifts: the institutions it follows and the
 * questions it still owes its readers. It is the desk's own memory, so the
 * editor can see what the team is working towards.
 */
function deskState() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'content', 'investigations', 'state.json'), 'utf8');
    const state = JSON.parse(raw);
    return {
      beats: Array.isArray(state.beats) ? state.beats.slice(-12) : [],
      followups: Array.isArray(state.followups) ? state.followups.slice(-12) : [],
      lastIntake: state.lastIntake || null,
    };
  } catch {
    return { beats: [], followups: [], lastIntake: null };
  }
}

async function requireAdmin(request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return { error: 'Anmeldung erforderlich.', status: 401 };
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: 'Supabase ist nicht konfiguriert.', status: 500 };
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await authClient.auth.getUser(accessToken);
  if (error || !user?.email) return { error: 'Sitzung ungültig.', status: 401 };
  if (!ADMINS.includes(user.email.toLowerCase())) {
    return { error: 'Kein Redaktionszugang für dieses Konto.', status: 403 };
  }
  return { user };
}

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [requests, investigations, outreach, usage, messages] = await Promise.all([
      listRequests({ limit: 80 }).catch(() => []),
      listInvestigations().catch(() => dossiersFromFiles()),
      listOutreach({ limit: 80 }).catch(() => []),
      weekUsage(weekKey()).catch(() => null),
      // The inbox table only exists after the migration ran; the page keeps
      // loading without it.
      listMessages({ limit: 60 }).catch(() => []),
    ]);
    return NextResponse.json({
      admin: auth.user.email,
      week: weekKey(),
      quota: usage,
      requests,
      investigations: withDrafts(investigations),
      outreach,
      messages,
      desk: deskState(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Admin investigations GET failed:', err.message);
    return NextResponse.json({ error: 'Übersicht konnte nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const by = auth.user.email;
    const now = new Date().toISOString();

    if (action === 'approve-outreach' || action === 'reject-outreach') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : [];
      if (!ids.length) return NextResponse.json({ error: 'Keine Entwürfe ausgewählt.' }, { status: 400 });
      await setOutreach(ids, action === 'approve-outreach'
        ? { status: 'approved', approved_by: by, approved_at: now }
        : { status: 'rejected', approved_by: by, approved_at: now });
      return NextResponse.json({ ok: true, updated: ids.length });
    }

    if (action === 'request-outreach') {
      const slug = String(body.slug || '').trim();
      const toEmail = String(body.toEmail || '').trim().toLowerCase();
      if (!slug) return NextResponse.json({ error: 'Kein Dossier ausgewählt.' }, { status: 400 });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
        return NextResponse.json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 });
      }
      const dossier = await getInvestigationStatus(slug);
      if (!dossier) return NextResponse.json({ error: 'Dossier nicht gefunden.' }, { status: 404 });
      if (dossier.status === 'published') {
        return NextResponse.json({ error: 'Veröffentlichte Dossiers verschicken keine Anfragen mehr.' }, { status: 409 });
      }
      await requestOutreach({
        slug,
        toEmail,
        org: String(body.org || '').slice(0, 160),
        note: String(body.note || '').slice(0, 1000),
      });
      return NextResponse.json({ ok: true, status: 'requested' }, { status: 201 });
    }

    if (action === 'mark-replied') {
      const id = String(body.id || '');
      if (!id) return NextResponse.json({ error: 'Kein Eintrag ausgewählt.' }, { status: 400 });
      await setOutreach([id], { status: 'replied', reply_note: String(body.note || '').slice(0, 2000) });
      return NextResponse.json({ ok: true });
    }

    if (action === 'publish') {
      const slug = String(body.slug || '');
      let current;
      try {
        current = await getInvestigationStatus(slug);
      } catch (err) {
        // Without the table the approval cannot be stored there. The decision
        // is still a human one, so it goes to the desk as a run: the desk
        // writes it into the dossier and publishes. The editor gets a link
        // instead of a dead end.
        const repo = process.env.GITHUB_REPO || 'simoneggert16-png/plain-news';
        const dispatch = `https://github.com/${repo}/actions/workflows/investigations.yml/dispatch?inputs%5Bapprove%5D=${encodeURIComponent(slug)}`;
        return NextResponse.json(
          {
            error: 'Die Datenbank antwortet nicht. Die Freigabe geht stattdessen an den Desk: dort wird sie festgehalten und der Text veröffentlicht.',
            dispatch,
          },
          { status: 503 }
        );
      }
      if (!current) return NextResponse.json({ error: 'Dossier nicht gefunden.' }, { status: 404 });
      if (current.status !== 'review') {
        return NextResponse.json({ error: `Nur geprüfte Dossiers können freigegeben werden (Status: ${current.status}).` }, { status: 409 });
      }
      await setInvestigationStatus(slug, 'approved', { approved_at: now });
      return NextResponse.json({ ok: true, status: 'approved' });
    }

    if (action === 'drop' || action === 'reopen') {
      const slug = String(body.slug || '');
      if (!slug) return NextResponse.json({ error: 'Kein Dossier ausgewählt.' }, { status: 400 });
      await setInvestigationStatus(slug, action === 'drop' ? 'dropped' : 'research');
      return NextResponse.json({ ok: true });
    }

    if (action === 'decline-request' || action === 'accept-request') {
      const id = String(body.id || '');
      if (!id) return NextResponse.json({ error: 'Kein Wunsch ausgewählt.' }, { status: 400 });
      await setRequestStatus(id, action === 'decline-request' ? 'declined' : 'selected');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
  } catch (err) {
    console.error('Admin investigations POST failed:', err.message);
    return NextResponse.json({ error: 'Aktion fehlgeschlagen.' }, { status: 500 });
  }
}
