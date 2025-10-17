# VTV_POST Listener — Supabase variant

Gebruik deze variant als je **Upstash Redis niet wilt/kan gebruiken**. We slaan de "laatste event per fileKey"
gewoon op in **Supabase Postgres**. Werkt prima op Vercel en heeft een gratis tier.

## 1) Supabase aanmaken
- Maak een Supabase project aan en kopieer:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side key; bewaar veilig)
- Zet deze als Environment Variables in je Vercel project.

## 2) Database schema
Voer deze SQL uit in Supabase SQL editor:

```sql
-- Tabel met laatste event per fileKey
create table if not exists public.vtv_last (
  file_key text primary key,
  title text not null,
  message text not null,
  version integer not null default 0,
  ts bigint not null,
  at text not null
);

-- Nonce tabel voor replay-bescherming
create table if not exists public.vtv_nonce (
  file_key text not null,
  nonce text not null,
  created_at timestamptz not null default now(),
  constraint vtv_nonce_pk primary key (file_key, nonce)
);
```

> Let op: we verhogen `version` in applicatielaag (select → +1 → upsert). Voor deze use-case met lage schrijffrequentie
is dat voldoende. Als je 100% atomisch wil, kan ik een Postgres functie met `insert ... on conflict ... do update set version = vtv_last.version + 1 returning version` voor je schrijven.

## 3) Deploy naar Vercel
- Voeg deze repo/patch toe aan je project, commit & push.
- `vercel.json` staat al op v2 met Node 20.
- Test: `GET /api/health` (eventueel kun je de health endpoint zelf toevoegen) en:
  - `POST /api/publish` met body `{"fileKey":"...","title":"...","message":"...","nonce":"..."}`
  - `GET /api/last?fileKey=...`

## 4) Beveiliging (optioneel, aanbevolen)
- `PUBLISH_BEARER_TOKEN` → vereis `Authorization: Bearer ...` header
- `SHARED_SECRET` → HMAC signature check (zie README van de KV-variant; code staat hier ook in `src/lib/sign.js`)
- QStash signing keys (`QSTASH_*`) kun je toevoegen als je via QStash laat deliveren en hun signature wilt valideren.

## 5) Figma plugin
Ongewijzigd: plugin pollt `/api/last` en past title/message toe op de node IDs.
