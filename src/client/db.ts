import type { List, Item, Suggestion, SyncMutation, SyncRequest, SyncResponse } from '../types';

const DB_NAME = "shopping-list";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            if (!database.objectStoreNames.contains("lists")) {
                database.createObjectStore("lists", { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains("items")) {
                database.createObjectStore("items", { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains("suggestions")) {
                database.createObjectStore("suggestions", { keyPath: "label" });
            }
            if (!database.objectStoreNames.contains("pending")) {
                const pendingStore = database.createObjectStore("pending", { autoIncrement: true });
                pendingStore.createIndex("timestamp", "timestamp");
            }
            if (!database.objectStoreNames.contains("meta")) {
                database.createObjectStore("meta", { keyPath: "key" });
            }
        };
    });
}

function getStore(storeName: string, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
    if (!db) throw new Error("Database not initialized");
    return db.transaction(storeName, mode).objectStore(storeName);
}

// Lists
export async function getLists(): Promise<List[]> {
    return new Promise((resolve, reject) => {
        const request = getStore("lists").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function saveLists(lists: List[]): Promise<void> {
    const store = getStore("lists", "readwrite");
    for (const list of lists) {
        store.put(list);
    }
}

// Items
export async function getItems(): Promise<Item[]> {
    return new Promise((resolve, reject) => {
        const request = getStore("items").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function saveItems(items: Item[]): Promise<void> {
    const store = getStore("items", "readwrite");
    for (const item of items) {
        store.put(item);
    }
}

// Suggestions
export async function getSuggestions(): Promise<Suggestion[]> {
    return new Promise((resolve, reject) => {
        const request = getStore("suggestions").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function saveSuggestions(suggestions: Suggestion[]): Promise<void> {
    const store = getStore("suggestions", "readwrite");
    store.clear();
    for (const suggestion of suggestions) {
        store.put(suggestion);
    }
}

// Pending mutations
export async function getPending(): Promise<SyncMutation[]> {
    return new Promise((resolve, reject) => {
        const request = getStore("pending").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function addPending(mutation: SyncMutation): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = getStore("pending", "readwrite").add(mutation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function clearPending(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = getStore("pending", "readwrite").clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Cursor (last sync timestamp)
export async function getCursor(): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const request = getStore("meta").get("cursor");
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
    });
}

export async function setCursor(cursor: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = getStore("meta", "readwrite").put({ key: "cursor", value: cursor });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Last viewed list
export async function getLastViewedList(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const request = getStore("meta").get("lastViewedList");
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
    });
}

export async function setLastViewedList(listId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = getStore("meta", "readwrite").put({ key: "lastViewedList", value: listId });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
