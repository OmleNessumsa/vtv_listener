# VTV_POST Listener (Vercel)

Een minimalistische, production-ready **listener/bridge** voor jouw Figma plugin **VTV_POST**.
- **Publish endpoint** (`POST /api/publish`): n8n post hier `title` & `message` na generatie.
- **Polling endpoint** (`GET /api/last?fileKey=...&since=...`): jouw Figma plugin pollt hier elke paar seconden op nieuwe events.
- **KV opslag**: gebruikt **Vercel KV** (Upstash Redis) om laatste event per `fileKey` op te slaan.
- **HMAC beveiliging (optioneel)**: verifieert `signature` van de payload met je `SHARED_SECRET`.

> Dit ontwerp is **serverless-vriendelijk** en werkt probleemloos op Vercel zonder dedicated WebSocket infra.
> Wil je WebSockets/SSE, voeg dan Ably/Pusher of Upstash Pub/Sub toe; dit repo is de eenvoudige en robuuste basis.

## Snelstart

1. **Maak een KV store** in Vercel (Project → Storage → KV). Kopieer de env vars.
2. **Env**: maak `.env` met hieronder genoemde variabelen (of gebruik Vercel Project Settings → Environment Variables).
3. **Deploy** naar Vercel (link je Git repo en druk op Deploy).

### Vereiste ENV variabelen

Maak `.env` (lokaal) of stel via Vercel in:

```bash
KV_REST_API_URL=...           # van Vercel KV
KV_REST_API_TOKEN=...         # van Vercel KV
# Optioneel beveiliging voor /api/publish
SHARED_SECRET=supergeheim123  # eigen sterk geheim
# Optioneel JWT-ish inkomend token (basic gating) dat clients moeten meesturen
PUBLISH_BEARER_TOKEN=         # leeg laten = geen bearer check
```

> Gebruik **een sterke `SHARED_SECRET`** en bewaar die alleen in n8n en de listener.

## Endpoints

### `POST /api/publish`

- **Body (JSON)**:
  ```json
  {
    "fileKey": "g3csnsTVDzCxVhpRy8c1Pp",
    "title": "Boerenkool!",
    "message": "Wordt zoeter na vorst. Oogst tot lente!",
    "nonce": "uuid-v4-of-timestamp",
    "signature": "base64(hmac_sha256(body_without_signature, SHARED_SECRET))"
  }
  ```
- **Headers**:
  - Optioneel: `Authorization: Bearer <PUBLISH_BEARER_TOKEN>`
  - `Content-Type: application/json`
- **Resultaat**: `{ ok: true, version: <number>, at: <iso> }`

### `GET /api/last?fileKey=...&since=...`

- **Query**:
  - `fileKey` (required)
  - `since` (optional) — unix millis of iso; filtert “alleen als nieuwer dan”
- **Resultaat**:
  ```json
  {
    "ok": true,
    "event": {
      "fileKey": "...",
      "title": "...",
      "message": "...",
      "version": 7,
      "ts": 1734345678123,
      "at": "2025-10-16T09:23:45.678Z"
    }
  }
  ```
  Of `{ ok: true, event: null }` als er niks nieuws is.

### `GET /api/health`

Gezondheidscheck.

## Figma plugin (polling) snippet

In je plugin `code.js` (luister-modus), voeg een poller toe:

```js
const FILE_KEY = "g3csnsTVDzCxVhpRy8c1Pp";
const BASE_URL = "https://<your-vercel-project>.vercel.app"; // vervang
let lastVersion = 0;

async function pollLoop() {
  try {
    const res = await fetch(`${BASE_URL}/api/last?fileKey=${FILE_KEY}&since=${Date.now()-60000}`);
    if (res.ok) {
      const data = await res.json();
      const ev = data.event;
      if (ev && ev.version > lastVersion) {
        lastVersion = ev.version;
        await applyTitleMessage(ev.title, ev.message);
      }
    }
  } catch (e) {
    // optional: backoff/loggen
  } finally {
    setTimeout(pollLoop, 3000); // elke 3s
  }
}
pollLoop();
```

`applyTitleMessage` is je bestaande logic: `loadFontAsync` → `getNodeById("48:67")` & `("48:69")` → `characters = ...`.

## n8n voorbeeld (HTTP Request node → /api/publish)

Gebruik **RAW** mode (JSON) en zet correct `signature`. Voorbeeld payload zie `examples/n8n-http-node-body.json`. HMAC voorbeeldcode staat in `src/lib/sign.js`.

## Projectstructuur

```
.
├─ api/
│  ├─ health.js
│  ├─ last.js
│  └─ publish.js
├─ src/
│  └─ lib/
│     ├─ kv.js
│     └─ sign.js
├─ examples/
│  ├─ n8n-http-node-body.json
│  └─ figma-plugin-snippet.js
├─ .env.example
├─ package.json
├─ vercel.json
└─ README.md
```

## Beveiliging

- `PUBLISH_BEARER_TOKEN`: simpele header gate (optioneel).
- `SHARED_SECRET`: HMAC van de **hele JSON zonder het signature-veld**. Voorkomt spoofing en replays (in combi met `nonce` + TTL).
- `KV` keys zijn namespaced per fileKey.

## Data model (KV)

- `file:{fileKey}:last` → JSON met laatste event `{title, message, version, ts, at}`
- `file:{fileKey}:nonce:{nonce}` → set met TTL (bijv. 10 min) om replays te weren.

Veel plezier! PR’s welkom.

