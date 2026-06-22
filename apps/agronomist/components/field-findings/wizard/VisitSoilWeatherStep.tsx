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

function WeatherCard({ weather }: { weather: VisitEnvironmentPayload['weather'] }) {
  const current = weather.current;
  if (!current) {
    return <Text style={styles.muted}>Weather data unavailable for this block.</Text>;
  }
  return (
    <View style={styles.weatherGrid}>
      <Text style={styles.weatherItem}>Temp: {String(current.temperatureC ?? '—')} °C</Text>
      <Text style={styles.weatherItem}>Humidity: {String(current.humidityPct ?? '—')}%</Text>
      <Text style={styles.weatherItem}>Rain today: {String(current.rainfallMm ?? '—')} mm</Text>
      {current.locationLabel ? (
        <Text style={styles.muted}>Location: {String(current.locationLabel)}</Text>
      ) : null}
      {Array.isArray(current.diseaseAlerts) && current.diseaseAlerts.length ? (
        <Text style={styles.alert}>Alerts: {(current.diseaseAlerts as string[]).join(', ')}</Text>
      ) : null}
    </View>
  );
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
        <Panel title="Weather">
          <WeatherCard weather={env?.weather ?? { current: null, forecast: null }} />
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
      <Panel title="Weather">
        <WeatherCard weather={env?.weather ?? { current: null, forecast: null }} />
        {hideScores ? null : env?.weather.forecast ? (
          <Text style={styles.muted}>
            Forecast rain: {String(env.weather.forecast.rainfallMmForecast ?? '—')} mm
          </Text>
        ) : null}
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
});
