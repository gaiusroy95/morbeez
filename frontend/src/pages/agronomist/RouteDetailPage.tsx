import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { agronomistClient, coordSourceLabel, type AgentRouteSummary } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

function openRouteInMaps(route: AgentRouteSummary) {
  const withCoords = (route.stops ?? []).filter((s) => s.latitude != null && s.longitude != null);
  if (withCoords.length === 0) return false;
  const origin = withCoords[0]!;
  const dest = withCoords[withCoords.length - 1]!;
  const waypoints = withCoords
    .slice(1, -1)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|');
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const [route, setRoute] = useState<AgentRouteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!routeId) return;
    setError('');
    try {
      setRoute(await agronomistClient.getRoute(routeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load route');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function optimize() {
    if (!routeId) return;
    setBusy(true);
    setError('');
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        }).catch(() => null);
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }
      setRoute(await agronomistClient.optimizeRoute(routeId, lat, lng));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimize failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading route…" />;
  if (!route) return <Alert>{error || 'Route not found.'}</Alert>;

  return (
    <div className="visit-wizard-page">
      <div className="visit-wizard-head">
        <div>
          <h1 className="page-title">{route.routeName}</h1>
          <p className="page-subtitle">
            {route.routeDate} · {route.stopCount} stops · {route.pincodeClusters?.length ?? 0} pincode area(s) ·{' '}
            {route.status}
          </p>
        </div>
        <Link to={toPath(paths.agronomistRoutes)}>
          <Btn label="All routes" variant="secondary" />
        </Link>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="visit-wizard-actions">
        <Btn label={busy ? 'Optimizing…' : 'Optimize route'} onClick={() => void optimize()} disabled={busy} />
        <Btn
          label="Open in Maps"
          variant="secondary"
          onClick={() => {
            if (!openRouteInMaps(route)) setError('No GPS coordinates on stops yet.');
          }}
        />
      </div>
      {route.pincodeClusters?.length ? (
        <section className="visit-panel">
          <h3>Pincode clusters</h3>
          <ul className="visit-detail-list">
            {route.pincodeClusters.map((c, i) => (
              <li key={`${c.pincode ?? 'unknown'}-${i}`}>
                {c.pincode ? `PIN ${c.pincode}` : 'Unknown area'} · {c.stopCount} stop(s)
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="visit-panel">
        <h3>Stops</h3>
        <ol className="visit-detail-list">
          {(route.stops ?? []).map((stop) => (
            <li key={stop.id}>
              <strong>{stop.farmerName ?? 'Stop'}</strong>
              {stop.blockName ? ` · ${stop.blockName}` : ''}
              {stop.pincode ? ` · PIN ${stop.pincode}` : ''}
              {stop.coordSource ? ` · ${coordSourceLabel(stop.coordSource)}` : ''}
              {stop.latitude != null ? ` · ${stop.latitude.toFixed(4)}, ${stop.longitude?.toFixed(4)}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
