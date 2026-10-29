'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const STATUS_DE = {
  new: 'neu',
  selected: 'ausgewählt',
  declined: 'abgelehnt',
  archived: 'archiviert',
  pitch: 'Notiz',
  research: 'Recherche',
  outreach: 'Outreach',
  drafting: 'Schreiben',
  review: 'zur Freigabe',
  approved: 'freigegeben',
  published: 'veröffentlicht',
  dropped: 'verworfen',
  draft: 'Entwurf',
  requested: 'angefragt',
  sent: 'gesendet',
  replied: 'beantwortet',
  failed: 'Fehler',
  rejected: 'abgelehnt',
};

const PRIORITY_LABEL = { 1: 'hoch', 2: 'mittel', 3: 'normal', 4: 'tief', 5: 'später' };

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString('de-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' }) : '—';

const panel = { border: '1px solid var(--ink)', background: 'var(--paper)', marginBottom: '28px' };
const panelHead = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px',
  padding: '10px 14px', borderBottom: '1px solid var(--ink)', background: 'var(--paper-2)',
};
const cell = { padding: '9px 10px', borderBottom: '1px solid var(--paper-3)', verticalAlign: 'top', fontSize: '13px', lineHeight: 1.4 };
const headCell = {
  ...cell, fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--paper-2)', whiteSpace: 'nowrap',
};
const mono = { fontFamily: 'var(--mono)', fontSize: '11px' };
const btn = {
  fontFamily: 'var(--mono)', fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase',
  border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', padding: '4px 9px', cursor: 'pointer',
};
const btnPrimary = { ...btn, background: 'var(--ink)', color: 'var(--paper)' };

