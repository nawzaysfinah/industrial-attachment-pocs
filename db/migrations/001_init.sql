CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  industry_type TEXT NOT NULL,
  company_size TEXT NOT NULL,
  ai_maturity TEXT NOT NULL,
  description_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pain_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  frequency TEXT NOT NULL,
  affected_roles TEXT NOT NULL,
  workaround TEXT NOT NULL,
  priority_rank INTEGER,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filetype TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS web_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  prompt_version TEXT NOT NULL,
  model_used TEXT NOT NULL,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  case_id INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, label, case_id),
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_node_id INTEGER NOT NULL,
  to_node_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  case_id INTEGER NOT NULL,
  FOREIGN KEY(from_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(to_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS text_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS web_cache (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_company_name ON cases(company_name);
CREATE INDEX IF NOT EXISTS idx_pain_points_case_id ON pain_points(case_id);
CREATE INDEX IF NOT EXISTS idx_attachments_case_id ON attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_web_sources_case_id ON web_sources(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_case_id ON reports(case_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_case_id_type ON graph_nodes(case_id, type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_case_id ON graph_edges(case_id);
CREATE INDEX IF NOT EXISTS idx_text_chunks_case_id ON text_chunks(case_id);
CREATE INDEX IF NOT EXISTS idx_text_chunks_source ON text_chunks(source_type, source_id);
