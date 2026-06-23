import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, formatDate, tokens, type VisitEnvironmentPayload } from '@morbeez/shared';
import { AlertBox, Panel } from '@morbeez/ui-native';

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

function WeatherPressureChips({ pressures }: { pressures: NonNullable<VisitEnvironmentPayload['weather']['pressures']> }) {
  const items = [
    pressures.heatStress ? 'Heat stress' : null,
    pressures.waterlogging ? 'Waterlogging risk' : null,
    pressures.fungalPressure ? 'Fungal pressure' : null,
    pressures.pestPressure ? 'Pest pressure' : null,
  ].filter(Boolean) as string[];

  if (!items.length) {
    return <Text style={styles.muted}>No elevated weather pressure signals in the last 7 days.</Text>;
  }

  return (
    <View style={styles.chipRow}>
      {items.map((label) => (
        <View key={label} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Last7DaysWeather({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  const current = weather.current;
  const days = weather.last7Days ?? [];
  const totals = weather.totals7d;
  const pressures = weather.pressures;

  if (!current && !days.length) {
    return <Text style={styles.muted}>Weather data unavailable for this block.</Text>;
  }

  return (
    <View style={styles.weatherGrid}>
      {current ? (
        <>
          <Text style={styles.sectionLabel}>Today</Text>
          <Text style={styles.weatherItem}>Temp: {String(current.temperatureC ?? '—')} °C</Text>
          <Text style={styles.weatherItem}>Humidity: {String(current.humidityPct ?? '—')}%</Text>
          <Text style={styles.weatherItem}>Rain today: {String(current.rainfallMm ?? '—')} mm</Text>
          {current.locationLabel ? (
            <Text style={styles.muted}>Location: {String(current.locationLabel)}</Text>
          ) : null}
          {Array.isArray(current.diseaseAlerts) && current.diseaseAlerts.length ? (
            <Text style={styles.alert}>Alerts: {(current.diseaseAlerts as string[]).join(', ')}</Text>
          ) : null}
        </>
      ) : null}

      {totals ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>Last 7 days summary</Text>
          <Text style={styles.weatherItem}>Total rain: {totals.rainfallMm} mm</Text>
          <Text style={styles.weatherItem}>Avg max temp: {totals.avgTempC} °C</Text>
          <Text style={styles.weatherItem}>Avg humidity: {totals.avgHumidityPct}%</Text>
        </>
      ) : null}

      {days.length ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>Daily history</Text>
          {days.map((d) => (
            <View key={d.date} style={styles.dayRow}>
              <Text style={styles.dayDate}>{formatWeatherDay(d.date)}</Text>
              <Text style={styles.dayValues}>
                {d.temperatureC ?? '—'}°C · {d.humidityPct ?? '—'}% · {d.rainfallMm ?? '—'} mm
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {pressures ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>Irrigation trend</Text>
          <Text style={styles.muted}>{pressures.irrigationTrend}</Text>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>AI weather pressure</Text>
          <WeatherPressureChips pressures={pressures} />
        </>
      ) : null}

      {weather.forecast ? (
        <Text style={[styles.muted, styles.sectionGap]}>
          7-day rain forecast: {String(weather.forecast.rainfallMmForecast ?? '—')} mm · review spray timing
          before recommending.
        </Text>
      ) : null}
    </View>
  );
}

function WeatherCard({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  return <Last7DaysWeather weather={weather} />;
}

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
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.muted}>Loading soil & weather…</Text>
      </View>
    );
  }

  const macro = env?.soilReport?.metrics.filter((m) => m.group === 'macro') ?? [];
  const micro = env?.soilReport?.metrics.filter((m) => m.group === 'micro') ?? [];

  if (weatherOnly) {
    return (
      <View style={styles.root}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <Panel title="Weather (past 7 days)">
          <WeatherCard weather={env?.weather ?? { current: null, forecast: null, last7Days: [], totals7d: null, pressures: null }} />
        </Panel>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {soilOnly || !weatherOnly ? (
      <Panel title="Soil lab panel">
        {env?.soilReport ? (
          <>
            <Text style={styles.meta}>
              {env.soilReport.reportedAt
                ? formatDate(String(env.soilReport.reportedAt))
                : '—'}
              {env.soilReport.labName ? ` · ${env.soilReport.labName}` : ''}
              {env.soilReport.soilType ? ` · ${env.soilReport.soilType}` : ''}
            </Text>
            <Text style={styles.sectionLabel}>Macro nutrients</Text>
            {macro.map((m) => (
              <View key={m.key} style={styles.row}>
                <Text style={styles.label}>{m.label}</Text>
                <Text style={styles.value}>
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ''}
                </Text>
              </View>
            ))}
            <Text style={styles.sectionLabel}>Micro nutrients</Text>
            {micro.map((m) => (
              <View key={m.key} style={styles.row}>
                <Text style={styles.label}>{m.label}</Text>
                <Text style={styles.value}>
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ''}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>No soil report on file for this block.</Text>
        )}
      </Panel>
      ) : null}
      {soilOnly ? null : (
      <Panel title="Weather (past 7 days)">
        <WeatherCard weather={env?.weather ?? { current: null, forecast: null, last7Days: [], totals7d: null, pressures: null }} />
      </Panel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: tokens.text, marginTop: 8, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  label: { fontSize: 13, color: tokens.textMuted, flex: 1 },
  value: { fontSize: 13, fontWeight: '600', color: tokens.text, textAlign: 'right', flex: 1 },
  muted: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  alert: { fontSize: 13, color: tokens.warning, marginTop: 6 },
  weatherGrid: { gap: 4 },
  weatherItem: { fontSize: 14, color: tokens.text },
  sectionGap: { marginTop: 10 },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  dayDate: { fontSize: 12, color: tokens.textMuted, flex: 1 },
  dayValues: { fontSize: 12, fontWeight: '600', color: tokens.text, flex: 1.4, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#fff7ed',
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: tokens.warning,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: tokens.warning },
});
