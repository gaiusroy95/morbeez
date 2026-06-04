import { useEffect, useState } from 'react';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Countdown to `endsAt` ISO string; updates every second. */
export function useFlashCountdown(endsAt: string | null, enabled: boolean): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!enabled || !endsAt) {
      setLabel('');
      return;
    }
    const tick = () => {
      const end = new Date(endsAt).getTime();
      setLabel(formatCountdown(end - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, enabled]);

  return label;
}
