'use client';

export function LogoutButton() {
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* без значение — пренасочваме така или иначе */
    }
    window.location.href = '/login';
  }
  return (
    <button className="nav-link" onClick={logout} title="Изход от системата" type="button">
      🚪 Изход
    </button>
  );
}
