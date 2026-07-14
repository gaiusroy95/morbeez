import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { agronomistClient, type AgronomistRouteSummary } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

export function RoutePlannerPage() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<AgronomistRouteSummary[]>([]);
  const [routeName, setRouteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRoutes(await agronomistClient.listRoutes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRoute() {
    const name = routeName.trim() || `Route ${new Date().toLocaleDateString()}`;
    setBusy(true);
    setError('');
    try {
      const route = await agronomistClient.createRoute(name);
      setRouteName('');
      navigate(toPath(paths.agronomistRouteDetail.replace(':routeId', route.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create route');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading routes…" />;

  return (
    <div className="visit-wizard-page">
      <div className="visit-wizard-head">
        <div>
          <h1 className="page-title">Route planner</h1>
          <p className="page-subtitle">Plan and optimize field visit routes.</p>
        </div>
        <Link to={toPath(paths.agronomist)}>
          <Btn label="Operations" variant="secondary" />
        </Link>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <section className="visit-panel">
        <label className="visit-label">New route name</label>
        <input
          className="visit-input"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="Morning cluster"
        />
        <Btn label={busy ? 'Creating…' : 'Create route'} onClick={() => void createRoute()} disabled={busy} />
      </section>
      <section className="visit-panel">
        <h3>Today&apos;s routes</h3>
        <ul className="visit-detail-list">
          {routes.map((r) => (
            <li key={r.id}>
              <Link to={toPath(paths.agronomistRouteDetail.replace(':routeId', r.id))}>
                {r.routeName} — {r.stopCount} stops · {r.status}
              </Link>
            </li>
          ))}
          {!routes.length ? <li className="text-sm text-ink-muted">No routes yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
