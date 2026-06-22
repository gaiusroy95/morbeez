import { sensorIngestService } from '../services/intelligence/sensor-ingest.service.js';

type MqttMessage = {
  blockId: string;
  farmerId: string;
  sensorType: string;
  value: number;
  unit?: string;
};

function parseMqttPayload(topic: string, payload: Buffer): MqttMessage | null {
  try {
    const json = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    const blockId = String(json.blockId ?? '');
    const farmerId = String(json.farmerId ?? '');
    const sensorType = String(json.sensorType ?? topic.split('/').pop() ?? 'sensor');
    const value = Number(json.value);
    if (!blockId || !farmerId || Number.isNaN(value)) return null;
    return { blockId, farmerId, sensorType, value, unit: json.unit ? String(json.unit) : undefined };
  } catch {
    return null;
  }
}

/** Optional MQTT consumer — set MQTT_BROKER_URL to enable. */
export async function startSensorMqttConsumer(): Promise<void> {
  const brokerUrl = process.env.MQTT_BROKER_URL?.trim();
  if (!brokerUrl || process.env.IOT_SENSOR_MQTT_ENABLED !== 'true') return;

  try {
    const mqtt = await import('mqtt');
    const client = mqtt.connect(brokerUrl, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    });

    client.on('connect', () => {
      client.subscribe('morbeez/sensors/#', (err: Error | null) => {
        if (err) console.error('[mqtt] subscribe failed', err.message);
      });
    });

    client.on('message', (...args: unknown[]) => {
      const topic = String(args[0] ?? '');
      const payload = args[1] as Buffer;
      const msg = parseMqttPayload(topic, payload);
      if (!msg) return;
      void sensorIngestService.ingest(msg).catch((e: unknown) => {
        console.error('[mqtt] ingest failed', e instanceof Error ? e.message : e);
      });
    });

    client.on('error', (...args: unknown[]) => {
      const err = args[0];
      console.error('[mqtt] error', err instanceof Error ? err.message : err);
    });
  } catch (e) {
    console.warn('[mqtt] mqtt package not installed or broker unreachable — HTTP webhook only');
  }
}
