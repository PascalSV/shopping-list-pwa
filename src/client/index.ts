import { fetchBootstrap, postSync } from "./api";
import { isAuthenticated, showLoginScreen, logout } from "./login";
import {
    addPending,
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
    { id: "home", name: "Home" },
    { id: "party", name: "Party" },
    { id: "ikea", name: "IKEA" },
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
    const mutation: SyncMutation = isDelete
        ? { type: "delete-item", id: item.id, updatedAt: item.updatedAt }
        : { type: "upsert-item", item };
    await addPending(mutation);
}

async function syncNow(updateItems: (items: Item[]) => void, updateSuggestions: (suggestions: Suggestion[]) => void) {
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

    const ui = mountUI(local.lists, local.items, local.suggestions, {
        onAddItem: async (listId, label) => {
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

            const item: Item = { id: uid(), listId, label: trimmedLabel, remark: "", area: 0, done: false, updatedAt: now };
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
        onAddList: async (name: string) => {
            const now = Date.now();
            const newList: List = { id: uid(), name, updatedAt: now, isDeleted: false };
            const mutation: SyncMutation = { type: "upsert-list", list: newList };
            await saveLists([...(await getLists()), newList]);
            await addPending(mutation);
            location.reload(); // Reload to reinitialize UI with new list
        },
        onUpdateList: async (list: List) => {
            const now = Date.now();
            const updated: List = { ...list, updatedAt: now };
            const mutation: SyncMutation = { type: "upsert-list", list: updated };
            const allLists = await getLists();
            const updatedLists = allLists.map(l => l.id === list.id ? updated : l);
            await saveLists(updatedLists);
            await addPending(mutation);
            location.reload(); // Reload to show updated list name
        },
        onDeleteList: async (listId: string) => {
            const now = Date.now();
            const mutation: SyncMutation = { type: "delete-list", id: listId, updatedAt: now };
            const allLists = await getLists();
            const updatedLists = allLists.map(l => l.id === listId ? { ...l, isDeleted: true, updatedAt: now } : l);
            await saveLists(updatedLists);

            // Cascade delete items in this list
            const allItems = await getItems();
            const itemsToDelete = allItems.filter(i => i.listId === listId && !i.isDeleted);
            const updatedItems = itemsToDelete.map(i => ({ ...i, isDeleted: true, updatedAt: now }));
            await saveItems(updatedItems);

            // Add delete mutations for all items in the list
            for (const item of itemsToDelete) {
                const itemMutation: SyncMutation = { type: "delete-item", id: item.id, updatedAt: now };
                await addPending(itemMutation);
            }

            await addPending(mutation);
            location.reload(); // Reload to remove deleted list from UI
        },
    });

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

    // Periodic sync every 15 seconds
    setInterval(() => syncNow(ui.updateItems, ui.updateSuggestions), 15000);
}

main().catch((err) => console.error(err));
