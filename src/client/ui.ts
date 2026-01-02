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
        title.textContent = "Artikel bearbeiten";

        const subtitle = document.createElement("p");
        subtitle.className = "modal-subtitle";
        subtitle.textContent = item.label;

        const remarkInput = document.createElement("textarea");
        remarkInput.className = "modal-textarea";
        remarkInput.value = item.remark ?? "";
        remarkInput.placeholder = "Notiz hinzufügen";

        const areaLabel = document.createElement("label");
        areaLabel.textContent = "Bereich im Supermarkt";
        areaLabel.style.fontSize = "14px";
        areaLabel.style.color = "var(--muted)";
        areaLabel.style.marginTop = "8px";

        const areaInput = document.createElement("select");
        areaInput.className = "modal-input";
        areaInput.innerHTML = `
            <option value="0">Nicht zugeordnet</option>
            <option value="1">Obst & Gemüse</option>
            <option value="2">Backwaren</option>
            <option value="3">Milchprodukte</option>
            <option value="4">Fleisch & Wurst</option>
            <option value="5">Asia</option>
            <option value="6">Alkoholika</option>
            <option value="7">Haushalt & Drogerie</option>
            <option value="8">Getränke</option>
            <option value="9">Konserven</option>
            <option value="10">Süßigkeiten & Knabbereien</option>
            <option value="11">Tiefkühlwaren</option>
        `;
        areaInput.value = String(item.area ?? 0);

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
            const remark = remarkInput.value.trim();
            const area = parseInt(areaInput.value, 10);
            overlay.remove();
            const updated: Item = { ...item, remark, area };
            await handlers.onUpdateItem(updated);
            item.remark = remark;
            item.area = area;
            renderItems();
        };

        actions.append(cancel, save);
        modal.append(title, subtitle, remarkInput, areaLabel, areaInput, actions);
        overlay.append(modal);
        document.body.appendChild(overlay);
        remarkInput.focus();
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
            .sort((a, b) => {
                const areaA = a.area ?? 0;
                const areaB = b.area ?? 0;
                if (areaA !== areaB) return areaA - areaB;
                return a.label.localeCompare(b.label);
            })
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

                let pressTimer: number | null = null;
                let touchStartX = 0;
                let touchStartY = 0;
                let isLongPress = false;
                let hasMoved = false;

                const startPress = (e: TouchEvent | PointerEvent) => {
                    isLongPress = false;
                    hasMoved = false;
                    if (e instanceof TouchEvent) {
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                    } else {
                        touchStartX = e.clientX;
                        touchStartY = e.clientY;
                    }
                    if (pressTimer) window.clearTimeout(pressTimer);
                    pressTimer = window.setTimeout(() => {
                        isLongPress = true;
                        openRemarkModal(item);
                    }, 800); // Longer timeout for long press
                };

                const endPress = async (e: TouchEvent | PointerEvent) => {
                    if (pressTimer) window.clearTimeout(pressTimer);
                    // If it wasn't a long press and user didn't move, treat as delete
                    if (!isLongPress && !hasMoved) {
                        await handlers.onDeleteItem(item);
                    }
                    pressTimer = null;
                    isLongPress = false;
                    hasMoved = false;
                };

                const onMove = (e: TouchEvent | PointerEvent) => {
                    // Cancel actions if user is scrolling (movement > 10px)
                    let currentX = 0;
                    let currentY = 0;
                    if (e instanceof TouchEvent) {
                        currentX = e.touches[0].clientX;
                        currentY = e.touches[0].clientY;
                    } else {
                        currentX = e.clientX;
                        currentY = e.clientY;
                    }
                    const dx = Math.abs(currentX - touchStartX);
                    const dy = Math.abs(currentY - touchStartY);
                    if (dx > 10 || dy > 10) {
                        hasMoved = true;
                        if (pressTimer) window.clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                };

                li.addEventListener("touchstart", startPress as any);
                li.addEventListener("touchend", endPress as any);
                li.addEventListener("touchmove", onMove as any);
                li.addEventListener("pointerdown", startPress as any);
                li.addEventListener("pointerup", endPress as any);
                li.addEventListener("pointermove", onMove as any);

                li.append(content);
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
