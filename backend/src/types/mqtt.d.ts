declare module 'mqtt' {
  import type { MqttClient } from 'mqtt';
  export function connect(url: string, opts?: Record<string, unknown>): MqttClient;
  export type MqttClient = {
    on(event: string, cb: (...args: unknown[]) => void): void;
    subscribe(topic: string, cb?: (err: Error | null) => void): void;
  };
}
