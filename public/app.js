// State management
let authToken = localStorage.getItem('authToken');
let searchTimeout;

// DOM Elements
const loginPage = document.getElementById('login-page');
const mainPage = document.getElementById('main-page');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');
const shoppingList = document.getElementById('shopping-list');
const searchResults = document.getElementById('search-results');
const searchInput = document.getElementById('search-input');
const emptyMessage = document.getElementById('empty-message');
const footerSearch = document.getElementById('footer-search');
const frequentItems = document.getElementById('frequent-items');
const frequentItemsList = document.getElementById('frequent-items-list');
const cancelButton = document.getElementById('cancel-search');
const editModal = document.getElementById('edit-modal');
const editArticleName = document.getElementById('edit-article-name');
const editRemark = document.getElementById('edit-remark');
const cancelEditButton = document.getElementById('cancel-edit');
const saveEditButton = document.getElementById('save-edit');
const deleteArticleButton = document.getElementById('delete-article');
const wakeLockBtn = document.getElementById('wake-lock-btn');

// State for editing
let currentEditItem = null;
let articlesOnList = new Set();

// Initialize app
function init() {
    if (authToken) {
        showMainPage();
        loadShoppingList();
    } else {
        showLoginPage();
    }

    // Event listeners
    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    logoutButton.addEventListener('click', handleLogout);
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', expandFooter);
    searchInput.addEventListener('blur', collapseFooter);
    cancelButton.addEventListener('click', handleCancelSearch);

    // Prevent blur when clicking inside the footer area
    footerSearch.addEventListener('mousedown', (e) => {
        if (e.target !== searchInput && !searchInput.contains(e.target)) {
            e.preventDefault();
        }
    });
    cancelEditButton.addEventListener('click', closeEditModal);
    saveEditButton.addEventListener('click', saveEdit);
    deleteArticleButton.addEventListener('click', deleteArticle);
    wakeLockBtn.addEventListener('click', toggleWakeLock);
}

// Show/Hide pages
function showLoginPage() {
    loginPage.style.display = 'block';
    mainPage.style.display = 'none';
}

function showMainPage() {
    loginPage.style.display = 'none';
    mainPage.style.display = 'block';
}

// Login handler
async function handleLogin() {
    const password = passwordInput.value;
    loginError.textContent = '';

    if (!password) {
        loginError.textContent = 'Bitte Passwort eingeben';
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            passwordInput.value = '';
            showMainPage();
            loadShoppingList();
        } else {
            loginError.textContent = 'Ungültiges Passwort';
            passwordInput.value = '';
        }
    } catch (error) {
        loginError.textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
        console.error('Login error:', error);
    }
}

// Logout handler
function handleLogout() {
    authToken = null;
    localStorage.removeItem('authToken');
    showLoginPage();
    shoppingList.innerHTML = '';
    searchResults.innerHTML = '';
    searchInput.value = '';
}

// Load shopping list
async function loadShoppingList() {
    try {
        const response = await fetch('/api/shopping-list');
        const items = await response.json();

        shoppingList.innerHTML = '';
        articlesOnList.clear();

        if (items.length === 0) {
            emptyMessage.style.display = 'block';
        } else {
            emptyMessage.style.display = 'none';
            items.forEach(item => {
                articlesOnList.add(item.article_id);
                const listItem = createShoppingListItem(item);
                shoppingList.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error loading shopping list:', error);
        showNotification('Fehler beim Laden der Einkaufsliste', 'error');
    }
}

// Create shopping list item element
function createShoppingListItem(item) {
    const li = document.createElement('li');
    li.className = 'list-item fade-in';

    const title = document.createElement('div');
    title.className = 'list-item-title';
    title.textContent = item.article_name;

    li.appendChild(title);

    // Always add subtitle for consistent height
    const subtitle = document.createElement('div');
    subtitle.className = 'list-item-subtitle';
    subtitle.textContent = item.remark || '';
    li.appendChild(subtitle);

    const chevron = document.createElement('div');
    chevron.className = 'chevron';
    chevron.innerHTML = '›';
    li.appendChild(chevron);

    // Long press and tap detection
    let pressTimer;
    let isLongPress = false;

    li.addEventListener('touchstart', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            openEditModal(item);
        }, 500); // 500ms for long press
    });

    li.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
            // Short tap - remove item
            removeFromShoppingList(item.id);
        }
    });

    li.addEventListener('touchmove', () => {
        clearTimeout(pressTimer);
    });

    // Fallback for mouse events (desktop)
    li.addEventListener('mousedown', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            openEditModal(item);
        }, 500);
    });

    li.addEventListener('mouseup', (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
            removeFromShoppingList(item.id);
        }
    });

    li.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
    });

    return li;
}

