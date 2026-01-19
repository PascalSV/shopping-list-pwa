import { Router, json, error as routerError } from 'itty-router';
import { z } from 'zod';
import type { Env, List, Item, Suggestion, SyncRequest, SyncResponse, SyncMutation } from './types';

const router = Router();

// Validation schemas
const syncSchema = z.object({
    since: z.number().optional(),
    mutations: z.array(z.any())
});

// Helper: Generate UUID
function generateUUID(): string {
    return crypto.randomUUID();
}

// Helper: Generate session token
function generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Database query functions
async function listLists(env: Env, since: number): Promise<List[]> {
    try {
        const result = await env.DB
            .prepare("SELECT id, name, updated_at, is_deleted, is_favorite FROM lists WHERE updated_at >= ? ORDER BY updated_at DESC")
            .bind(since)
            .all<any>();
        return (result.results ?? []).map(row => ({
            id: row.id,
            name: row.name,
            updatedAt: row.updated_at,
            isDeleted: Boolean(row.is_deleted),
            isFavorite: Boolean(row.is_favorite)
        }));
    } catch (err) {
        console.warn("listLists failed", err);
        return [];
    }
}

async function listItems(env: Env, since: number): Promise<Item[]> {
    try {
        const result = await env.DB
            .prepare("SELECT id, list_id, label, remark, done, updated_at, is_deleted FROM items WHERE updated_at >= ? ORDER BY updated_at DESC")
            .bind(since)
            .all<any>();
        return (result.results ?? []).map(row => ({
            id: row.id,
            listId: row.list_id,
            label: row.label,
            remark: row.remark || "",
            done: Boolean(row.done),
            updatedAt: row.updated_at,
            isDeleted: Boolean(row.is_deleted)
        }));
    } catch (err) {
        console.warn("listItems failed", err);
        return [];
    }
}

async function listSuggestions(env: Env): Promise<Suggestion[]> {
    try {
        const result = await env.DB
            .prepare("SELECT label, display_label, count FROM articles ORDER BY count DESC, label ASC LIMIT 50")
            .all<any>();
        return (result.results ?? []).map(row => ({
            label: row.label,
            displayLabel: row.display_label || row.label,
            count: row.count
        }));
    } catch (err) {
        console.warn("listSuggestions failed", err);
        return [];
    }
}

async function incrementSuggestion(env: Env, label: string, displayLabel: string) {
    try {
        await env.DB
            .prepare(
                "INSERT INTO articles (label, display_label, count, updated_at) VALUES (?, ?, 1, ?) " +
                "ON CONFLICT(label) DO UPDATE SET count = articles.count + 1, display_label = excluded.display_label, updated_at = excluded.updated_at"
            )
            .bind(label.toLowerCase(), displayLabel, Date.now())
            .run();
    } catch (err) {
        console.warn("incrementSuggestion failed", err);
    }
}

async function applyMutations(env: Env, mutations: SyncMutation[]) {
    for (const mutation of mutations) {
        if (mutation.type === "upsert-item") {
            const item = mutation.item;
            const current = await env.DB
                .prepare("SELECT updated_at, is_deleted FROM items WHERE id = ?")
                .bind(item.id)
                .first<{ updated_at: number; is_deleted: number }>();

            if (current && current.updated_at > item.updatedAt) continue;
            const isNewItem = !current || Boolean(current.is_deleted);

            await env.DB
                .prepare(
                    "INSERT INTO items (id, list_id, label, remark, done, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?) " +
                    "ON CONFLICT(id) DO UPDATE SET list_id=excluded.list_id, label=excluded.label, remark=excluded.remark, done=excluded.done, updated_at=excluded.updated_at, is_deleted=excluded.is_deleted"
                )
                .bind(
                    item.id,
                    item.listId,
                    item.label,
                    item.remark ?? "",
                    item.done ? 1 : 0,
                    item.updatedAt,
                    item.isDeleted ? 1 : 0
                )
                .run();

            if (isNewItem && !item.isDeleted) {
                await incrementSuggestion(env, item.label, item.label);
            }
        }

        if (mutation.type === "delete-item") {
            const current = await env.DB
                .prepare("SELECT updated_at FROM items WHERE id = ?")
                .bind(mutation.id)
                .first<{ updated_at: number }>();

            if (current && current.updated_at > mutation.updatedAt) continue;

            await env.DB
                .prepare("UPDATE items SET is_deleted = 1, updated_at = ? WHERE id = ?")
                .bind(mutation.updatedAt, mutation.id)
                .run();
        }

        if (mutation.type === "upsert-list") {
            const list = mutation.list;
            const current = await env.DB
                .prepare("SELECT updated_at FROM lists WHERE id = ?")
                .bind(list.id)
                .first<{ updated_at: number }>();

            if (current && current.updated_at > list.updatedAt) continue;

            await env.DB
                .prepare(
                    "INSERT INTO lists (id, name, updated_at, is_deleted, is_favorite) VALUES (?, ?, ?, ?, ?) " +
                    "ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, is_deleted=excluded.is_deleted, is_favorite=excluded.is_favorite"
                )
                .bind(
                    list.id,
                    list.name,
                    list.updatedAt,
                    list.isDeleted ? 1 : 0,
                    list.isFavorite ? 1 : 0
                )
                .run();
        }

        if (mutation.type === "delete-list") {
            const current = await env.DB
                .prepare("SELECT updated_at FROM lists WHERE id = ?")
                .bind(mutation.id)
                .first<{ updated_at: number }>();

            if (current && current.updated_at > mutation.updatedAt) continue;

            await env.DB
                .prepare("UPDATE lists SET is_deleted = 1, updated_at = ? WHERE id = ?")
                .bind(mutation.updatedAt, mutation.id)
                .run();
        }
    }
}

// Routes
router.get("/api/bootstrap", async (_, env: Env) => {
    const [lists, items, suggestions] = await Promise.all([
        listLists(env, 0),
        listItems(env, 0),
        listSuggestions(env)
    ]);

    const payload: SyncResponse = {
        cursor: Date.now(),
        lists: lists.filter(l => !l.isDeleted),
        items: items.filter(i => !i.isDeleted),
        suggestions
    };

    return json(payload);
});

router.post("/api/sync", async (request: Request, env: Env) => {
    let parsed: SyncRequest;
    try {
        const data = await request.json();
        parsed = syncSchema.parse(data);
    } catch (err) {
        return json({ error: "Invalid payload" }, 400);
    }

    const cursorBeforeMutations = Date.now();
    await applyMutations(env, parsed.mutations);

    const [lists, items, suggestions] = await Promise.all([
        listLists(env, parsed.since ?? 0),
        listItems(env, parsed.since ?? 0),
        listSuggestions(env)
    ]);

    const payload: SyncResponse = {
        cursor: cursorBeforeMutations,
        lists,
        items,
        suggestions
    };

    return json(payload);
});

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            // Try to handle with router (API routes)
            const response = await router.fetch(request, env);

            // If router returns 404, let the request pass through to asset handler
            if (response.status === 404) {
                return new Response("Not Found", { status: 404 });
            }

            return response;
        } catch (err) {
            console.error("Worker error:", err);
            return json({ error: "Internal server error" }, 500);
        }
    }
};
