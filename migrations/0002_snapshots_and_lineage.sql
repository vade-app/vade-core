-- Pillar 3 of the canvas library + object catalogue UX uplift.
-- Adds named snapshot history per canvas + parent pointers for branched
-- canvases. The current head pointer at canvases/<slug>/snapshot.tldr
-- is unchanged; named snapshots live alongside as
-- canvases/<slug>/history/<snapshot_id>.tldr in R2.

CREATE TABLE IF NOT EXISTS canvas_snapshots (
  snapshot_id  TEXT PRIMARY KEY,
  canvas_slug  TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT '',
  created      TEXT NOT NULL,
  FOREIGN KEY (canvas_slug) REFERENCES canvases(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS canvas_snapshots_slug_created_idx
  ON canvas_snapshots (canvas_slug, created DESC);

-- Branch lineage: when a canvas is forked from another, parent_slug
-- points at the parent and parent_snapshot at the named snapshot the
-- branch was rooted at (NULL = branched from head). NULL on both means
-- root canvas. ALTER TABLE ADD COLUMN is irreversible in D1; back up
-- before applying to production.
ALTER TABLE canvases ADD COLUMN parent_slug TEXT NULL;
ALTER TABLE canvases ADD COLUMN parent_snapshot TEXT NULL;
