import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/LogoMark';
import { getRoleHomePath } from '../lib/role-home';
import { paths, toPath } from '../lib/routes';
import { Alert, Btn, Field, Input } from '../components/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  const from = (location.state as { from?: string } | null)?.from;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await login(email, password);
      await refresh();
      const home = getRoleHomePath(session.admin?.role);
      navigate(from && from !== toPath(paths.dashboard) ? from : home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-white/10 bg-surface-elevated p-8 shadow-[var(--shadow-elevated)] sm:p-10">
        <div className="mb-8 flex items-center gap-4">
          <LogoMark />
          <div>
            <div className="text-xl font-extrabold tracking-tight text-brand-900">Morbeez</div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              Agriculture
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-ink">Staff sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Operations console for products, orders & farmer intelligence. Sign in with the personal
          password you set when you joined.
        </p>

        {error ? (
          <div className="mt-5">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <p className="text-right text-sm">
            <Link
              to={toPath(paths.forgotPassword)}
              className="font-semibold text-brand-700 hover:underline"
            >
              Forgot password?
            </Link>
          </p>
          <Btn type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
