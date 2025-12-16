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

        if (items.length === 0) {
            emptyMessage.style.display = 'block';
        } else {
            emptyMessage.style.display = 'none';
            items.forEach(item => {
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
    const li = document.createElement('ons-list-item');
    li.className = 'list-item fade-in inset';
    li.setAttribute('tappable', '');

    const content = document.createElement('div');
    content.className = 'list-item__center';

    const title = document.createElement('div');
    title.className = 'list-item__title';
    title.textContent = item.article_name;

    content.appendChild(title);

    if (item.remark) {
        const remark = document.createElement('div');
        remark.className = 'list-item__subtitle';
        remark.textContent = item.remark;
        content.appendChild(remark);
    }

    li.appendChild(content);

    // Remove item on tap
    li.addEventListener('click', async () => {
        await removeFromShoppingList(item.id);
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
            loadShoppingList();
            showNotification('Artikel entfernt', 'success');
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

    if (query.length < 3) {
        // Show shopping list
        shoppingList.style.display = 'block';
        searchResults.style.display = 'none';
        emptyMessage.style.display = shoppingList.children.length === 0 ? 'block' : 'none';
        return;
    }

    // Hide shopping list and empty message
    shoppingList.style.display = 'none';
    emptyMessage.style.display = 'none';
    searchResults.style.display = 'block';

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

        searchResults.innerHTML = '';

        if (articles.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'empty-message';
            noResults.innerHTML = '<p>Keine Artikel gefunden</p>';
            searchResults.appendChild(noResults);
        } else {
            articles.forEach(article => {
                const listItem = createArticleListItem(article);
                searchResults.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error searching articles:', error);
        showNotification('Fehler bei der Suche', 'error');
    }
}

// Create article list item element
function createArticleListItem(article) {
    const li = document.createElement('ons-list-item');
    li.className = 'list-item fade-in';
    li.setAttribute('tappable', '');

    const content = document.createElement('div');
    content.className = 'list-item__center';

    const name = document.createElement('div');
    name.className = 'article-name';
    name.textContent = article.name;

    const info = document.createElement('div');
    info.className = 'article-info';
    info.textContent = `Bereich: ${article.area} • ${article.frequency}x verwendet`;

    content.appendChild(name);
    content.appendChild(info);
    li.appendChild(content);

    // Add to shopping list on tap
    li.addEventListener('click', async () => {
        await addToShoppingList(article.id);
    });

    return li;
}

// Add article to shopping list
async function addToShoppingList(articleId) {
    try {
        const response = await fetch('/api/shopping-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: articleId, remark: '' })
        });

        if (response.ok) {
            // Clear search
            searchInput.value = '';
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            shoppingList.style.display = 'block';

            // Reload shopping list
            loadShoppingList();
            showNotification('Zur Einkaufsliste hinzugefügt', 'success');
        }
    } catch (error) {
        console.error('Error adding to shopping list:', error);
        showNotification('Fehler beim Hinzufügen', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    ons.notification.toast(message, {
        timeout: 2000,
        animation: 'fall'
    });
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
