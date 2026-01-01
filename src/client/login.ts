let selectedUser: 'Pascal' | 'Claudia' = 'Pascal';

export async function showLoginScreen(): Promise<boolean> {
    const existing = document.querySelector<HTMLDivElement>('#login-screen');
    if (!existing) createLoginUI();

    return new Promise((resolve) => {
        const form = document.querySelector<HTMLFormElement>('#login-form');
        const messageEl = document.querySelector<HTMLDivElement>('#login-message');
        const userToggle = document.querySelector<HTMLButtonElement>('#user-toggle');

        if (!form || !messageEl || !userToggle) {
            resolve(false);
            return;
        }

        userToggle.onclick = (event) => {
            event.preventDefault();
            selectedUser = selectedUser === 'Pascal' ? 'Claudia' : 'Pascal';
            userToggle.textContent = selectedUser;
        };

        form.onsubmit = async (event) => {
            event.preventDefault();
            const passwordInput = document.querySelector<HTMLInputElement>('#login-password');
            const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');

            if (!passwordInput || !button) return;

            const originalText = button.textContent;
            button.textContent = 'Anmeldung läuft...';
            button.disabled = true;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        user: selectedUser,
                        password: passwordInput.value
                    }),
                });

                if (response.ok) {
                    localStorage.setItem('auth-token', 'authenticated');
                    localStorage.setItem('auth-user', selectedUser);
                    const loginScreen = document.querySelector<HTMLDivElement>('#login-screen');
                    if (loginScreen) loginScreen.remove();
                    resolve(true);
                } else {
                    messageEl.textContent = 'Ungültiges Passwort';
                    messageEl.style.display = 'block';
                    button.textContent = originalText;
                    button.disabled = false;
                }
            } catch (err) {
                messageEl.textContent = 'Anmeldung fehlgeschlagen: ' + String(err);
                messageEl.style.display = 'block';
                button.textContent = originalText;
                button.disabled = false;
            }
        };
    });
}

function createLoginUI() {
    const loginScreen = document.createElement('div');
    loginScreen.id = 'login-screen';
    loginScreen.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <h1>Einkaufsliste</h1>
                <p class="login-subtitle">Wähle Deinen Benutzer und gib das Passwort ein, um fortzufahren</p>
                <form id="login-form">
                    <div class="form-group">
                        <label for="login-username">Benutzername</label>
                        <button type="button" id="user-toggle" class="user-toggle-button">Pascal</button>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Passwort</label>
                        <input type="password" id="login-password" name="password" placeholder="Passwort eingeben" required />
                    </div>
                    <div id="login-message" class="login-message" style="display: none;"></div>
                    <button type="submit" class="login-button">Anmelden</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(loginScreen);
}

export function isAuthenticated(): boolean {
    return localStorage.getItem('auth-token') === 'authenticated';
}

export function logout() {
    localStorage.removeItem('auth-token');
    window.location.reload();
}
