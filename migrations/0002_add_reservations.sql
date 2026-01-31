-- Event reservations table
CREATE TABLE IF NOT EXISTS event_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  participants INTEGER DEFAULT 1,
  status TEXT DEFAULT 'confirmed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_event_reservations_event_id ON event_reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reservations_user_id ON event_reservations(user_id);
