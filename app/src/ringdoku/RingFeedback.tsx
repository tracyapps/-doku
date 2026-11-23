import { useEffect, useState, type FormEvent } from 'react';
import { KeyboardTextarea } from '../mobile';
import { readSaved, save } from '../game/session';
import { playtestingRequest, proofOfWork } from '../testing/feedback-client';

const draftKey = 'doku.ringdoku.feedback.v1';
type Admission = { ticket: string; round: string; readyAt: number };
async function getAdmission(): Promise<Admission> {
  const [{ ticket }, { round }] = await Promise.all([
    playtestingRequest<{ ticket: string }>('/ticket'),
    playtestingRequest<{ round: string }>('/config'),
  ]);
  return { ticket, round, readyAt: Date.now() + 4100 };
}

export function RingFeedback({ preview }: { preview: boolean }) {
  const [notes, setNotes] = useState(() => readSaved(draftKey, ''));
  const [consent, setConsent] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const Field = preview ? KeyboardTextarea : 'textarea';
  useEffect(() => {
    let active = true;
    getAdmission().then(value => { if (active) setAdmission(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !notes.trim() || !consent) return;
    setSending(true);
    setStatus('Sending feedback…');
    try {
      const check = admission ?? await getAdmission();
      setAdmission(check);
      const work = await proofOfWork(check.ticket);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, check.readyAt - Date.now())));
      await playtestingRequest('/responses', {
        round: check.round, ticket: check.ticket, work,
        kind: 'game', model: 'trinity4', sample: '', name: '',
        notes, ratings: {}, publicConsent: true,
      });
      if (readSaved(draftKey, '') === notes) save(draftKey, '');
      setStatus('Thanks! Your Ringdoku feedback was sent.');
      setSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feedback could not be sent. Please try again.';
      if (message.includes('expired')) setAdmission(null);
      setStatus(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="ring-feedback" onSubmit={send}>
      {sent ? <p role="status">{status}</p> : (
        <>
          <label className="setting-stack">
            What worked, what got confusing, or what would you change?
            <Field value={notes} rows={5} maxLength={10000} required disabled={sending}
              onChange={event => {
                setNotes(event.target.value);
                save(draftKey, event.target.value);
              }} />
          </label>
          <label className="ring-feedback-consent">
            <input type="checkbox" checked={consent} disabled={sending} required
              onChange={event => setConsent(event.target.checked)} />
            My comment may appear on the public Ringdoku feedback page.
          </label>
          <button className="primary wide" disabled={sending || !notes.trim() || !consent}>Send feedback</button>
          {status && <p role="status">{status}</p>}
        </>
      )}
    </form>
  );
}
