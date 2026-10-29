import { getSupabaseAdminClient } from './supabase-admin.mjs';
import { INVESTIGATION_QUOTAS, weekKey } from './investigations.mjs';

const db = () => getSupabaseAdminClient();

/** How many wishes the week already holds, globally and for one reader. */
export async function weekUsage(week = weekKey(), userId = null) {
  // Declined wishes keep their slot: ten wishes stay ten wishes, even if the
  // desk says no to one of them.
  const { count, error } = await db()
    .from('investigation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('week_key', week)
    .in('status', ['new', 'selected', 'declined']);
  if (error) throw error;
  let mine = 0;
  if (userId) {
    const { count: mineCount, error: mineError } = await db()
      .from('investigation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('week_key', week)
      .eq('user_id', userId);
    if (mineError) throw mineError;
    mine = mineCount || 0;
  }
  return {
    week,
    site: count || 0,
    mine,
    siteLeft: Math.max(0, INVESTIGATION_QUOTAS.wishesPerWeek - (count || 0)),
    mineLeft: Math.max(0, INVESTIGATION_QUOTAS.wishesPerReaderPerWeek - mine),
  };
}

export async function addRequest({ userId, email, topic, why, region, hints, week }) {
  const { data, error } = await db()
    .from('investigation_requests')
    .insert({
      user_id: userId,
      email,
      topic,
      why,
      region,
      hints,
      week_key: week || weekKey(),
      status: 'new',
    })
    .select('id, topic, status, week_key, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listRequests({ week = null, status = null, email = null, limit = 60 } = {}) {
  let q = db()
    .from('investigation_requests')
    .select('id, email, topic, why, region, hints, week_key, status, investigation_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (week) q = q.eq('week_key', week);
  if (status) q = q.eq('status', status);
  if (email) q = q.eq('email', email);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function setRequestStatus(id, status, investigationSlug = null) {
  const { error } = await db()
    .from('investigation_requests')
    .update({ status, investigation_slug: investigationSlug, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function upsertInvestigation(row) {
  const { error } = await db()
    .from('investigations')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'slug' });
  if (error) throw error;
}

export async function listInvestigations() {
  const { data, error } = await db()
    .from('investigations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function getInvestigationStatus(slug) {
  const { data, error } = await db()
    .from('investigations')
    .select('slug, status, approved_at, published_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setInvestigationStatus(slug, status, extra = {}) {
  const { error } = await db()
    .from('investigations')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) throw error;
}

export async function addOutreach(rows) {
  if (!rows.length) return [];
  const { data, error } = await db()
    .from('investigation_outreach')
    .insert(rows.map((r) => ({
      slug: r.slug,
      to_email: r.toEmail || '',
      org: r.org || null,
      contact_name: r.contactName || null,
      subject: r.subject,
      body: r.body,
      status: 'draft',
    })))
    .select('id, slug, to_email, org, subject, status, created_at');
  if (error) throw error;
  return data;
}

/** Editor queues a recipient; the bot writes the text on its next run. */
export async function requestOutreach({ slug, toEmail, org, note }) {
  const { data, error } = await db()
    .from('investigation_outreach')
    .insert({
      slug,
      to_email: toEmail,
      org: org || null,
      subject: '',
      body: '',
      status: 'requested',
      reply_note: note || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function listOutreach({ status = null, limit = 80 } = {}) {
  let q = db()
    .from('investigation_outreach')
    .select('id, slug, to_email, org, contact_name, subject, body, status, approved_by, approved_at, sent_at, error, reply_note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function setOutreach(ids, patch) {
  if (!ids.length) return;
  const { error } = await db()
    .from('investigation_outreach')
    .update(patch)
    .in('id', ids);
  if (error) throw error;
}

export async function pendingOutreachCounts() {
  const { data, error } = await db()
    .from('investigation_outreach')
    .select('slug, status');
  if (error) throw error;
  const counts = { pending: 0, sent: 0, bySlug: {} };
  for (const row of data) {
    const bucket = counts.bySlug[row.slug] ||= { pending: 0, sent: 0 };
    if (['requested', 'draft', 'approved'].includes(row.status)) { counts.pending++; bucket.pending++; }
    if (row.status === 'sent' || row.status === 'replied') { counts.sent++; bucket.sent++; }
  }
  return counts;
}
