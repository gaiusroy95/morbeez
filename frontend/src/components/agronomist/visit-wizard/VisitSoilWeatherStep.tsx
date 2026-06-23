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
  soilOnly?: boolean;
  weatherOnly?: boolean;
  fetchEnvironment?: typeof agronomistClient.getVisitEnvironment;
};

function formatWeatherDay(date: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(`${date}T12:00:00+05:30`));
  } catch {
    return date.slice(5);
  }
}

function WeatherPressureChips({
  pressures,
}: {
  pressures: NonNullable<VisitEnvironmentPayload['weather']['pressures']>;
}) {
  const items = [
    pressures.heatStress ? 'Heat stress' : null,
    pressures.waterlogging ? 'Waterlogging risk' : null,
    pressures.fungalPressure ? 'Fungal pressure' : null,
    pressures.pestPressure ? 'Pest pressure' : null,
  ].filter(Boolean) as string[];

  if (!items.length) {
    return <p className="vw-hint">No elevated weather pressure signals in the last 7 days.</p>;
  }

  return (
    <div className="vw-chip-row">
      {items.map((label) => (
        <span key={label} className="vw-chip vw-chip--warn">
          {label}
        </span>
      ))}
    </div>
  );
}

function Last7DaysWeather({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  const current = weather.current;
  const days = weather.last7Days ?? [];
  const totals = weather.totals7d;
  const pressures = weather.pressures;

  if (!current && !days.length) {
    return <p className="vw-hint">Weather data unavailable for this block.</p>;
  }

  return (
    <div className="vw-stack" style={{ gap: 8 }}>
      {current ? (
        <>
          <p className="vw-field-label">Today</p>
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
        </>
      ) : null}

      {totals ? (
        <>
          <p className="vw-field-label" style={{ marginTop: 8 }}>
            Last 7 days summary
          </p>
          <p className="vw-row-value" style={{ textAlign: 'left' }}>
            Total rain: {totals.rainfallMm} mm · Avg max temp: {totals.avgTempC} °C · Avg humidity:{' '}
            {totals.avgHumidityPct}%
          </p>
        </>
      ) : null}

      {days.length ? (
        <>
          <p className="vw-field-label" style={{ marginTop: 8 }}>
            Daily history
          </p>
          <table className="vw-activity-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Temp (max)</th>
                <th>Humidity</th>
                <th>Rain</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{formatWeatherDay(d.date)}</td>
                  <td>{d.temperatureC ?? '—'} °C</td>
                  <td>{d.humidityPct ?? '—'}%</td>
                  <td>{d.rainfallMm ?? '—'} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {pressures ? (
        <>
          <p className="vw-field-label" style={{ marginTop: 8 }}>
            Irrigation trend
          </p>
          <p className="vw-hint">{pressures.irrigationTrend}</p>
          <p className="vw-field-label" style={{ marginTop: 8 }}>
            AI weather pressure
          </p>
          <WeatherPressureChips pressures={pressures} />
        </>
      ) : null}

      {weather.forecast ? (
        <p className="vw-hint" style={{ marginTop: 8 }}>
          7-day rain forecast: {String(weather.forecast.rainfallMmForecast ?? '—')} mm · review heat /
          waterlogging pressure before recommending sprays.
        </p>
      ) : null}
    </div>
  );
}

function WeatherCard({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  return <Last7DaysWeather weather={weather} />;
}

const emptyWeather: VisitEnvironmentPayload['weather'] = {
  current: null,
  forecast: null,
  last7Days: [],
  totals7d: null,
  pressures: null,
};

export function VisitSoilWeatherStep({
  farmerId,
  blockId,
  hideScores = false,
  soilOnly = false,
  weatherOnly = false,
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

  const soilAlerts: string[] = [];
  for (const m of [...macro, ...micro]) {
    const key = m.key.toLowerCase();
    const val = parseFloat(String(m.value));
    if (key.includes('ph') && !Number.isNaN(val) && (val < 5.5 || val > 8)) {
      soilAlerts.push(val < 5.5 ? 'Low pH — nutrient lock risk' : 'High pH — micronutrient lock risk');
    }
    if ((key.includes('ec') || key.includes('salinity')) && !Number.isNaN(val) && val > 1.5) {
      soilAlerts.push('High EC — salt stress risk');
    }
  }

  if (weatherOnly) {
    return (
      <div className="vw-stack">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Panel title="Weather (past 7 days)">
          <WeatherCard weather={env?.weather ?? emptyWeather} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {soilOnly || !weatherOnly ? (
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
        {soilAlerts.length ? (
          <div className="vw-banner vw-banner--warn" style={{ marginTop: 8 }}>
            {soilAlerts.join(' · ')}
          </div>
        ) : null}
      </Panel>
      ) : null}
      {soilOnly ? null : (
      <Panel title="Weather (past 7 days)">
        <WeatherCard weather={env?.weather ?? emptyWeather} />
        {hideScores ? null : null}
      </Panel>
      )}
    </div>
  );
}
