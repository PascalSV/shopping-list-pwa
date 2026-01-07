import { fetchBootstrap, postSync } from "./api";
import { isAuthenticated, showLoginScreen, logout } from "./login";
import {
    addPending,
    clearLists,
    clearPending,
    getCursor,
    getItems,
    getPending,
    getSuggestions,
    saveItems,
    saveSuggestions,
    setCursor,
} from "./db";
import { mountUI } from "./ui";
import { Item, List, Suggestion, SyncMutation, SyncRequest } from "../types";

const fallbackLists: List[] = [
    { id: "shopping-list", name: "Shopping List", updatedAt: 0, isDeleted: false },
];

let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock enabled');
    } catch (err) {
        console.warn('Wake Lock error:', err);
    }
}

async function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        try {
            await navigator.serviceWorker.register("/sw.js");
        } catch (err) {
            console.warn("Service worker registration failed", err);
        }
    }
}

function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function hydrateFromLocal() {
    // Clear any old cached lists from previous multi-list version
    await clearLists();

    const [items, suggestions] = await Promise.all([getItems(), getSuggestions()]);
    return { lists: fallbackLists, items, suggestions };
}

async function bootstrapFromRemote() {
    try {
        const data = await fetchBootstrap();
        // Clear old lists and only keep the single default shopping list
        await clearLists();
        await Promise.all([saveItems(data.items), saveSuggestions(data.suggestions), setCursor(data.cursor)]);
        return { lists: fallbackLists, items: data.items, suggestions: data.suggestions };
    } catch (err) {
        console.warn("Bootstrap failed, staying offline", err);
        return null;
    }
}

async function enqueueAndPersist(item: Item, isDelete = false) {
    await saveItems([item]);
    // Sanitize item: convert null/undefined area to 99 (unassigned)
    const sanitizedItem = { ...item, area: item.area ?? 99 };
    const mutation: SyncMutation = isDelete
        ? { type: "delete-item", id: item.id, updatedAt: item.updatedAt }
        : { type: "upsert-item", item: sanitizedItem };
    await addPending(mutation);
}

async function syncNow(updateItems: (items: Item[]) => void, updateSuggestions: (suggestions: Suggestion[]) => void) {
    const [pending, cursor] = await Promise.all([getPending(), getCursor()]);
    const body: SyncRequest = { since: cursor || 0, mutations: pending };
    try {
        const response = await postSync(body);
        await Promise.all([
            saveItems(response.items),
            saveSuggestions(response.suggestions),
            clearPending(),
            setCursor(response.cursor),
        ]);
        const localItems = await getItems();
        const localSuggestions = await getSuggestions();

        updateItems(localItems);
        updateSuggestions(localSuggestions);
    } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 401) {
            logout();
            return;
        }
        console.warn("Sync failed, will retry later", err);
    }
}

async function main() {
    if (!isAuthenticated()) {
        await showLoginScreen();
    }

    // Update greeting with logged-in user name
    const authUser = localStorage.getItem('auth-user') || 'Pascal';
    const greetingEl = document.querySelector<HTMLHeadingElement>('#greeting');
    const addMessage = document.querySelector<HTMLDivElement>('#add-message');
    let addMessageTimeout: number | undefined;

    const showAddMessage = (text: string) => {
        if (!addMessage) return;
        addMessage.textContent = text;
        addMessage.classList.add('visible');
        if (addMessageTimeout) window.clearTimeout(addMessageTimeout);
        addMessageTimeout = window.setTimeout(() => addMessage.classList.remove('visible'), 2000);
    };
    if (greetingEl) {
        greetingEl.textContent = `Hi, ${authUser}`;
    }

    await registerServiceWorker();
    await requestWakeLock();

    const local = await hydrateFromLocal();
    let suggestionState: Suggestion[] = local.suggestions;

    const ui = mountUI(local.items, suggestionState, {
        onAddItem: async (listId, label) => {
            if (!ui) return;
            const now = Date.now();
            const trimmedLabel = label.trim();
            const existingItems = await getItems();
            const alreadyThere = existingItems.some(
                (i) => i.listId === listId && !i.isDeleted && i.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
            );
            if (alreadyThere) {
                showAddMessage('Der Artikel ist bereits auf der Liste');
                return;
            }

            const item: Item = { id: uid(), listId, label: trimmedLabel, remark: "", area: 99, done: false, updatedAt: now };
            await enqueueAndPersist(item);
            ui.updateItems(await getItems());

            const normalizedLabel = trimmedLabel.toLowerCase();
            const existingSuggestion = suggestionState.find((s) => s.label === normalizedLabel);
            if (existingSuggestion) {
                existingSuggestion.count += 1;
                existingSuggestion.displayLabel = trimmedLabel;
            } else {
                suggestionState.push({ label: normalizedLabel, displayLabel: trimmedLabel, count: 1 });
            }
            await saveSuggestions(suggestionState);
            ui.updateSuggestions([...suggestionState]);

            await syncNow(ui.updateItems, ui.updateSuggestions);
        },
        onDeleteItem: async (item) => {
            const updated: Item = { ...item, isDeleted: true, updatedAt: Date.now() };
            await enqueueAndPersist(updated, true);
            ui.updateItems(await getItems());
            await syncNow(ui.updateItems, ui.updateSuggestions);
        },
        onUpdateItem: async (item) => {
            const updated: Item = { ...item, updatedAt: Date.now() };
            await enqueueAndPersist(updated);
            ui.updateItems(await getItems());
            await syncNow(ui.updateItems, ui.updateSuggestions);
        },
    });

    if (!ui) {
        console.error("Failed to mount UI - missing DOM elements");
        return;
    }

    const remote = await bootstrapFromRemote();
    if (remote) {
        suggestionState = remote.suggestions;
        ui.updateItems(remote.items);
        ui.updateSuggestions(remote.suggestions);
    }

    // Sync when coming back online
    window.addEventListener('online', () => {
        console.log('Back online, syncing now...');
        syncNow(ui.updateItems, ui.updateSuggestions);
    });

    // Periodic sync every 7.5 seconds
    setInterval(() => syncNow(ui.updateItems, ui.updateSuggestions), 7500);
}

main().catch((err) => console.error(err));
