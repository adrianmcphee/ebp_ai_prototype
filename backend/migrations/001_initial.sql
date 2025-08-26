-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT NOW(),
    query TEXT NOT NULL,
    resolved_query TEXT,
    intent_type VARCHAR(50),
    confidence FLOAT,
    entities JSONB,
    validation_result JSONB,
    action_taken VARCHAR(50),
    completed BOOLEAN DEFAULT FALSE,
    response_time_ms INTEGER,
    error_message TEXT
);

-- Intent cache table
CREATE TABLE IF NOT EXISTS intent_cache (
    id SERIAL PRIMARY KEY,
    query_hash VARCHAR(64) UNIQUE NOT NULL,
    query TEXT NOT NULL,
    intent_type VARCHAR(50),
    confidence FLOAT,
    alternatives JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    date DATE DEFAULT CURRENT_DATE,
    intent_type VARCHAR(50),
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_confidence FLOAT,
    avg_response_time_ms INTEGER,
    UNIQUE(date, intent_type)
);

-- Indexes for performance
CREATE INDEX idx_session_timestamp ON interactions(session_id, timestamp DESC);
CREATE INDEX idx_intent_confidence ON interactions(intent_type, confidence);
CREATE INDEX idx_cache_expires ON intent_cache(expires_at);
CREATE INDEX idx_analytics_date ON analytics(date DESC);

-- Session cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions 
    WHERE last_activity < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Update session activity trigger
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions 
    SET last_activity = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
AFTER INSERT ON interactions
FOR EACH ROW
EXECUTE FUNCTION update_session_activity();