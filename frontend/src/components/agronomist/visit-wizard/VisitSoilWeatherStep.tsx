import { useEffect, useState } from 'react';
import {
  agronomistClient,
  formatDate,
  type VisitEnvironmentPayload,
} from '@morbeez/shared';
import { Alert, Loading, Panel } from '../../ui';

type Props = {
  farmerId: string;
  blockId: string;
  hideScores?: boolean;
  fetchEnvironment?: typeof agronomistClient.getVisitEnvironment;
};

function WeatherCard({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  const current = weather.current;
  if (!current) {
    return <p className="vw-hint">Weather data unavailable for this block.</p>;
  }
  return (
    <div className="vw-stack" style={{ gap: 4 }}>
      <p className="vw-row-value" style={{ textAlign: 'left' }}>
        Temp: {String(current.temperatureC ?? '—')} °C
      </p>
      <p className="vw-row-value" style={{ textAlign: 'left' }}>
        Humidity: {String(current.humidityPct ?? '—')}%
      </p>
      <p className="vw-row-value" style={{ textAlign: 'left' }}>
        Rain today: {String(current.rainfallMm ?? '—')} mm
      </p>
      {current.locationLabel ? (
        <p className="vw-hint">Location: {String(current.locationLabel)}</p>
      ) : null}
      {Array.isArray(current.diseaseAlerts) && current.diseaseAlerts.length ? (
        <p className="vw-banner vw-banner--warn" style={{ marginTop: 6 }}>
          Alerts: {(current.diseaseAlerts as string[]).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

export function VisitSoilWeatherStep({
  farmerId,
  blockId,
  hideScores = false,
  fetchEnvironment = agronomistClient.getVisitEnvironment,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [env, setEnv] = useState<VisitEnvironmentPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const r = await fetchEnvironment(farmerId, blockId);
        if (!cancelled) setEnv({ soilReport: r.soilReport, weather: r.weather });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load environment data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [farmerId, blockId, fetchEnvironment]);

  if (loading) {
    return (
      <div className="vw-loading-center">
        <Loading label="Loading soil & weather…" />
      </div>
    );
  }

  const macro = env?.soilReport?.metrics.filter((m) => m.group === 'macro') ?? [];
  const micro = env?.soilReport?.metrics.filter((m) => m.group === 'micro') ?? [];

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Panel title="Soil lab panel">
        {env?.soilReport ? (
          <>
            <p className="vw-hint" style={{ marginBottom: 8 }}>
              {env.soilReport.reportedAt ? formatDate(String(env.soilReport.reportedAt)) : '—'}
              {env.soilReport.labName ? ` · ${env.soilReport.labName}` : ''}
              {env.soilReport.soilType ? ` · ${env.soilReport.soilType}` : ''}
            </p>
            <p className="vw-field-label">Macro nutrients</p>
            {macro.map((m) => (
              <div key={m.key} className="vw-row">
                <span className="vw-row-label">{m.label}</span>
                <span className="vw-row-value">
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ''}
                </span>
              </div>
            ))}
            <p className="vw-field-label" style={{ marginTop: 8 }}>
              Micro nutrients
            </p>
            {micro.map((m) => (
              <div key={m.key} className="vw-row">
                <span className="vw-row-label">{m.label}</span>
                <span className="vw-row-value">
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ''}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p className="vw-hint">No soil report on file for this block.</p>
        )}
      </Panel>
      <Panel title="Weather">
        <WeatherCard weather={env?.weather ?? { current: null, forecast: null }} />
        {hideScores ? null : env?.weather.forecast ? (
          <p className="vw-hint" style={{ marginTop: 8 }}>
            Forecast rain: {String(env.weather.forecast.rainfallMmForecast ?? '—')} mm
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
