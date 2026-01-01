import { SyncRequest, SyncResponse } from "../types";

const API_BASE = "/api";

export async function fetchBootstrap(): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/bootstrap`);
    if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
    return (await res.json()) as SyncResponse;
}

export async function postSync(body: SyncRequest): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return (await res.json()) as SyncResponse;
}
