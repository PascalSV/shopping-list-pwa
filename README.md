# Shopping List PWA

A modern Progressive Web App for managing your shopping list, built with TypeScript, OnsenUI, and Cloudflare Workers.

## Features

- 🔐 Password-protected access
- 📱 iOS-style interface
- 🛒 Add/remove shopping list items
- 🔍 Smart article search
- 💾 D1 Database integration
- ⚡ Cloudflare Workers deployment
- 📴 Offline-capable PWA

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Wrangler

Update `wrangler.toml` with your actual D1 database ID:

```bash
# Get your database ID
wrangler d1 list

# Update wrangler.toml with the correct database_id
```

### 3. Set Password Secret

```bash
wrangler secret put PASSWORD
# Enter your desired password when prompted
```

### 4. Create App Icons

You need to create two icon files in the `public` directory:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

You can use any shopping cart or list icon. Here are some options:
- Create custom icons using design tools
- Use an online icon generator
- Download from icon libraries (make sure they're licensed for your use)

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:8787` to test the app locally.

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

## Database Schema

The app expects the following D1 database schema:

### Table: `articles`
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area INTEGER DEFAULT 0,
  frequency INTEGER DEFAULT 0
);
```

### Table: `shopping_list`
```sql
CREATE TABLE shopping_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  remark TEXT,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

## Usage

1. **Login**: Enter the password you configured
2. **View Shopping List**: See all items you need to buy
3. **Remove Items**: Tap any shopping list item to remove it
4. **Search Articles**: Type 3+ characters in the search box to find articles
5. **Add Items**: Tap a search result to add it to your shopping list

## File Structure

```
shopping-list-pwa/
├── public/
│   ├── index.html       # Main HTML file
│   ├── styles.css       # iOS-style CSS
│   ├── app.js          # Client-side logic
│   ├── manifest.json    # PWA manifest
│   ├── sw.js           # Service worker
│   ├── icon-192.png    # App icon (small)
│   └── icon-512.png    # App icon (large)
├── src/
│   └── worker.ts       # Cloudflare Worker
├── package.json
├── tsconfig.json
└── wrangler.toml       # Cloudflare configuration
```

## Technologies Used

- **Frontend**: OnsenUI, HTML5, CSS3, JavaScript
- **Backend**: TypeScript, Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Wrangler CLI
- **Font**: Inter (Google Fonts)

## Color Scheme

- **Shopping List Items**: Blue accent (#007aff) - White background
- **Search Results**: Orange accent (#ff9500) - Cream background (#fff3e0)
- **Primary Gradient**: Purple gradient (#667eea to #764ba2)

## Development Notes

- The app uses localStorage to persist authentication
- Search is debounced (300ms) for performance
- Article frequency is automatically incremented when added to the list
- Shopping list is sorted by area and name
- Search results are sorted by frequency (most used first)

## License

MIT
