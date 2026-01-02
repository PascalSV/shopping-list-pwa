import { Item, List, Suggestion } from "../types";

export type UIHandlers = {
    onAddItem(listId: string, label: string): Promise<void>;
    onDeleteItem(item: Item): Promise<void>;
    onUpdateItem(item: Item): Promise<void>;
    onAddList(name: string): Promise<void>;
    onUpdateList(list: List): Promise<void>;
    onDeleteList(listId: string): Promise<void>;
};

export function mountUI(lists: List[], items: Item[], suggestions: Suggestion[], handlers: UIHandlers) {
    const tabs = document.querySelector<HTMLDivElement>('#list-tabs');
    const listTitle = document.querySelector<HTMLHeadingElement>('#list-title');
    const input = document.querySelector<HTMLInputElement>('#item-input');
    const cancelBtn = document.querySelector<HTMLButtonElement>('#cancel-input');
    const addMessage = document.querySelector<HTMLDivElement>('#add-message');
    const itemsContainer = document.querySelector<HTMLUListElement>('#items');
    const suggestionsContainer = document.querySelector<HTMLDivElement>('#suggestions');

    if (!tabs || !input || !cancelBtn || !itemsContainer || !listTitle || !suggestionsContainer) return;

    let currentList = lists[0]?.id ?? "home";
    let localSuggestions = [...suggestions];

    const openAddListModal = () => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal";

        const title = document.createElement("h3");
        title.textContent = "Neue Liste erstellen";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "modal-input";
        input.placeholder = "Listenname";

        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button ghost";
        cancel.textContent = "Abbrechen";
        cancel.onclick = () => overlay.remove();

        const save = document.createElement("button");
        save.type = "button";
        save.className = "button primary";
        save.textContent = "Erstellen";
        save.onclick = async () => {
            const name = input.value.trim();
            if (!name) return;
            overlay.remove();
            await handlers.onAddList(name);
        };

        actions.append(cancel, save);
        modal.append(title, input, actions);
        overlay.append(modal);
        document.body.appendChild(overlay);
        input.focus();
    };

    const openEditListModal = (list: List) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal";

        const title = document.createElement("h3");
        title.textContent = "Liste bearbeiten";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "modal-input";
        input.value = list.name;

        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "button delete-btn";
        deleteBtn.textContent = "Löschen";
        deleteBtn.onclick = async () => {
            const confirmOverlay = document.createElement("div");
            confirmOverlay.className = "modal-overlay";

            const confirmModal = document.createElement("div");
            confirmModal.className = "modal";

            const confirmTitle = document.createElement("h3");
            confirmTitle.textContent = "Liste wirklich löschen?";

            const confirmMessage = document.createElement("p");
            confirmMessage.textContent = `"${list.name}" wird dauerhaft gelöscht.`;
            confirmMessage.style.margin = "12px 0 24px";
            confirmMessage.style.color = "var(--muted)";

            const confirmActions = document.createElement("div");
            confirmActions.className = "modal-actions";

            const confirmDeleteBtn = document.createElement("button");
            confirmDeleteBtn.type = "button";
            confirmDeleteBtn.className = "button delete-btn";
            confirmDeleteBtn.textContent = "Löschen bestätigen";
            confirmDeleteBtn.onclick = async () => {
                confirmOverlay.remove();
                overlay.remove();
                await handlers.onDeleteList(list.id);
            };

            const confirmCancelBtn = document.createElement("button");
            confirmCancelBtn.type = "button";
            confirmCancelBtn.className = "button primary";
            confirmCancelBtn.textContent = "Abbrechen";
            confirmCancelBtn.onclick = () => confirmOverlay.remove();

            confirmActions.append(confirmDeleteBtn, confirmCancelBtn);
            confirmModal.append(confirmTitle, confirmMessage, confirmActions);
            confirmOverlay.append(confirmModal);
            document.body.appendChild(confirmOverlay);
        };

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button ghost";
        cancel.textContent = "Abbrechen";
        cancel.onclick = () => overlay.remove();

        const save = document.createElement("button");
        save.type = "button";
        save.className = "button primary";
        save.textContent = "Speichern";
        save.onclick = async () => {
            const name = input.value.trim();
            if (!name) return;
            overlay.remove();
            await handlers.onUpdateList({ ...list, name });
        };

        actions.append(deleteBtn, cancel, save);
        modal.append(title, input, actions);
        overlay.append(modal);
        document.body.appendChild(overlay);
        input.focus();
    };

    const openRemarkModal = (item: Item) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal";

        const title = document.createElement("h3");
        title.textContent = "Notiz zum Artikel";

        const subtitle = document.createElement("p");
        subtitle.className = "modal-subtitle";
        subtitle.textContent = item.label;

        const input = document.createElement("textarea");
        input.className = "modal-textarea";
        input.value = item.remark ?? "";
        input.placeholder = "Notiz hinzufügen";

        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button ghost";
        cancel.textContent = "Abbrechen";
        cancel.onclick = () => overlay.remove();

        const save = document.createElement("button");
        save.type = "button";
        save.className = "button primary";
        save.textContent = "Speichern";
        save.onclick = async () => {
            const remark = input.value.trim();
            overlay.remove();
            const updated: Item = { ...item, remark };
            await handlers.onUpdateItem(updated);
            item.remark = remark;
            renderItems();
        };

        actions.append(cancel, save);
        modal.append(title, subtitle, input, actions);
        overlay.append(modal);
        document.body.appendChild(overlay);
        input.focus();
    };

    const renderTabs = () => {
        tabs.innerHTML = "";

        // Add plus button
        const plusBtn = document.createElement("button");
        plusBtn.className = "tab add-list-btn";
        plusBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        plusBtn.onclick = () => openAddListModal();
        tabs.appendChild(plusBtn);

        lists.forEach((list) => {
            const btn = document.createElement("button");
            btn.textContent = list.name;
            btn.className = list.id === currentList ? "tab active" : "tab";
            btn.onclick = () => {
                currentList = list.id;
                listTitle.textContent = list.name;
                renderTabs();
                renderItems();
                input.focus();
            };

            // Long press handler
            let pressTimer: number | null = null;
            const startPress = () => {
                if (pressTimer) window.clearTimeout(pressTimer);
                pressTimer = window.setTimeout(() => {
                    openEditListModal(list);
                }, 500);
            };
            const cancelPress = () => {
                if (pressTimer) window.clearTimeout(pressTimer);
                pressTimer = null;
            };

            btn.addEventListener("pointerdown", startPress);
            btn.addEventListener("pointerup", cancelPress);
            btn.addEventListener("pointerleave", cancelPress);

            tabs.appendChild(btn);
        });
    };

    const renderItems = () => {
        itemsContainer.innerHTML = "";
        const byList = items.filter((item) => item.listId === currentList && !item.isDeleted);

        if (byList.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">👍</div><div class="empty-text">Alles erledigt</div></div>';
            return;
        }

        byList
            .sort((a, b) => a.label.localeCompare(b.label))
            .forEach((item) => {
                const li = document.createElement("li");
                li.className = "item";

                const content = document.createElement("div");
                content.className = item.remark ? "item-content" : "item-content no-remark";

                const label = document.createElement("span");
                label.className = "item-label";
                label.textContent = item.label;
                content.appendChild(label);

                if (item.remark) {
                    const remark = document.createElement("span");
                    remark.className = "item-remark";
                    remark.textContent = item.remark;
                    content.appendChild(remark);
                }

                const del = document.createElement("button");
                del.textContent = "✕";
                del.className = "delete";
                del.onclick = async (event) => {
                    event.stopPropagation();
                    await handlers.onDeleteItem(item);
                };

                let pressTimer: number | null = null;
                const startPress = () => {
                    if (pressTimer) window.clearTimeout(pressTimer);
                    pressTimer = window.setTimeout(() => {
                        openRemarkModal(item);
                    }, 500);
                };

                const cancelPress = () => {
                    if (pressTimer) window.clearTimeout(pressTimer);
                    pressTimer = null;
                };

                li.addEventListener("pointerdown", startPress);
                li.addEventListener("pointerup", cancelPress);
                li.addEventListener("pointerleave", cancelPress);

                li.append(content, del);
                itemsContainer.appendChild(li);
            });
    };

    const renderSuggestions = (query: string) => {
        suggestionsContainer.innerHTML = "";
        const normalized = query.trim().toLowerCase();
        if (!normalized) return;

        console.log('Searching for:', normalized, 'in', localSuggestions.length, 'suggestions');

        const matches = localSuggestions
            .filter((s) => s.label.toLowerCase().includes(normalized))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .slice(0, 5);

        console.log('Found matches:', matches);

        for (const suggestion of matches) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "suggestion";
            button.textContent = `${suggestion.displayLabel}`;
            button.onclick = async () => {
                await handlers.onAddItem(currentList, suggestion.displayLabel);
                input.value = "";
                suggestionsContainer.innerHTML = "";
                renderItems();
                input.focus();
            };
            suggestionsContainer.appendChild(button);
        }
    };

    input.onkeydown = async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const label = input.value.trim();
            if (!label) return;
            await handlers.onAddItem(currentList, label);
            input.value = "";
            suggestionsContainer.innerHTML = "";
            renderItems();
        }
    };

    input.oninput = () => {
        renderSuggestions(input.value);
    };

    cancelBtn.onclick = () => {
        input.value = "";
        suggestionsContainer.innerHTML = "";
        if (addMessage) {
            addMessage.textContent = "";
            addMessage.classList.remove("visible");
        }
        input.focus();
    };

    renderTabs();
    renderItems();
    listTitle.textContent = lists[0]?.name ?? "Home";

    return {
        updateItems(newItems: Item[]) {
            items.splice(0, items.length, ...newItems);
            renderItems();
        },
        updateSuggestions(newSuggestions: Suggestion[]) {
            localSuggestions = [...newSuggestions];
            renderSuggestions(input.value);
        },
        currentListId: () => currentList,
    };
}
