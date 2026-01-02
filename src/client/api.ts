import { SyncRequest, SyncResponse } from "../types";

const API_BASE = "/api";

export async function fetchBootstrap(): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/bootstrap`);
    if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
    return (await res.json()) as SyncResponse;
}

export async function postSync(body: SyncRequest): Promise<SyncResponse> {
    const headers: Record<string, string> = { "content-type": "application/json" };

    // Get logged-in user and their token
    const authUser = localStorage.getItem("auth-user") || "Pascal";
    const userTokenKey = `shopping-list-pwa-token-${authUser.toLowerCase()}`;
    const token = localStorage.getItem(userTokenKey);

    if (token) {
        headers["x-sync-secret"] = token;
        headers["x-sync-user"] = authUser;
    }

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
