import { TripoApiError, TripoClient } from "./client";
import { config } from "./env";
import { log } from "./log";

if (!config.apiKey) {
  log.error("TRIPO_API_KEY is not set (.env).");
  process.exit(1);
}
if (!config.apiKey.startsWith("tsk_")) {
  log.warn(`TRIPO_API_KEY starts with "${config.apiKey.slice(0, 5)}…" — Tripo secret keys start with "tsk_" (a "tcli_" value is the client ID, not the secret).`);
}
try {
  const client = new TripoClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  const b = await client.getBalance();
  log.ok(`Tripo balance: ${b.balance} credits available · ${b.frozen} frozen (≈ $${(b.balance / 100).toFixed(2)})`);
} catch (e) {
  log.error(e instanceof TripoApiError ? `${e.message}${e.suggestion ? ` — ${e.suggestion}` : ""}` : (e as Error).message);
  process.exitCode = 1;
}