// Remove item from shopping list
async function removeFromShoppingList(itemId) {
    try {
        const response = await fetch(`/api/shopping-list/${itemId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadShoppingList();
            loadFrequentItems();
        }
    } catch (error) {
        console.error('Error removing item:', error);
        showNotification('Fehler beim Entfernen', 'error');
    }
}

// Handle search input
function handleSearch(e) {
    const query = e.target.value;

    clearTimeout(searchTimeout);

    if (query.length < 1) {
        // Show frequent items again
        loadFrequentItems();
        return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
        searchArticles(query);
    }, 300);
}

// Search articles
async function searchArticles(query) {
    try {
        const response = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}`);
        const articles = await response.json();

        frequentItemsList.innerHTML = '';

        if (articles.length === 0) {
            // Show the search term as a new article option
            const newArticle = {
                id: null,
                name: query,
                area: 0,
                frequency: 0
            };
            const listItem = createArticleListItem(newArticle);
            frequentItemsList.appendChild(listItem);
        } else {
            articles.forEach(article => {
                const listItem = createArticleListItem(article);
                frequentItemsList.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error searching articles:', error);
        showNotification('Fehler bei der Suche', 'error');
    }
}

// Create article list item element
function createArticleListItem(article) {
    const li = document.createElement('li');
    li.className = 'list-item fade-in';

    const isOnList = articlesOnList.has(article.id);
    if (isOnList) {
        li.classList.add('already-on-list');
    }

    const name = document.createElement('div');
    name.className = 'list-item-title';
    name.textContent = article.name;

    li.appendChild(name);

    // Add to shopping list on tap (only if not already on list)
    if (!isOnList) {
        li.addEventListener('click', async () => {
            // Check again at click time in case the article was added after this item was created
            if (!articlesOnList.has(article.id)) {
                await addToShoppingList(article.id, article.name);
            }
        });
    }

    return li;
}

// Open edit modal
function openEditModal(item) {
    currentEditItem = item;
    editArticleName.value = item.article_name;
    editRemark.value = item.remark || '';
    editModal.style.display = 'flex';
}

// Close edit modal
function closeEditModal() {
    editModal.style.display = 'none';
    currentEditItem = null;
    editArticleName.value = '';
    editRemark.value = '';
}

// Save edit
async function saveEdit() {
    if (!currentEditItem) return;

    const newName = editArticleName.value.trim();
    const newRemark = editRemark.value.trim();

    if (!newName) {
        showNotification('Artikelname darf nicht leer sein', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/shopping-list/${currentEditItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                article_name: newName,
                remark: newRemark
            })
        });

        if (response.ok) {
            closeEditModal();
            loadShoppingList();
            showNotification('Artikel aktualisiert', 'success');
        }
    } catch (error) {
        console.error('Error updating item:', error);
        showNotification('Fehler beim Aktualisieren', 'error');
    }
}

// Delete article from articles list
async function deleteArticle() {
    if (!currentEditItem) return;

    try {
        const response = await fetch(`/api/articles/${currentEditItem.article_id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeEditModal();
            loadShoppingList();
        }
    } catch (error) {
        console.error('Error deleting article:', error);
        showNotification('Fehler beim L\u00f6schen', 'error');
    }
}

// Add article to shopping list
async function addToShoppingList(articleId, articleName = null) {
    try {
        const body = { article_id: articleId, remark: '' };

        // If articleId is null, include the article name to create a new article
        if (articleId === null && articleName) {
            body.article_name = articleName;
        }

        const response = await fetch('/api/shopping-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            // Clear search
            searchInput.value = '';
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            shoppingList.style.display = 'block';

            // Reload shopping list and frequent items
            await loadShoppingList();
            loadFrequentItems();
        }
    } catch (error) {
        console.error('Error adding to shopping list:', error);
        showNotification('Fehler beim Hinzufügen', 'error');
    }
}

// Expand footer to show frequent items
function expandFooter() {
    footerSearch.classList.add('expanded');
    frequentItems.style.display = 'block';
    loadFrequentItems();
}

// Collapse footer
function collapseFooter() {
    // Delay to allow clicking on frequent items
    setTimeout(() => {
        footerSearch.classList.remove('expanded');
        frequentItems.style.display = 'none';
    }, 200);
}

// Handle cancel search button
function handleCancelSearch() {
    searchInput.value = '';
    searchInput.blur();
    footerSearch.classList.remove('expanded');
    frequentItems.style.display = 'none';
}

// Load frequent items (top 4 by frequency)
async function loadFrequentItems() {
    try {
        const response = await fetch('/api/articles/frequent');
        const articles = await response.json();

        frequentItemsList.innerHTML = '';

        articles.slice(0, 4).forEach(article => {
            const listItem = createFrequentListItem(article);
            frequentItemsList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading frequent items:', error);
    }
}

// Create frequent list item element
function createFrequentListItem(article) {
    const li = document.createElement('li');
    li.className = 'list-item fade-in';

    const isOnList = articlesOnList.has(article.id);
    if (isOnList) {
        li.classList.add('already-on-list');
    }

    const title = document.createElement('div');
    title.className = 'list-item-title';
    title.textContent = article.name;

    li.appendChild(title);

    // Add to shopping list on tap (only if not already on list)
    if (!isOnList) {
        li.addEventListener('mousedown', async (e) => {
            e.preventDefault();
            // Check again at click time in case the article was added after this item was created
            if (!articlesOnList.has(article.id)) {
                await addToShoppingList(article.id, null);
            }
            searchInput.blur();
        });
    }

    return li;
}

// Show notification
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Wake Lock functionality
function toggleWakeLock() {
    if (!navigator.wakeLock) {
        alert("Ihr Gerät unterstützt Wake Lock nicht. Versuchen Sie es auf einem Android-Telefon oder einem Gerät mit iOS 16.4 oder höher!");
    }
    else if (window.currentWakeLock && !window.currentWakeLock.released) {
        releaseScreen();
    }
    else {
        lockScreen();
    }
}

async function lockScreen() {
    try {
        window.currentWakeLock = await navigator.wakeLock.request();
        wakeLockBtn.style.opacity = '1';
        wakeLockBtn.style.backgroundColor = '#81c784';
    }
    catch (err) {
        alert('Wake Lock Fehler: ' + err);
    }
}

async function releaseScreen() {
    window.currentWakeLock.release();
    wakeLockBtn.style.opacity = '';
    wakeLockBtn.style.backgroundColor = '';
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(error => console.log('Service Worker registration failed:', error));
    });
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
