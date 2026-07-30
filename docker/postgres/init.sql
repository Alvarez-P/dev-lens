-- DevLens PostgreSQL initialization script
-- EPIC-003: Identity — User management tables are auto-created by TypeORM synchronize
-- In production, use proper migrations instead of synchronize

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
