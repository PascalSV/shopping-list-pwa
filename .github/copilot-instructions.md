# Shopping List PWA - Project Instructions

## Project Overview
A multi-device shopping list Progressive Web App with offline support, built with TypeScript and Cloudflare Workers.

## Tech Stack
- Frontend: TypeScript, IndexedDB, Service Workers
- Backend: Cloudflare Workers, D1 Database
- Build: esbuild
- Routing: itty-router
- Validation: Zod

## Key Features Implemented
- ✅ Multiple lists (Home, Party, IKEA)
- ✅ Item suggestions based on usage history
- ✅ Full CRUD for lists and items
- ✅ Multi-device synchronization with mutation-based sync
- ✅ Service worker for offline functionality
- ✅ iOS PWA optimization
- ✅ Dark/Light mode support

## Sync Architecture
The app uses a mutation-based sync mechanism:
- Local-first: Changes applied to IndexedDB immediately
- Mutation queue: Changes queued as mutations
- Periodic sync: Every 5 seconds, mutations sent to server
- Conflict resolution: Last-write-wins using timestamps
- Cursor tracking: Client tracks last sync time

## Next Steps
1. Create D1 database: `wrangler d1 create shopping-list-pwa`
2. Update `wrangler.toml` with database_id
3. Run migrations: `npm run migrate:local` or `npm run migrate:remote`
4. Start dev server: `npm run dev`
5. Deploy: `npm run deploy`

## Development Commands
- `npm run build` - Build client and service worker
- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run migrate:local` - Run database migrations locally
- `npm run migrate:remote` - Run database migrations in production

