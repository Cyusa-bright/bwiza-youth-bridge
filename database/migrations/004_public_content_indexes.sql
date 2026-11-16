CREATE INDEX idx_programs_public_listing ON programs (status, created_at, id);

CREATE INDEX idx_projects_public_listing ON projects (status, created_at, id);

CREATE INDEX idx_events_public_listing ON events (status, created_at, id);
