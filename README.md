# Shopping List PWA

Offline-friendly shopping list PWA backed by a Cloudflare Worker and D1. Ships with multi-list support (Home, Party, IKEA), optimistic UI, and a sync endpoint so devices converge on the same state.

## Features
- **Multi-list support**: Home, Party, and IKEA lists with easy tab switching
- **Smart suggestions**: Autocomplete with frequency-based article suggestions as you type
- **Offline-first**: Full functionality without internet connection, syncs when back online
- **Real-time sync**: Changes sync across all devices with conflict resolution
- **Progressive Web App**: Install on mobile and desktop, works like a native app

## Stack
- Cloudflare Worker (TypeScript, Wrangler) with D1 for storage
- Minimal REST API: `/api/bootstrap` and `/api/sync`
- Client: vanilla TypeScript bundled via esbuild, IndexedDB for offline state, service worker for caching
- Sticky header/footer UI for optimal mobile experience

## Quick start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run locally (builds client then starts Wrangler in local mode):
   ```bash
   npm run dev
   ```
3. Deploy (requires configured D1 and secret):
   ```bash
   npm run deploy
   ```

## Cloudflare setup
- Create a D1 database named `shopping-list-pwa` and update `database_id` in `wrangler.toml`.
- Run migrations locally:
  ```bash
  npx wrangler d1 migrations apply shopping-list-pwa --local
  ```
- Run migrations on production:
  ```bash
  npx wrangler d1 migrations apply shopping-list-pwa --remote
  ```
- Set `SYNC_SECRET` via `wrangler secret put SYNC_SECRET` (or the dashboard) and share it with clients if you want to enforce it.

## API
- `GET /api/bootstrap` → lists + items + suggestions snapshot.
- `POST /api/sync` → payload `{ since, mutations[] }`; returns `{ cursor, lists, items, suggestions }`. Mutations accepted: `upsert-item`, `delete-item`.

## Offline + sync strategy
- Service worker caches shell assets for offline load and serves API requests network-first with cache fallback.
- Client keeps authoritative local state in IndexedDB and queues mutations. On connectivity, queued mutations are flushed to the worker; server responds with any newer changes since the last cursor.
- Article suggestions: D1 tracks how often each article is added (with proper capitalization), returns top 20 by frequency. Client filters and shows top 5 matches as you type.

## UI Features
- Sticky header with list tabs
- Scrollable middle section for items
- Sticky bottom input with inline clear button (×)
- Click suggestions to add them instantly
- Items sorted alphabetically
- Delete items with × button

## Scripts
- `npm run build` – bundle client + service worker.
- `npm run dev` – build then `wrangler dev --local`.
- `npm run deploy` – build and deploy to Cloudflare.

## Notes
- Default lists are seeded via D1 migration (Home, Party, IKEA).
- Items are stored with original capitalization entered by users.
- Article suggestions track lowercase for matching but display with proper capitalization.
- IndexedDB version is 2 - clear browser database if upgrading from version 1.
- Update `compatibility_date` in `wrangler.toml` as needed.
