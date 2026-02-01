-- Create crisis_articles table for ocean crisis news articles
CREATE TABLE IF NOT EXISTS crisis_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'general',
  published_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crisis_articles_category ON crisis_articles(category);
CREATE INDEX IF NOT EXISTS idx_crisis_articles_published_date ON crisis_articles(published_date);
