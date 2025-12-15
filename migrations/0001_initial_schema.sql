-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area INTEGER DEFAULT 0,
  frequency INTEGER DEFAULT 0
);

-- Create shopping_list table
CREATE TABLE IF NOT EXISTS shopping_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  remark TEXT,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shopping_list_article_id ON shopping_list(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_name ON articles(name);
