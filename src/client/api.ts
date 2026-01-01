import { SyncRequest, SyncResponse } from "../types";

const API_BASE = "/api";
const DEV_SYNC_SECRET = "furz";

function resolveSyncSecret(): string | null {
    const stored = localStorage.getItem("sync-secret");
    if (stored) return stored;

    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return DEV_SYNC_SECRET; // convenience for local dev

    return null;
}

export async function fetchBootstrap(): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/bootstrap`);
    if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
    return (await res.json()) as SyncResponse;
}

export async function postSync(body: SyncRequest): Promise<SyncResponse> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const syncSecret = resolveSyncSecret() ?? DEV_SYNC_SECRET;
    if (syncSecret) headers["x-sync-secret"] = syncSecret;

    const res = await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = new Error(`Sync failed: ${res.status}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return (await res.json()) as SyncResponse;
}
