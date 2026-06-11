'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const j = await r.json();
      if (j.ok) {
        const dest = next.startsWith('/login') || !next.startsWith('/') ? '/' : next;
        router.replace(dest);
        router.refresh();
      } else {
        setErr(j.error || 'Неуспешен вход');
      }
    } catch {
      setErr('Мрежова грешка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">🧯</div>
        <h1 className="login-title">АНТОАН-09</h1>
        <p className="login-sub">Система за сервиз на пожарогасители</p>
        <label className="login-label">
          Потребител
          <input
            className="login-input"
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
          />
        </label>
        <label className="login-label">
          Парола
          <input
            className="login-input"
            type="password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {err && <p className="login-err">{err}</p>}
        <button className="btn btn-fire login-btn" disabled={busy} type="submit">
          {busy ? 'Влизане…' : 'Вход'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
