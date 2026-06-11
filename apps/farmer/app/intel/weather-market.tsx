import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { fetchMarketIntel, fetchWeatherIntel, tokens } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

export default function WeatherMarketScreen() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<Awaited<ReturnType<typeof fetchWeatherIntel>> | null>(null);
  const [market, setMarket] = useState<Awaited<ReturnType<typeof fetchMarketIntel>> | null>(null);

  useEffect(() => {
    void Promise.all([fetchWeatherIntel(), fetchMarketIntel()])
      .then(([w, m]) => {
        setWeather(w);
        setMarket(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load intelligence'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading weather & market…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {weather ? (
        <Panel title="Weather">
          {weather.locationLabel ? <Text style={styles.sub}>{weather.locationLabel}</Text> : null}
          <KeyValueRow label="Rainfall today" value={weather.rainfallMm != null ? `${weather.rainfallMm} mm` : '—'} />
          <KeyValueRow label="Forecast rain" value={weather.rainfallForecastMm != null ? `${weather.rainfallForecastMm} mm` : '—'} />
          <KeyValueRow label="Humidity" value={weather.humidityPct != null ? `${weather.humidityPct}%` : '—'} />
          <KeyValueRow label="Temperature" value={weather.temperatureC != null ? `${weather.temperatureC}°C` : '—'} />
          <KeyValueRow label="Disease risk" value={weather.diseaseRiskScore != null ? String(weather.diseaseRiskScore) : '—'} />
          {weather.summary ? <Text style={styles.body}>{weather.summary}</Text> : null}
        </Panel>
      ) : null}
      {market ? (
        <Panel title="Market prices">
          <Text style={styles.sub}>{market.crop} · {market.date}</Text>
          {market.rows.map((r, index) => (
            <KeyValueRow
              key={`${r.marketName}-${index}`}
              label={r.marketName}
              value={`₹${r.pricePerKg}/kg${r.trend ? ` (${r.trend})` : ''}`}
            />
          ))}
          {market.summary ? <Text style={styles.body}>{market.summary}</Text> : null}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  sub: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
  body: { fontSize: 14, color: tokens.text, marginTop: 8, lineHeight: 20 },
});
