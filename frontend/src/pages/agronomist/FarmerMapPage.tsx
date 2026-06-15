import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

type MapPin = {
  id: string;
  farmerId: string;
  name: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
};

export function FarmerMapPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false });
        }).catch(() => null);
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }
      const farmers = await agronomistClient.listFarmers({ filter: 'nearby', lat, lng, limit: 30 });
      const nextPins: MapPin[] = [];
      await Promise.all(
        farmers.map(async (f) => {
          const blocks = await agronomistClient.getFarmerBlocks(f.id);
          const withGps = blocks.find((b) => b.latitude != null && b.longitude != null);
          if (!withGps?.latitude || !withGps.longitude) return;
          nextPins.push({
            id: withGps.id,
            farmerId: f.id,
            name: f.name,
            latitude: withGps.latitude,
            longitude: withGps.longitude,
            subtitle: [f.district, withGps.cropType].filter(Boolean).join(' · '),
          });
        })
      );
      setPins(nextPins);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading nearby farmers…" />;

  return (
    <div className="visit-wizard-page">
      <div className="visit-wizard-head">
        <div>
          <h1 className="page-title">Farmer map</h1>
          <p className="page-subtitle">Assigned farmers with plot GPS.</p>
        </div>
        <div className="visit-wizard-actions">
          <Btn label="Refresh" variant="secondary" onClick={() => void load()} />
          <Link to={toPath(paths.agronomist)}>
            <Btn label="Operations" variant="secondary" />
          </Link>
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <section className="visit-panel">
        <ul className="visit-detail-list">
          {pins.map((pin) => (
            <li key={pin.id}>
              <strong>{pin.name}</strong>
              {pin.subtitle ? <span className="muted"> — {pin.subtitle}</span> : null}
              <div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Maps
                </a>
              </div>
            </li>
          ))}
          {!pins.length ? <li className="muted">No farmers with plot GPS nearby.</li> : null}
        </ul>
      </section>
    </div>
  );
}
