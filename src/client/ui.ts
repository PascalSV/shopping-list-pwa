import { Item, List, Suggestion } from "../types";

export type UIHandlers = {
    onAddItem(listId: string, label: string): Promise<void>;
    onDeleteItem(item: Item): Promise<void>;
};

export function mountUI(lists: List[], items: Item[], suggestions: Suggestion[], handlers: UIHandlers) {
    const tabs = document.querySelector<HTMLDivElement>('#list-tabs');
    const listTitle = document.querySelector<HTMLHeadingElement>('#list-title');
    const form = document.querySelector<HTMLFormElement>('#add-form');
    const input = document.querySelector<HTMLInputElement>('#item-input');
    const clearBtn = document.querySelector<HTMLButtonElement>('#clear-input');
    const itemsContainer = document.querySelector<HTMLUListElement>('#items');
    const suggestionsContainer = document.querySelector<HTMLDivElement>('#suggestions');

    if (!tabs || !form || !input || !clearBtn || !itemsContainer || !listTitle || !suggestionsContainer) return;

    let currentList = lists[0]?.id ?? "home";
    let localSuggestions = [...suggestions];

    const renderTabs = () => {
        tabs.innerHTML = "";
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
            tabs.appendChild(btn);
        });
    };

    const renderItems = () => {
        itemsContainer.innerHTML = "";
        const byList = items.filter((item) => item.listId === currentList && !item.isDeleted);
        byList
            .sort((a, b) => a.label.localeCompare(b.label))
            .forEach((item) => {
                const li = document.createElement("li");
                li.className = "item";

                const label = document.createElement("span");
                label.textContent = item.label;

                const del = document.createElement("button");
                del.textContent = "✕";
                del.className = "delete";
                del.onclick = async () => handlers.onDeleteItem(item);

                li.append(label, del);
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
            button.textContent = `${suggestion.displayLabel})`;
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

    form.onsubmit = async (event) => {
        event.preventDefault();
        const label = input.value.trim();
        if (!label) return;
        await handlers.onAddItem(currentList, label);
        input.value = "";
        clearBtn.style.display = "none";
        suggestionsContainer.innerHTML = "";
        renderItems();
    };

    input.oninput = () => {
        renderSuggestions(input.value);
        clearBtn.style.display = input.value ? "block" : "none";
    };

    clearBtn.onclick = () => {
        input.value = "";
        clearBtn.style.display = "none";
        suggestionsContainer.innerHTML = "";
        input.focus();
    };

    renderTabs();
    renderItems();

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
