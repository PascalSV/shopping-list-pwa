-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    label TEXT NOT NULL,
    remark TEXT DEFAULT '',
    done INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (list_id) REFERENCES lists(id)
);

-- Create suggestions/articles table
CREATE TABLE IF NOT EXISTS articles (
    label TEXT PRIMARY KEY,
    display_label TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    updated_at INTEGER DEFAULT 0
);

-- Create sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);
CREATE INDEX IF NOT EXISTS idx_lists_updated_at ON lists(updated_at);
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
