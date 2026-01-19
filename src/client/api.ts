import type { SyncRequest, SyncResponse } from '../types';

const API_BASE = location.origin;

export async function postSync(body: SyncRequest): Promise<SyncResponse> {
    const response = await fetch(`${API_BASE}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
    }

    return response.json();
}

export async function bootstrapAPI(): Promise<SyncResponse> {
    const response = await fetch(`${API_BASE}/api/bootstrap`);

    if (!response.ok) {
        throw new Error(`Bootstrap failed: ${response.status}`);
    }

    return response.json();
}
