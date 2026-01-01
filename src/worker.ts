import { Router } from "itty-router";
import { z } from "zod";
import { Env, Item, List, Suggestion, SyncRequest, SyncResponse } from "./types";

const router = Router();

const itemSchema = z.object({
    id: z.string().min(1),
    listId: z.string().min(1),
    label: z.string().min(1),
    done: z.boolean(),
    updatedAt: z.number().int().nonnegative(),
    isDeleted: z.boolean().optional(),
});

const mutationSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("upsert-item"), item: itemSchema }),
    z.object({ type: z.literal("delete-item"), id: z.string().min(1), updatedAt: z.number().int().nonnegative() }),
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

async function listLists(env: Env): Promise<List[]> {
    const result = await env.DB.prepare("SELECT id, name FROM lists ORDER BY name ASC").all<List>();
    return result.results ?? [];
}

async function listItems(env: Env, since = 0): Promise<Item[]> {
    const result = await env.DB
        .prepare(
            "SELECT id, list_id as listId, label, done, updated_at as updatedAt, is_deleted as isDeleted FROM items WHERE updated_at > ?"
        )
        .bind(since)
        .all<Item>();

    return (result.results ?? []).map((row) => ({ ...row, done: Boolean(row.done), isDeleted: Boolean(row.isDeleted) }));
}

async function listSuggestions(env: Env): Promise<Suggestion[]> {
    try {
        const result = await env.DB
            .prepare("SELECT label, display_label as displayLabel, count FROM articles ORDER BY count DESC, label ASC LIMIT 20")
            .all<Suggestion>();
        return result.results ?? [];
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
                    "INSERT INTO items (id, list_id, label, done, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?) " +
                    "ON CONFLICT(id) DO UPDATE SET list_id=excluded.list_id, label=excluded.label, done=excluded.done, updated_at=excluded.updated_at, is_deleted=excluded.is_deleted"
                )
                .bind(item.id, item.listId, item.label, item.done ? 1 : 0, item.updatedAt, item.isDeleted ? 1 : 0)
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
    }
}

router.options("/api/*", () =>
    new Response(null, {
        headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type,x-sync-secret",
        },
    })
);

router.get("/api/health", () => new Response("ok"));

router.get("/api/bootstrap", async (_, env: Env) => {
    const [lists, items, suggestions] = await Promise.all([listLists(env), listItems(env, 0), listSuggestions(env)]);
    const cursor = Date.now();
    const payload: SyncResponse = { cursor, lists, items, suggestions };
    return json(payload);
});

router.post("/api/sync", async (request: Request, env: Env) => {
    const headerSecret = request.headers.get("x-sync-secret");
    if (env.SYNC_SECRET && env.SYNC_SECRET !== "set-me-in-dashboard" && headerSecret !== env.SYNC_SECRET) {
        return json({ error: "Unauthorized" }, 401);
    }

    let parsed: SyncRequest;
    try {
        const data = await request.json();
        parsed = syncSchema.parse(data);
    } catch (err) {
        return json({ error: "Invalid payload", detail: `${err}` }, 400);
    }

    await applyMutations(env, parsed);
    const cursor = Date.now();
    const [lists, items, suggestions] = await Promise.all([listLists(env), listItems(env, parsed.since ?? 0), listSuggestions(env)]);
    const payload: SyncResponse = { cursor, lists, items, suggestions };
    return json(payload);
});

router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => router.handle(request, env, ctx),
};
