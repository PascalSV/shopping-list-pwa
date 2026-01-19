import type { List, Item, Suggestion } from '../types';

const i18n = {
    addList: "+ Liste",
    newListName: "Name der neuen Liste:",
    noItems: "Noch keine Artikel. Fügen Sie einen unten hinzu!",
    deleteItem: "Löschen",
    cancel: "Abbrechen",
    save: "Speichern",
};

export type Handlers = {
    onAddItem: (listId: string, label: string) => void;
    onToggleItem: (item: Item) => void;
    onDeleteItem: (item: Item) => void;
    onEditItem: (item: Item, label: string, remark: string) => void;
    onAddList: (name: string) => void;
    onDeleteList: (list: List) => void;
    onSwitchList: (listId: string) => void;
};

export function mount(config: {
    lists: List[];
    items: Item[];
    suggestions: Suggestion[];
    handlers: Handlers;
}) {
    const listTabsEl = document.querySelector<HTMLDivElement>("#list-tabs");
    const listTitleEl = document.querySelector<HTMLHeadingElement>("#list-title");
    const itemsEl = document.querySelector<HTMLUListElement>("#items");
    const suggestionsEl = document.querySelector<HTMLDivElement>("#suggestions");
    const inputEl = document.querySelector<HTMLInputElement>("#item-input");
    const cancelBtnEl = document.querySelector<HTMLButtonElement>("#cancel-btn");
    const modalOverlayEl = document.querySelector<HTMLDivElement>("#modal-overlay");
    const modalEl = document.querySelector<HTMLDivElement>("#modal");
    const modalLabelEl = document.querySelector<HTMLInputElement>("#modal-label");
    const modalRemarkEl = document.querySelector<HTMLTextAreaElement>("#modal-remark");
    const modalSaveEl = document.querySelector<HTMLButtonElement>("#modal-save");
    const modalDeleteEl = document.querySelector<HTMLButtonElement>("#modal-delete");
    const modalCancelEl = document.querySelector<HTMLButtonElement>("#modal-cancel");
    const modalCloseEl = document.querySelector<HTMLButtonElement>(".modal-close");

    if (!listTabsEl || !listTitleEl || !itemsEl || !suggestionsEl || !inputEl || !cancelBtnEl || !modalOverlayEl) {
        return null;
    }

    let lists = [...config.lists];
    let items = [...config.items];
    let suggestions = [...config.suggestions];
    let currentListId = lists[0]?.id || "";
    let editingItem: Item | null = null;
    let longPressTimer: number | undefined;

    const { handlers } = config;

    function showModal(item: Item) {
        editingItem = item;
        if (modalLabelEl) modalLabelEl.value = item.label;
        if (modalRemarkEl) modalRemarkEl.value = item.remark || "";
        if (modalOverlayEl) modalOverlayEl.classList.remove("hidden");
        if (modalEl) modalEl.classList.remove("hidden");
        if (modalLabelEl) modalLabelEl.focus();
    }

    function hideModal() {
        editingItem = null;
        if (modalOverlayEl) modalOverlayEl.classList.add("hidden");
        if (modalEl) modalEl.classList.add("hidden");
    }

    function renderLists() {
        listTabsEl.innerHTML = "";

        for (const list of lists) {
            const tab = document.createElement("button");
            tab.className = "tab";
            if (list.id === currentListId) {
                tab.classList.add("active");
            }
            tab.textContent = list.name;
            tab.onclick = () => {
                currentListId = list.id;
                handlers.onSwitchList(list.id);
                renderLists();
                renderItems();
            };

            // Right click to delete
            tab.oncontextmenu = (e) => {
                e.preventDefault();
                handlers.onDeleteList(list);
            };

            listTabsEl.appendChild(tab);
        }

        // Add list button
        const addBtn = document.createElement("button");
        addBtn.className = "tab-add";
        addBtn.textContent = i18n.addList;
        addBtn.onclick = () => {
            const name = prompt(i18n.newListName);
            if (name) {
                handlers.onAddList(name);
            }
        };
        listTabsEl.appendChild(addBtn);

        const currentList = lists.find(l => l.id === currentListId);
        listTitleEl.textContent = currentList?.name || "List";
    }

    function renderItems() {
        itemsEl.innerHTML = "";

        // Show message if no lists
        if (lists.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.innerHTML = `<p>Erstelle deine erste Liste!</p>`;
            itemsEl.appendChild(empty);
            return;
        }

        const currentItems = items.filter(
            i => i.listId === currentListId && !i.isDeleted
        ).sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return b.updatedAt - a.updatedAt;
        });

        if (currentItems.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.innerHTML = `<p>${i18n.noItems}</p>`;
            itemsEl.appendChild(empty);
            return;
        }

        for (const item of currentItems) {
            const li = document.createElement("li");
            li.className = "item";
            if (item.done) li.classList.add("done");

            // Checkbox
            const checkbox = document.createElement("div");
            checkbox.className = "item-checkbox";
            if (item.done) checkbox.classList.add("checked");
            checkbox.onclick = (e) => {
                e.stopPropagation();
                handlers.onToggleItem(item);
            };

            // Content
            const content = document.createElement("div");
            content.className = "item-content";

            const label = document.createElement("div");
            label.className = "item-label";
            label.textContent = item.label;
            content.appendChild(label);

            if (item.remark) {
                const remark = document.createElement("div");
                remark.className = "item-remark";
                remark.textContent = item.remark;
                content.appendChild(remark);
            }

            li.appendChild(checkbox);
            li.appendChild(content);

            // Long press handling
            let touchStartTime = 0;
            let touchX = 0;
            let touchY = 0;

            li.addEventListener("touchstart", (e) => {
                touchStartTime = Date.now();
                const touch = e.touches[0];
                touchX = touch.clientX;
                touchY = touch.clientY;

                longPressTimer = window.setTimeout(() => {
                    if (Math.abs(e.touches[0].clientX - touchX) < 10 &&
                        Math.abs(e.touches[0].clientY - touchY) < 10) {
                        e.preventDefault();
                        showModal(item);
                    }
                }, 500);
            });

            li.addEventListener("touchend", () => {
                if (longPressTimer) clearTimeout(longPressTimer);
            });

            li.addEventListener("touchmove", () => {
                if (longPressTimer) clearTimeout(longPressTimer);
            });

            // Single click to toggle
            li.addEventListener("click", (e) => {
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 500) {
                    handlers.onToggleItem(item);
                }
            });

            // Double click to edit on desktop
            li.addEventListener("dblclick", (e) => {
                e.preventDefault();
                showModal(item);
            });

            itemsEl.appendChild(li);
        }
    }

    function renderSuggestions(query: string) {
        suggestionsEl.innerHTML = "";
        const normalized = query.trim().toLowerCase();
        if (!normalized) return;

        const itemsOnList = items
            .filter(i => i.listId === currentListId && !i.isDeleted)
            .map(i => i.label.toLowerCase());

        const matches = suggestions
            .filter(s => {
                const suggestionLabel = s.displayLabel.toLowerCase();
                return suggestionLabel.includes(normalized);
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        for (const suggestion of matches) {
            const btn = document.createElement("button");
            btn.className = "suggestion";
            btn.textContent = suggestion.displayLabel;
            btn.onclick = () => {
                const suggestionKey = suggestion.label.toLowerCase();
                if (itemsOnList.includes(suggestionKey)) {
                    showError("Artikel bereits auf der Liste!");
                } else {
                    handlers.onAddItem(currentListId, suggestion.displayLabel);
                    inputEl.value = "";
                    inputEl.blur();
                    renderSuggestions("");
                }
            };
            suggestionsEl.appendChild(btn);
        }
    }

    function showError(message: string) {
        suggestionsEl.innerHTML = "";
        const error = document.createElement("div");
        error.className = "suggestion-error";
        error.textContent = message;
        suggestionsEl.appendChild(error);

        setTimeout(() => {
            suggestionsEl.innerHTML = "";
        }, 3000);
    }

    // Event listeners
    inputEl.addEventListener("input", () => {
        renderSuggestions(inputEl.value);
    });

    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && inputEl.value.trim()) {
            handlers.onAddItem(currentListId, inputEl.value.trim());
            inputEl.value = "";
            renderSuggestions("");
        }
    });

    cancelBtnEl.addEventListener("click", () => {
        inputEl.value = "";
        renderSuggestions("");
        inputEl.blur();
    });

    // Modal event listeners
    if (modalSaveEl) {
        modalSaveEl.addEventListener("click", () => {
            if (editingItem && modalLabelEl && modalRemarkEl) {
                const newLabel = modalLabelEl.value.trim();
                if (newLabel) {
                    handlers.onEditItem(editingItem, newLabel, modalRemarkEl.value.trim());
                    hideModal();
                }
            }
        });
    }

    if (modalDeleteEl) {
        modalDeleteEl.addEventListener("click", () => {
            if (editingItem && confirm(`${i18n.deleteItem} "${editingItem.label}"?`)) {
                handlers.onDeleteItem(editingItem);
                hideModal();
            }
        });
    }

    if (modalCancelEl) {
        modalCancelEl.addEventListener("click", hideModal);
    }

    if (modalCloseEl) {
        modalCloseEl.addEventListener("click", hideModal);
    }

    // Initial render
    renderLists();
    renderItems();

    return {
        updateLists(newLists: List[]) {
            lists = [...newLists];
            if (!lists.some(l => l.id === currentListId)) {
                currentListId = lists[0]?.id || "";
            }
            renderLists();
            renderItems();
        },
        updateItems(newItems: Item[]) {
            items = [...newItems];
            renderItems();
        },
        updateSuggestions(newSuggestions: Suggestion[]) {
            suggestions = [...newSuggestions];
            renderSuggestions(inputEl.value);
        }
    };
}
