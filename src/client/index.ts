import type { List, Item, Suggestion, SyncMutation } from '../types';
import { initDB, getLists, getItems, getSuggestions, saveLists, saveItems, saveSuggestions, addPending, getPending, clearPending, getCursor, setCursor, getLastViewedList, setLastViewedList } from './db';
import { postSync, bootstrapAPI } from './api';
import { mount } from './ui';

function uid(): string {
    return crypto.randomUUID();
}

async function enqueueAndPersist(item: Item) {
    const mutation: SyncMutation = { type: "upsert-item", item };
    await addPending(mutation);
    await saveItems([item]);
}

async function enqueueListMutation(list: List) {
    const mutation: SyncMutation = { type: "upsert-list", list };
    await addPending(mutation);
    await saveLists([list]);
}

async function syncNow(updateItems: (items: Item[]) => void, updateSuggestions: (suggestions: Suggestion[]) => void, updateLists: (lists: List[]) => void) {
    const [pending, cursor] = await Promise.all([getPending(), getCursor()]);
    const body = { since: cursor || 0, mutations: pending };

    try {
        const response = await postSync(body);
        await Promise.all([
            saveLists(response.lists),
            saveItems(response.items),
            saveSuggestions(response.suggestions),
            clearPending(),
            setCursor(response.cursor)
        ]);

        const [localLists, localItems, localSuggestions] = await Promise.all([
            getLists(),
            getItems(),
            getSuggestions()
        ]);

        updateLists(localLists.filter(l => !l.isDeleted));
        updateItems(localItems);
        updateSuggestions(localSuggestions);
    } catch (err) {
        console.warn("Sync failed, will retry later", err);
    }
}

async function main() {
    await initDB();

    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
        } catch (err) {
            console.warn('Service Worker registration failed:', err);
        }
    }

    const ui = mount({
        lists: [],
        items: [],
        suggestions: [],
        handlers: {
            onAddItem: async (listId, label) => {
                const now = Date.now();
                const trimmedLabel = label.trim();
                if (!trimmedLabel) return;

                const existingItems = await getItems();
                const duplicate = existingItems.some(
                    i => i.listId === listId && !i.isDeleted && i.label.toLowerCase() === trimmedLabel.toLowerCase()
                );

                if (duplicate) {
                    alert("Item already exists on this list");
                    return;
                }

                const item: Item = {
                    id: uid(),
                    listId,
                    label: trimmedLabel,
                    remark: "",
                    done: false,
                    updatedAt: now
                };

                await enqueueAndPersist(item);
                ui.updateItems(await getItems());
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onToggleItem: async (item) => {
                const updated: Item = { ...item, done: !item.done, updatedAt: Date.now() };
                await enqueueAndPersist(updated);
                ui.updateItems(await getItems());
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onDeleteItem: async (item) => {
                const updated: Item = { ...item, isDeleted: true, updatedAt: Date.now() };
                await enqueueAndPersist(updated);
                ui.updateItems(await getItems());
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onEditItem: async (item, newLabel, newRemark) => {
                const updated: Item = { ...item, label: newLabel, remark: newRemark, updatedAt: Date.now() };
                await enqueueAndPersist(updated);
                ui.updateItems(await getItems());
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onAddList: async (name) => {
                const trimmed = name.trim();
                if (!trimmed) return;

                const list: List = {
                    id: uid(),
                    name: trimmed,
                    updatedAt: Date.now(),
                    isFavorite: false
                };

                await enqueueListMutation(list);
                const allLists = await getLists();
                ui.updateLists(allLists.filter(l => !l.isDeleted));
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onEditList: async (list, newName) => {
                const trimmed = newName.trim();
                if (!trimmed) return;

                const updated: List = { ...list, name: trimmed, updatedAt: Date.now() };
                await enqueueListMutation(updated);
                const allLists = await getLists();
                ui.updateLists(allLists.filter(l => !l.isDeleted));
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onDeleteList: async (list) => {
                if (!confirm(`Delete list "${list.name}"?`)) return;

                const updated: List = { ...list, isDeleted: true, updatedAt: Date.now() };
                await enqueueListMutation(updated);
                const allLists = await getLists();
                ui.updateLists(allLists.filter(l => !l.isDeleted));
                await syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
            },

            onSwitchList: async (listId) => {
                await setLastViewedList(listId);
            }
        }
    });

    if (!ui) {
        console.error("Failed to mount UI");
        return;
    }

    // Bootstrap from server
    try {
        const remote = await bootstrapAPI();
        await Promise.all([
            saveLists(remote.lists),
            saveItems(remote.items),
            saveSuggestions(remote.suggestions),
            setCursor(remote.cursor)
        ]);

        ui.updateLists(remote.lists);
        ui.updateItems(remote.items);
        ui.updateSuggestions(remote.suggestions);
    } catch (err) {
        console.warn("Bootstrap failed, using offline data", err);
        const [lists, items, suggestions] = await Promise.all([getLists(), getItems(), getSuggestions()]);
        ui.updateLists(lists.filter(l => !l.isDeleted));
        ui.updateItems(items);
        ui.updateSuggestions(suggestions);
    }

    // Auto-sync every 5 seconds
    setInterval(() => syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists), 5000);

    // Sync when coming back online
    window.addEventListener('online', () => {
        syncNow(ui.updateItems, ui.updateSuggestions, ui.updateLists);
    });
}

main().catch(console.error);
