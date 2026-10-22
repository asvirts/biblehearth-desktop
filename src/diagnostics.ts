import * as Sentry from "@sentry/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
export const reportingConfigured = Boolean(
  import.meta.env.VITE_SENTRY_DSN &&
  import.meta.env.VITE_SENTRY_ACCOUNT === "personal",
);
let enabled = false;
let configuration: Promise<void> = Promise.resolve();
export function sanitizedEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Allowlist event fields: no original message, stack, URL, breadcrumbs or context leaves the app.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: "error",
    platform: "javascript",
    release: __APP_VERSION__,
    environment: import.meta.env.MODE,
    message: "BibleHearth frontend error",
    tags: { component: "frontend" },
  };
}
export function configureDiagnostics(consent: boolean): Promise<void> {
  // Serialize changes so an asynchronous close cannot race with renewed consent.
  configuration = configuration
    .catch(() => {})
    .then(async () => {
      const next = consent && reportingConfigured;
      if (next && !enabled)
        Sentry.init({
          dsn: import.meta.env.VITE_SENTRY_DSN,
          release: __APP_VERSION__,
          sendDefaultPii: false,
          defaultIntegrations: false,
          integrations: [Sentry.globalHandlersIntegration()],
          beforeSend: sanitizedEvent,
          tracesSampleRate: 0,
        });
      if (!next && enabled) await Sentry.close(1000);
      enabled = next;
      if (isTauri()) await invoke("set_crash_reporting", { enabled: next });
    });
  return configuration;
}
