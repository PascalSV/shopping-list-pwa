export type List = {
    id: string;
    name: string;
};

export type Item = {
    id: string;
    listId: string;
    label: string;
    done: boolean;
    updatedAt: number;
    isDeleted?: boolean;
};

export type Suggestion = {
    label: string;
    displayLabel: string;

export type SyncMutation =
    | { type: "upsert-item"; item: Item }
    | { type: "delete-item"; id: string; updatedAt: number };

export type SyncRequest = {
    since?: number;
    mutations: SyncMutation[];
};

export type SyncResponse = {
    cursor: number;
    lists: List[];
    items: Item[];
    suggestions: Suggestion[];
};

export type Env = {
    DB: D1Database;
    SYNC_SECRET: string;
    "shopping-list-pwa-token-pascal": string;
    "shopping-list-pwa-token-claudia": string;
};
