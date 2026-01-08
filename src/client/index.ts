import { fetchBootstrap, postSync } from "./api";
import { isAuthenticated, showLoginScreen, logout } from "./login";
import {
    addPending,
    clearLists,
    clearPending,
    getCursor,
    getItems,
    getLists,
    getPending,
    getSuggestions,
    saveItems,
    saveLists,
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
    const [lists, items, suggestions] = await Promise.all([getLists(), getItems(), getSuggestions()]);
    const activeLists = lists.filter(l => !l.isDeleted);
    return { lists: activeLists.length ? activeLists : fallbackLists, items, suggestions };
}

async function bootstrapFromRemote() {
    try {
        const data = await fetchBootstrap();
        await Promise.all([saveLists(data.lists), saveItems(data.items), saveSuggestions(data.suggestions), setCursor(data.cursor)]);
        return { lists: data.lists, items: data.items, suggestions: data.suggestions };
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

async function enqueueListMutation(list: List, isDelete = false) {
    await saveLists([list]);
    const mutation: SyncMutation = isDelete
        ? { type: "delete-list", id: list.id, updatedAt: list.updatedAt ?? Date.now() }
        : { type: "upsert-list", list };
    await addPending(mutation);
}

async function syncNow(updateItems: (items: Item[]) => void, updateSuggestions: (suggestions: Suggestion[]) => void, updateLists?: (lists: List[]) => void) {
    const [pending, cursor] = await Promise.all([getPending(), getCursor()]);
    const body: SyncRequest = { since: cursor || 0, mutations: pending };
    try {
        const response = await postSync(body);
        await Promise.all([
            saveLists(response.lists),
            saveItems(response.items),
            saveSuggestions(response.suggestions),
            clearPending(),
            setCursor(response.cursor),
        ]);
        const localItems = await getItems();
        const localLists = await getLists();
        const localSuggestions = await getSuggestions();

        updateItems(localItems);
        if (updateLists) updateLists(localLists.filter(l => !l.isDeleted));
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

    const ui = mountUI(local.lists, local.items, suggestionState, {
        onAddItem: async (listId, label) => {
            if (!ui) return false;
            const now = Date.now();
            const trimmedLabel = label.trim();
            const existingItems = await getItems();
            const alreadyThere = existingItems.some(
                (i) => i.listId === listId && !i.isDeleted && i.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
            );
            if (alreadyThere) {
                showAddMessage('Der Artikel ist bereits auf der Liste');
                // Clear input field on duplicate
                const input = document.querySelector<HTMLInputElement>('#item-input');
                if (input) input.value = '';
                return false;
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

            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            return true;
        },
        onDeleteItem: async (item) => {
            const updated: Item = { ...item, isDeleted: true, updatedAt: Date.now() };
            await enqueueAndPersist(updated, true);
            ui.updateItems(await getItems());
            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
        },
        onUpdateItem: async (item) => {
            const updated: Item = { ...item, updatedAt: Date.now() };
            await enqueueAndPersist(updated);
            ui.updateItems(await getItems());
            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
        },
        onAddList: async (name: string) => {
            const now = Date.now();
            const newList: List = { id: uid(), name, updatedAt: now, isDeleted: false };
            await enqueueListMutation(newList);
            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            location.reload();
        },
        onUpdateList: async (list: List) => {
            const now = Date.now();
            const updated: List = { ...list, updatedAt: now };
            await enqueueListMutation(updated);
            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            location.reload();
        },
        onDeleteList: async (listId: string) => {
            const now = Date.now();
            const lists = await getLists();
            const list = lists.find(l => l.id === listId);
            if (list) {
                const updated: List = { ...list, isDeleted: true, updatedAt: now };
                await enqueueListMutation(updated, true);
            }
            await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            location.reload();
        },
    });

    if (!ui) {
        console.error("Failed to mount UI - missing DOM elements");
        return;
    }

    const remote = await bootstrapFromRemote();
    if (remote) {
        suggestionState = remote.suggestions;
        ui.updateLists(remote.lists.filter(l => !l.isDeleted));
        ui.updateItems(remote.items);
        ui.updateSuggestions(remote.suggestions);
    }

    // Sync when coming back online
    window.addEventListener('online', () => {
        console.log('Back online, syncing now...');
        syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
    });

    // Periodic sync every 7.5 seconds
    setInterval(() => syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists), 7500);
}

main().catch((err) => console.error(err));
