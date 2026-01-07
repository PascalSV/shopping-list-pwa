import { Item, List, Suggestion, SyncMutation } from "../types";

const DB_NAME = "shopping-list";
const DB_VERSION = 3;
const STORE_LISTS = "lists";
const STORE_ITEMS = "items";
const STORE_PENDING = "pending";
const STORE_META = "meta";
const STORE_SUGGESTIONS = "suggestions";

type MetaKey = "cursor";

type UpgradeHandler = (db: IDBDatabase) => void;

function openDatabase(upgrade?: UpgradeHandler): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_LISTS)) db.createObjectStore(STORE_LISTS, { keyPath: "id" });
            if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS, { keyPath: "id" });
            if (!db.objectStoreNames.contains(STORE_PENDING)) db.createObjectStore(STORE_PENDING, { autoIncrement: true });
            if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
            if (!db.objectStoreNames.contains(STORE_SUGGESTIONS)) db.createObjectStore(STORE_SUGGESTIONS, { keyPath: "label" });
            upgrade?.(db);
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
}

function transaction<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    return openDatabase().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(stores, mode);
                fn(tx)
                    .then(resolve)
                    .catch((err) => {
                        tx.abort();
                        reject(err);
                    });
                tx.oncomplete = () => db.close();
                tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
            })
    );
}

export async function saveLists(lists: List[]) {
    await transaction([STORE_LISTS], "readwrite", async (tx) => {
        const store = tx.objectStore(STORE_LISTS);
        for (const list of lists) store.put(list);
    });
}

export async function saveItems(items: Item[]) {
    await transaction([STORE_ITEMS], "readwrite", async (tx) => {
        const store = tx.objectStore(STORE_ITEMS);
        for (const item of items) store.put(item);
    });
}

export async function getLists(): Promise<List[]> {
    return transaction([STORE_LISTS], "readonly", async (tx) => {
        const store = tx.objectStore(STORE_LISTS);
        return await requestAll<List>(store.getAll());
    });
}

export async function getItems(): Promise<Item[]> {
    return transaction([STORE_ITEMS], "readonly", async (tx) => {
        const store = tx.objectStore(STORE_ITEMS);
        return await requestAll<Item>(store.getAll());
    });
}

export async function saveSuggestions(suggestions: { label: string; count: number }[]) {
    await transaction([STORE_SUGGESTIONS], "readwrite", async (tx) => {
        const store = tx.objectStore(STORE_SUGGESTIONS);
        store.clear();
        for (const suggestion of suggestions) store.put(suggestion);
    });
}

export async function getSuggestions(): Promise<Suggestion[]> {
    return transaction([STORE_SUGGESTIONS], "readonly", async (tx) => {
        const store = tx.objectStore(STORE_SUGGESTIONS);
        return await requestAll(store.getAll());
    }).catch(() => []);
}

export async function addPending(mutation: SyncMutation) {
    await transaction([STORE_PENDING], "readwrite", async (tx) => {
        tx.objectStore(STORE_PENDING).add(mutation);
    });
}

export async function getPending(): Promise<SyncMutation[]> {
    return transaction([STORE_PENDING], "readonly", async (tx) => {
        const store = tx.objectStore(STORE_PENDING);
        return await requestAll<SyncMutation>(store.getAll());
    });
}

export async function clearPending() {
    await transaction([STORE_PENDING], "readwrite", async (tx) => {
        tx.objectStore(STORE_PENDING).clear();
    });
}

export async function getCursor(): Promise<number> {
    return transaction([STORE_META], "readonly", async (tx) => {
        const store = tx.objectStore(STORE_META);
        const value = await requestAll<number | undefined>(store.get("cursor" as MetaKey));
        if (Array.isArray(value)) return 0;
        return (value as number) || 0;
    }).catch(() => 0);
}

export async function setCursor(cursor: number) {
    await transaction([STORE_META], "readwrite", async (tx) => {
        tx.objectStore(STORE_META).put(cursor, "cursor");
    });
}

async function requestAll<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("Request failed"));
    });
}
