import { Router } from "itty-router";
import { z } from "zod";
import { Env, Item, Suggestion, SyncRequest, SyncResponse } from "./types";

const router = Router();

const itemSchema = z.object({
    id: z.string().min(1),
    listId: z.string().min(1),
    label: z.string().min(1),
    remark: z.string().optional(),
    area: z.number().int().nonnegative().optional(),
    done: z.boolean(),
    updatedAt: z.number().int().nonnegative(),
    isDeleted: z.boolean().optional(),
});

const listSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    updatedAt: z.number().int().nonnegative().optional(),
    isDeleted: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
});

const mutationSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("upsert-item"), item: itemSchema }),
    z.object({ type: z.literal("delete-item"), id: z.string().min(1), updatedAt: z.number().int().nonnegative() }),
    z.object({ type: z.literal("upsert-list"), list: listSchema }),
    z.object({ type: z.literal("delete-list"), id: z.string().min(1), updatedAt: z.number().int().nonnegative() }),
]);

const syncSchema = z.object({
    since: z.number().int().nonnegative().optional(),
    mutations: z.array(mutationSchema),
});

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
        },
    });

async function listItems(env: Env, since = 0): Promise<Item[]> {
    const result = await env.DB
        .prepare(
            "SELECT id, list_id as listId, label, remark, area, done, updated_at as updatedAt, is_deleted as isDeleted FROM items WHERE updated_at >= ?"
        )
        .bind(since)
        .all<Item>();

    return (result.results ?? []).map((row) => ({
        ...row,
        remark: row.remark ?? "",
        area: row.area ?? 0,
        done: Boolean(row.done),
        isDeleted: Boolean(row.isDeleted),
    }));
}

async function listLists(env: Env, since = 0): Promise<any[]> {
    const result = await env.DB
        .prepare("SELECT id, name, updated_at as updatedAt, is_deleted as isDeleted FROM lists WHERE updated_at >= ?")
        .bind(since)
        .all<any>();

    return (result.results ?? []).map((row) => ({
        ...row,
        isDeleted: Boolean(row.isDeleted),
    }));
}

async function listSuggestions(env: Env): Promise<Suggestion[]> {
    try {
        const result = await env.DB
            .prepare("SELECT label, count FROM articles ORDER BY count DESC, label ASC LIMIT 20")
            .all<any>();
        return (result.results ?? []).map(row => ({
            label: row.label,
            displayLabel: row.label,
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
                "INSERT INTO articles (label, display_label, count) VALUES (?, ?, 1) " +
                "ON CONFLICT(label) DO UPDATE SET count = articles.count + 1, display_label = excluded.display_label"
            )
            .bind(label, displayLabel)
            .run();
    } catch (err) {
        console.warn("incrementSuggestion failed", err);
    }
}

async function applyMutations(env: Env, body: SyncRequest) {
    for (const mutation of body.mutations) {

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
                    "INSERT INTO items (id, list_id, label, remark, area, done, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
                    "ON CONFLICT(id) DO UPDATE SET list_id=excluded.list_id, label=excluded.label, remark=excluded.remark, area=excluded.area, done=excluded.done, updated_at=excluded.updated_at, is_deleted=excluded.is_deleted"
                )
                .bind(
                    item.id,
                    item.listId,
                    item.label,
                    item.remark ?? "",
                    item.area ?? 0,
                    item.done ? 1 : 0,
                    item.updatedAt,
                    item.isDeleted ? 1 : 0
                )
                .run();

            if (isNewItem && !item.isDeleted) {
                await incrementSuggestion(env, item.label.toLowerCase(), item.label);
            }
        }

        if (mutation.type === "delete-item") {
            const current = await env.DB.prepare("SELECT updated_at FROM items WHERE id = ?").bind(mutation.id).first<{ updated_at: number }>();
            if (current && current.updated_at > mutation.updatedAt) continue;

            await env.DB
                .prepare("UPDATE items SET is_deleted = 1, updated_at = ? WHERE id = ?")
                .bind(mutation.updatedAt, mutation.id)
                .run();
        }

        if (mutation.type === "upsert-list") {
            const list = mutation.list;
            const current = await env.DB
                .prepare("SELECT updated_at, is_deleted FROM lists WHERE id = ?")
                .bind(list.id)
                .first<{ updated_at: number; is_deleted: number }>();
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
            const current = await env.DB.prepare("SELECT updated_at FROM lists WHERE id = ?").bind(mutation.id).first<{ updated_at: number }>();
            if (current && current.updated_at > mutation.updatedAt) continue;

            await env.DB
                .prepare("UPDATE lists SET is_deleted = 1, updated_at = ? WHERE id = ?")
                .bind(mutation.updatedAt, mutation.id)
                .run();
        }
    }
}

router.options("/api/*", () =>
    new Response(null, {
        headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type,x-session-token",
        },
    })
);

router.get("/api/health", () => new Response("ok"));

router.get("/api/bootstrap", async (_, env: Env) => {
    const [lists, items, suggestions] = await Promise.all([listLists(env, 0), listItems(env, 0), listSuggestions(env)]);
    const cursor = Date.now();
    const payload: SyncResponse = {
        cursor,
        lists,
        items,
        suggestions
    };
    return json(payload);
});

router.post("/api/sync", async (request: Request, env: Env) => {
    const sessionToken = request.headers.get("x-session-token");

    // Validate session token
    if (!sessionToken) {
        return json({ error: "Missing session token" }, 401);
    }

    const session = await env.DB.prepare(
        "SELECT user, expires_at FROM sessions WHERE token = ?"
    ).bind(sessionToken).first<{ user: string; expires_at: number }>();

    if (!session || session.expires_at < Date.now()) {
        return json({ error: "Invalid or expired session" }, 401);
    }

    const headerUser = session.user;

    let parsed: SyncRequest;
    try {
        const data = await request.json();
        parsed = syncSchema.parse(data);
    } catch (err) {
        return json({ error: "Invalid payload", detail: `${err}` }, 400);
    }

    const cursorBeforeMutations = Date.now();
    await applyMutations(env, parsed);
    const [lists, items, suggestions] = await Promise.all([listLists(env, parsed.since ?? 0), listItems(env, parsed.since ?? 0), listSuggestions(env)]);
    const payload: SyncResponse = {
        cursor: cursorBeforeMutations,
        lists,
        items,
        suggestions
    };
    return json(payload);
});

router.post("/api/login", async (request: Request, env: Env) => {
    try {
        const data = await request.json() as { user: 'Pascal' | 'Claudia'; password: string };

        const secretKey = data.user === 'Claudia'
            ? 'shopping-list-pwa-token-claudia'
            : 'shopping-list-pwa-token-pascal';

        const token = env[secretKey];
        if (!token) return json({ error: "No token configured" }, 500);
        if (data.password === token) {
            // Generate unique session token
            const sessionToken = crypto.randomUUID();
            const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

            // Store session in KV or DB (using DB for now)
            await env.DB.prepare(
                "INSERT OR REPLACE INTO sessions (token, user, expires_at) VALUES (?, ?, ?)"
            ).bind(sessionToken, data.user, expiresAt).run();

            return json({ success: true, token: sessionToken, user: data.user });
        }
        return json({ error: "Invalid password" }, 401);
    } catch (err) {
        return json({ error: "Invalid request" }, 400);
    }
});

router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => router.handle(request, env, ctx),
};
