import { fetchBootstrap, postSync } from "./api";
import { isAuthenticated, showLoginScreen } from "./login";
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
    return { lists: lists.length ? lists : fallbackLists, items, suggestions };
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

            const item: Item = { id: uid(), listId, label: trimmedLabel, remark: "", done: false, updatedAt: now };
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

    const remote = await bootstrapFromRemote();
    if (remote) {
        suggestionState = remote.suggestions;
        ui.updateItems(remote.items);
        ui.updateSuggestions(remote.suggestions);
    }

    setInterval(() => syncNow(ui.updateItems, ui.updateSuggestions), 15000);
}

main().catch((err) => console.error(err));
