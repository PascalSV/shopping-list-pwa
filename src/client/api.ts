import { SyncRequest, SyncResponse } from "../types";

const API_BASE = "/api";

export async function fetchBootstrap(): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/bootstrap`);
    if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
    return (await res.json()) as SyncResponse;
}

export async function postSync(body: SyncRequest): Promise<SyncResponse> {
    const headers: Record<string, string> = { "content-type": "application/json" };

    const sessionToken = localStorage.getItem("session-token");
    if (!sessionToken) {
        throw new Error("No session token found");
    }

    headers["x-session-token"] = sessionToken;

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
