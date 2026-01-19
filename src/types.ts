export type List = {
    id: string;
    name: string;
    updatedAt: number;
    isDeleted?: boolean;
    isFavorite?: boolean;
};

export type Item = {
    id: string;
    listId: string;
    label: string;
    remark?: string;
    done: boolean;
    updatedAt: number;
    isDeleted?: boolean;
};

export type Suggestion = {
    label: string;
    displayLabel: string;
    count: number;
};

export type SyncMutation =
    | { type: "upsert-item"; item: Item }
    | { type: "delete-item"; id: string; updatedAt: number }
    | { type: "upsert-list"; list: List }
    | { type: "delete-list"; id: string; updatedAt: number };

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
    ASSETS: Fetcher;
};
