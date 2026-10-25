import { deviceId } from './store';

/** Counts a moment for Insights. Fire and forget; never in the way. */
export function track(name: string, props: Record<string, string | number | boolean> = {}) {
  try {
    const body = JSON.stringify({ name, device: deviceId(), props });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    else fetch('/api/events', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {}
}
