# Shopping List PWA

A multi-device shopping list Progressive Web App with offline support, built with TypeScript and Cloudflare Workers.

## Features

- 📱 **Multi-device sync** - Changes sync automatically across all your devices
- 🔄 **Offline support** - Works without internet connection using service workers
- 📝 **Multiple lists** - Manage different lists (Home, Party, IKEA, etc.)
- 💡 **Smart suggestions** - Auto-suggest items based on your history
- ✏️ **Full CRUD** - Create, edit, and delete lists and items
- 🎨 **Dark/Light mode** - Automatically adapts to system preferences
- 📱 **iOS optimized** - Safe areas and PWA installation support

## Tech Stack

- **Frontend**: TypeScript, IndexedDB, Service Workers
- **Backend**: Cloudflare Workers, D1 Database
- **Build**: esbuild
- **Routing**: itty-router
- **Validation**: Zod

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create D1 database

```bash
wrangler d1 create shopping-list-pwa
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "shopping-list-pwa"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Run migrations

```bash
npm run migrate:local  # For local development
npm run migrate:remote # For production
```

### 4. Build the project

```bash
npm run build
```

## Development

Start the development server:

```bash
npm run dev
```

This will start Wrangler in development mode with hot reload.

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Project Structure

```
.
├── public/              # Static assets
│   ├── index.html      # Main HTML file
│   ├── styles.css      # Application styles
│   ├── manifest.json   # PWA manifest
│   └── assets/         # Built JavaScript bundles
├── src/
│   ├── worker.ts       # Cloudflare Worker (backend)
│   ├── types.ts        # Shared TypeScript types
│   └── client/
│       ├── index.ts    # Main client entry point
│       ├── ui.ts       # UI rendering logic
│       ├── db.ts       # IndexedDB wrapper
│       ├── api.ts      # Backend API calls
│       └── sw.ts       # Service Worker
├── migrations/         # D1 database migrations
└── wrangler.toml      # Cloudflare configuration
```

## How It Works

### Sync Architecture

The app uses a **mutation-based sync mechanism** to handle multi-device synchronization:

1. **Local-first**: All changes are applied locally first to IndexedDB
2. **Mutation queue**: Changes are queued as mutations (upsert/delete operations)
3. **Periodic sync**: Every 5 seconds, pending mutations are sent to the server
4. **Conflict resolution**: Server uses timestamps to resolve conflicts (last-write-wins)
5. **Cursor tracking**: Client tracks last sync time to fetch only new data

### Offline Support

- **Service Worker** caches all static assets for offline use
- **IndexedDB** stores all data locally
- **Optimistic updates** make the UI responsive regardless of network state
- **Auto-retry** failed syncs are retried when connection is restored

## Scripts

- `npm run build` - Build client and service worker
- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run migrate:local` - Run database migrations locally
- `npm run migrate:remote` - Run database migrations in production

## Database Schema

### lists
- `id` - Unique identifier
- `name` - List name
- `updated_at` - Last update timestamp
- `is_deleted` - Soft delete flag
- `is_favorite` - Favorite flag

### items
- `id` - Unique identifier
- `list_id` - Foreign key to lists
- `label` - Item name
- `remark` - Optional notes
- `done` - Completion status
- `updated_at` - Last update timestamp
- `is_deleted` - Soft delete flag

### articles (suggestions)
- `label` - Normalized item name (lowercase, unique key)
- `display_label` - Display name with proper capitalization
- `count` - Usage count
- `updated_at` - Last update timestamp

## License

MIT
