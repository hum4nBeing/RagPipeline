CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    text TEXT,
    vector_idx INTEGER,
    FOREIGN KEY(document_id) REFERENCES documents(id)
);