export default function AdminInvestigations() {
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [noteDraft, setNoteDraft] = useState({});
  const [queue, setQueue] = useState({ slug: '', toEmail: '', org: '', note: '' });

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (err) {
      setError(err.message);
      setAuthChecked(true);
      return undefined;
    }
    supabase.auth.getSession().then(({ data: s }) => {
      setToken(s?.session?.access_token || null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
      setAuthChecked(true);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/investigations', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Laden fehlgeschlagen.');
      setData(body);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(payload) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Aktion fehlgeschlagen.');
      await load();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function toggleDraft(id) {
    setSelectedDrafts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (!authChecked) {
    return <div className="wrap" style={{ padding: '40px 0' }}>Lade Sitzung …</div>;
  }

  if (!token) {
    return (
      <div className="wrap" style={{ padding: '40px 0' }}>
        <h1 className="page-title" style={{ fontSize: 'clamp(30px,5vw,52px)' }}>Investigativ-Redaktion</h1>
        <p style={{ ...mono, color: 'var(--muted)' }}>
          Bitte mit dem Redaktionskonto anmelden. Kein Zugriff für dieses Konto? ADMIN_EMAILS prüfen.
        </p>
      </div>
    );
  }

  const requests = data?.requests || [];
  const investigations = data?.investigations || [];
  const outreach = data?.outreach || [];
  const quota = data?.quota;

  const wishes = requests.filter((r) => r.status === 'new');
  const pending = outreach.filter((o) => o.status === 'draft');
  const requested = outreach.filter((o) => o.status === 'requested');
  const waiting = outreach.filter((o) => o.status === 'approved');
  const history = outreach.filter((o) => !['draft', 'approved'].includes(o.status));
  const reviewReady = investigations.filter((i) => i.status === 'review');

  return (
    <div className="wrap" style={{ paddingTop: '36px', paddingBottom: '80px' }}>
      <h1 className="page-title" style={{ fontSize: 'clamp(30px,5vw,52px)' }}>Investigativ-Redaktion</h1>
      <p style={{ ...mono, color: 'var(--muted)', marginTop: 0 }}>
        {data?.admin ? `Angemeldet als ${data.admin}` : ''}
        {quota ? ` · Woche ${quota.week} · Wünsche ${quota.site}/10 (du: ${quota.mine}/2)` : ''}
        {` · ${reviewReady.length} zur Freigabe · ${pending.length + requested.length} Outreach offen`}
      </p>

      {error && (
        <p style={{ ...mono, color: 'var(--down)', border: '1px solid var(--down)', padding: '8px 12px' }}>{error}</p>
      )}

      {busy && <p style={{ ...mono, color: 'var(--muted)' }}>Arbeite …</p>}

      {!data && !busy && !error && <p style={{ ...mono }}>Keine Daten.</p>}

      {data && (
        <>
          <section style={panel}>
            <div style={panelHead}>
              <strong style={mono}>LESERWÜNSCHE DIESE WOCHE</strong>
              <span style={{ ...mono, color: 'var(--muted)' }}>{wishes.length} offen</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                <thead>
                  <tr>
                    {['Eingang', 'Thema', 'Warum / Hinweise', 'Region', 'Leser', 'Status', ''].map((h) => (
                      <th key={h} style={headCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wishes.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{fmtTime(r.created_at)}<br />{r.week_key}</td>
                      <td style={{ ...cell, fontWeight: 600, maxWidth: '260px' }}>{r.topic}</td>
                      <td style={{ ...cell, color: 'var(--ink-2)', maxWidth: '340px' }}>
                        {r.why || '—'}
                        {r.hints && <><br /><em>Hinweise: {r.hints}</em></>}
                      </td>
                      <td style={{ ...cell, ...mono }}>{r.region || '—'}</td>
                      <td style={{ ...cell, ...mono, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email}</td>
                      <td style={{ ...cell, ...mono }}>{STATUS_DE[r.status] || r.status}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button style={btnPrimary} disabled={busy} onClick={() => act({ action: 'accept-request', id: r.id })}>
                          Auswählen
                        </button>{' '}
                        <button style={btn} disabled={busy} onClick={() => act({ action: 'decline-request', id: r.id })}>
                          Ablehnen
                        </button>
                      </td>
                    </tr>
                  ))}
                  {wishes.length === 0 && (
                    <tr><td style={cell} colSpan={7}>Diese Woche noch keine offenen Wünsche.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHead}>
              <strong style={mono}>DOSSIERS</strong>
              <span style={{ ...mono, color: 'var(--muted)' }}>{investigations.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '940px' }}>
                <thead>
                  <tr>
                    {['Dossier', 'Status', 'Quellen', 'Belege', 'Offene Fragen', 'Outreach', 'Nächster Schritt', 'Aktualisiert', ''].map((h) => (
                      <th key={h} style={headCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investigations.map((i) => (
                    <tr key={i.slug}>
                      <td style={{ ...cell, maxWidth: '280px' }}>
                        <strong>{i.title || i.slug}</strong>
                        <div style={{ ...mono, color: 'var(--muted)' }}>{i.slug}</div>
                        {i.angle && <div style={{ color: 'var(--ink-2)' }}>{i.angle}</div>}
                      </td>
                      <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>
                        {STATUS_DE[i.status] || i.status}
                        <div style={{ color: 'var(--muted)' }}>{PRIORITY_LABEL[i.priority] || i.priority}</div>
                      </td>
                      <td style={{ ...cell, ...mono }}>{i.source_count ?? 0}</td>
                      <td style={{ ...cell, ...mono }}>{i.verified_claims ?? 0}</td>
                      <td style={{ ...cell, ...mono }}>{i.open_questions ?? 0}</td>
                      <td style={{ ...cell, ...mono }}>{i.outreach_pending ?? 0} offen<br />{i.outreach_sent ?? 0} raus</td>
                      <td style={{ ...cell, color: 'var(--ink-2)', maxWidth: '240px' }}>{i.next_step || '—'}</td>
                      <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{fmtTime(i.updated_at)}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {i.status === 'review' && (
                          <button style={btnPrimary} disabled={busy} onClick={() => act({ action: 'publish', slug: i.slug })}>
                            Freigeben
                          </button>
                        )}{' '}
                        {i.status === 'approved' && <span style={{ ...mono, color: 'var(--muted)' }}>wartet auf Bot-Lauf</span>}
                        {i.status === 'published' && <span style={{ ...mono, color: 'var(--muted)' }}>{fmtTime(i.published_at)}</span>}
                        {i.status !== 'published' && i.status !== 'dropped' && (
                          <button style={btn} disabled={busy} onClick={() => act({ action: 'drop', slug: i.slug })}>
                            Verwerfen
                          </button>
                        )}
                        {(i.status === 'dropped' || i.status === 'published') && (
                          <button style={btn} disabled={busy} onClick={() => act({ action: 'reopen', slug: i.slug })}>
                            Wieder öffnen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {investigations.length === 0 && (
                    <tr><td style={cell} colSpan={9}>Noch keine Dossiers. Der Bot legt sie an, sobald er Wünsche auswählt.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHead}>
              <strong style={mono}>OUTREACH — ENTWÜRFE ZUR FREIGABE</strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={btnPrimary}
                  disabled={busy || selectedDrafts.length === 0}
                  onClick={async () => {
                    await act({ action: 'approve-outreach', ids: selectedDrafts });
                    setSelectedDrafts([]);
                  }}
                >
                  Auswahl freigeben ({selectedDrafts.length})
                </button>
                <button
                  style={btn}
                  disabled={busy || selectedDrafts.length === 0}
                  onClick={async () => {
                    await act({ action: 'reject-outreach', ids: selectedDrafts });
                    setSelectedDrafts([]);
                  }}
                >
                  Ablehnen
                </button>
              </div>
            </div>
            <div style={{ padding: '4px 14px 16px' }}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await act({ action: 'request-outreach', ...queue });
                  setQueue((prev) => ({ ...prev, toEmail: '', org: '', note: '' }));
                }}
                style={{ borderBottom: '1px solid var(--paper-3)', padding: '12px 0 16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}
              >
                <label style={{ ...mono, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  Dossier
                  <select
                    className="auth-text-input"
                    style={{ width: '220px' }}
                    value={queue.slug}
                    onChange={(e) => setQueue((prev) => ({ ...prev, slug: e.target.value }))}
                    required
                  >
                    <option value="">wählen …</option>
                    {investigations.filter((i) => i.status !== 'published').map((i) => (
                      <option key={i.slug} value={i.slug}>{i.slug}</option>
                    ))}
                  </select>
                </label>
                <label style={{ ...mono, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  Empfänger
                  <input
                    className="auth-text-input"
                    style={{ width: '220px' }}
                    type="email"
                    placeholder="presse@organisation.ch"
                    value={queue.toEmail}
                    onChange={(e) => setQueue((prev) => ({ ...prev, toEmail: e.target.value }))}
                    required
                  />
                </label>
                <label style={{ ...mono, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  Organisation
                  <input
                    className="auth-text-input"
                    style={{ width: '180px' }}
                    value={queue.org}
                    onChange={(e) => setQueue((prev) => ({ ...prev, org: e.target.value }))}
                  />
                </label>
                <label style={{ ...mono, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  Hinweis an die KI
                  <input
                    className="auth-text-input"
                    style={{ width: '260px' }}
                    placeholder="z. B. nur zur Auftragsvergabe 2024"
                    value={queue.note}
                    onChange={(e) => setQueue((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </label>
                <button style={btn} type="submit" disabled={busy || !queue.slug || !queue.toEmail}>
                  Anfrage einreihen
                </button>
              </form>

              {requested.map((o) => (
                <p key={o.id} style={{ ...mono, color: 'var(--muted)', padding: '8px 0', margin: 0 }}>
                  {o.slug} · {o.org || o.to_email} · Entwurf folgt im nächsten Bot-Lauf
                </p>
              ))}

              {pending.map((o) => (
                <article key={o.id} style={{ borderBottom: '1px solid var(--paper-3)', padding: '14px 0' }}>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'baseline', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedDrafts.includes(o.id)}
                      onChange={() => toggleDraft(o.id)}
                      style={{ marginTop: '3px' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ ...mono, color: 'var(--muted)' }}>
                        {o.slug} · {o.org || o.contact_name || o.to_email}
                      </span>
                      <strong style={{ display: 'block', fontSize: '15px', margin: '2px 0 6px' }}>{o.subject}</strong>
                      <span style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink-2)' }}>
                        {o.body}
                      </span>
                    </span>
                  </label>
                </article>
              ))}
              {pending.length === 0 && requested.length === 0 && (
                <p style={{ ...mono, color: 'var(--muted)' }}>Keine offenen Entwürfe.</p>
              )}
              {waiting.length > 0 && (
                <p style={{ ...mono, color: 'var(--muted)', marginTop: '14px' }}>
                  {waiting.length} freigegeben — werden beim nächsten Bot-Lauf versendet.
                </p>
              )}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHead}>
              <strong style={mono}>OUTREACH — VERLAUF</strong>
              <span style={{ ...mono, color: 'var(--muted)' }}>{history.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
                <thead>
                  <tr>
                    {['Zeit', 'Dossier', 'Empfänger', 'Betreff', 'Status', 'Notiz', ''].map((h) => (
                      <th key={h} style={headCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((o) => (
                    <tr key={o.id}>
                      <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{fmtTime(o.sent_at || o.approved_at || o.created_at)}</td>
                      <td style={{ ...cell, ...mono }}>{o.slug}</td>
                      <td style={{ ...cell, ...mono }}>{o.org || ''}<br />{o.to_email}</td>
                      <td style={{ ...cell, maxWidth: '260px' }}>{o.subject}</td>
                      <td style={{ ...cell, ...mono }}>{STATUS_DE[o.status] || o.status}{o.error ? `: ${o.error}` : ''}</td>
                      <td style={{ ...cell, maxWidth: '240px', color: 'var(--ink-2)' }}>{o.reply_note || '—'}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {['sent', 'replied'].includes(o.status) && (
                          <>
                            <input
                              className="auth-text-input"
                              style={{ width: '180px', marginBottom: '4px' }}
                              placeholder="Antwort notieren"
                              value={noteDraft[o.id] ?? ''}
                              onChange={(e) => setNoteDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                            />
                            <button
                              style={btn}
                              disabled={busy || !(noteDraft[o.id] || '').trim()}
                              onClick={async () => {
                                await act({ action: 'mark-replied', id: o.id, note: noteDraft[o.id] });
                                setNoteDraft((prev) => ({ ...prev, [o.id]: '' }));
                              }}
                            >
                              Als beantwortet
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td style={cell} colSpan={7}>Noch kein Verlauf.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
