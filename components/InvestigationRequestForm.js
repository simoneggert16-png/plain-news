'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmt } from '@/lib/i18n.mjs';
import { INVESTIGATION_QUOTAS, REQUEST_LIMITS } from '@/lib/investigations.mjs';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const initialForm = { topic: '', why: '', region: '', hints: '' };

const STATUS_LABELS = {
  de: { new: 'eingegangen', selected: 'in Recherche', declined: 'abgelehnt', archived: 'archiviert' },
  en: { new: 'received', selected: 'in research', declined: 'declined', archived: 'archived' },
};

export default function InvestigationRequestForm({ locale, t }) {
  const [session, setSession] = useState(null);
  const [quota, setQuota] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (err) {
      setError(err.message);
      return undefined;
    }

    const load = async (current) => {
      setSession(current);
      if (!current) {
        setQuota(null);
        setRequests([]);
        return;
      }
      try {
        const res = await fetch('/api/investigations/requests', {
          headers: { Authorization: `Bearer ${current.access_token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'load failed');
        setQuota(data.quota);
        setRequests(data.requests || []);
      } catch (err) {
        setError(err.message);
      }
    };

    supabase.auth.getSession().then(({ data }) => load(data?.session || null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => load(next));
    return () => data?.subscription?.unsubscribe();
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/investigations/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request failed');
      setForm(initialForm);
      setNotice(t.sent);
      setQuota(data.quota);
      setRequests((prev) => [data.request, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const depleted = quota && (quota.siteLeft <= 0 || quota.mineLeft <= 0);
  const labels = STATUS_LABELS[locale] || STATUS_LABELS.en;

  return (
    <section className="inv-wishes" id="wish">
      <h2 className="lr-item-title" style={{ marginTop: 0 }}>{t.wishesTitle}</h2>
      <p className="lr-intro" style={{ marginTop: 0 }}>{t.wishesIntro}</p>

      {!session && (
        <p className="inv-how-note">
          <Link href={`/${locale}/register`} className="inv-link">{t.signIn}</Link>
        </p>
      )}

      {session && quota && (
        <p className="inv-how-note">
          {fmt(t.quotaSite, { left: quota.siteLeft, max: INVESTIGATION_QUOTAS.wishesPerWeek })}
          {' · '}
          {fmt(t.quotaMine, { left: quota.mineLeft })}
        </p>
      )}

      {session && depleted && <p className="inv-how-note inv-how-note-hot">{t.emptyQuota}</p>}

      {session && !depleted && (
        <form onSubmit={submit} className="auth-form-body">
          <div className="auth-field">
            <label className="label" htmlFor="inv-topic">{t.topic}*</label>
            <input
              id="inv-topic"
              className="auth-text-input"
              required
              minLength={8}
              maxLength={REQUEST_LIMITS.topic}
              value={form.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder={locale === 'de' ? 'z. B. Vergabe der Rüstungsaufträge des Bundes' : 'e.g. how the federal government awards defence contracts'}
            />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="inv-why">{t.why}</label>
            <textarea
              id="inv-why"
              className="auth-text-input"
              rows={4}
              maxLength={REQUEST_LIMITS.why}
              value={form.why}
              onChange={(e) => update('why', e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="inv-region">{t.region}</label>
            <input
              id="inv-region"
              className="auth-text-input"
              maxLength={REQUEST_LIMITS.region}
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="inv-hints">{t.hints}</label>
            <textarea
              id="inv-hints"
              className="auth-text-input"
              rows={3}
              maxLength={REQUEST_LIMITS.hints}
              value={form.hints}
              onChange={(e) => update('hints', e.target.value)}
            />
          </div>
          <button type="submit" className="auth-btn-action primary" disabled={busy || form.topic.trim().length < 8}>
            {busy ? '…' : t.submit}
          </button>
        </form>
      )}

      {notice && <p className="inv-how-note inv-how-note-ok">{notice}</p>}
      {error && <p className="inv-how-note inv-how-note-hot">{error}</p>}

      {requests.length > 0 && (
        <div className="inv-my-requests">
          <span className="label">{locale === 'de' ? 'Deine Wünsche' : 'Your wishes'}</span>
          <ul>
            {requests.map((r) => (
              <li key={r.id}>
                <span>{r.topic}</span>
                <span className="inv-status">{labels[r.status] || r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
