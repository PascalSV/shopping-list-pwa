# Database Migration: Add Area Field to Items

## Local Development Database

Apply the migration to your local development database:

```bash
npx wrangler d1 execute shopping-list-pwa --local --file=./migrations/0006_item_area.sql
```

## Remote Production Database

Apply the migration to the remote production database:

```bash
npx wrangler d1 execute shopping-list-pwa --remote --file=./migrations/0006_item_area.sql
```

## What Changed

- Added `area` field to the `items` table (TEXT, defaults to empty string)
- Updated TypeScript `Item` type to include optional `area?: string`
- Updated sync mechanism to store and retrieve the area field
- Added "Bereich im Supermarkt" input field to the edit modal
- Users can now specify which supermarket section an item is found in (e.g., "Obst & Gemüse", "Backwaren")

## Testing

After running the migrations:
1. Build and deploy: `npm run build && npx wrangler deploy`
2. Long-press an item to edit it
3. Add a supermarket area (e.g., "Backwaren")
4. Save and verify it syncs correctly
