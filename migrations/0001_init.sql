CREATE TABLE IF NOT EXISTS canvases (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  created     TEXT NOT NULL,
  modified    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS canvases_modified_idx ON canvases (modified DESC);

CREATE TABLE IF NOT EXISTS entities (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS entities_name_idx ON entities (name);
