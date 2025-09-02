-- =============================================================================
-- Encore Analytics Service - Events Table Migration
-- =============================================================================
-- Description: Creates the events table for storing all analytics events
-- Version: 1.0.0
-- Created: 2024-01-20
-- =============================================================================

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    user_id UUID,
    bar_id UUID NOT NULL,
    session_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_bar_id ON events(bar_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_bar_type_timestamp ON events(bar_id, type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_user_type_timestamp ON events(user_id, type, timestamp) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_status_created ON events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(type, timestamp);

-- Create GIN index for JSONB data column for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_events_metadata_gin ON events USING GIN(metadata);

-- Create partial indexes for specific statuses
CREATE INDEX IF NOT EXISTS idx_events_pending ON events(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_events_failed ON events(created_at, retry_count) WHERE status = 'failed';

-- Add constraints
ALTER TABLE events ADD CONSTRAINT chk_events_status 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

ALTER TABLE events ADD CONSTRAINT chk_events_retry_count 
    CHECK (retry_count >= 0 AND retry_count <= 10);

ALTER TABLE events ADD CONSTRAINT chk_events_type_not_empty 
    CHECK (LENGTH(TRIM(type)) > 0);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create event types enum for reference (stored as comments)
COMMENT ON TABLE events IS 'Stores all analytics events from the Encore platform';
COMMENT ON COLUMN events.id IS 'Unique identifier for the event';
COMMENT ON COLUMN events.type IS 'Event type (e.g., song_played, product_ordered, user_login)';
COMMENT ON COLUMN events.user_id IS 'ID of the user who triggered the event (nullable for anonymous events)';
COMMENT ON COLUMN events.bar_id IS 'ID of the bar where the event occurred';
COMMENT ON COLUMN events.session_id IS 'Session ID for grouping related events';
COMMENT ON COLUMN events.timestamp IS 'When the event actually occurred';
COMMENT ON COLUMN events.data IS 'Event-specific data in JSON format';
COMMENT ON COLUMN events.metadata IS 'Additional metadata (user agent, IP, source, etc.)';
COMMENT ON COLUMN events.status IS 'Processing status of the event';
COMMENT ON COLUMN events.processed_at IS 'When the event was successfully processed';
COMMENT ON COLUMN events.retry_count IS 'Number of processing retry attempts';
COMMENT ON COLUMN events.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN events.created_at IS 'When the event record was created';
COMMENT ON COLUMN events.updated_at IS 'When the event record was last updated';

-- Create view for recent events (last 24 hours)
CREATE OR REPLACE VIEW recent_events AS
SELECT 
    id,
    type,
    user_id,
    bar_id,
    session_id,
    timestamp,
    data,
    metadata,
    status,
    created_at
FROM events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Create view for failed events that need retry
CREATE OR REPLACE VIEW failed_events AS
SELECT 
    id,
    type,
    user_id,
    bar_id,
    timestamp,
    data,
    retry_count,
    error_message,
    created_at,
    updated_at
FROM events
WHERE status = 'failed' AND retry_count < 3
ORDER BY created_at ASC;

-- Create view for event statistics
CREATE OR REPLACE VIEW event_statistics AS
SELECT 
    type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds,
    MIN(timestamp) as first_event,
    MAX(timestamp) as last_event
FROM events
GROUP BY type
ORDER BY total_count DESC;

-- Insert initial event types for reference
INSERT INTO events (type, bar_id, data, status, processed_at) VALUES
-- Music events
('song_requested', '00000000-0000-0000-0000-000000000000', '{"description": "User requested a song"}', 'completed', NOW()),
('song_played', '00000000-0000-0000-0000-000000000000', '{"description": "Song was played"}', 'completed', NOW()),
('song_voted', '00000000-0000-0000-0000-000000000000', '{"description": "User voted for a song"}', 'completed', NOW()),
('song_skipped', '00000000-0000-0000-0000-000000000000', '{"description": "Song was skipped"}', 'completed', NOW()),
('priority_play', '00000000-0000-0000-0000-000000000000', '{"description": "Priority play was used"}', 'completed', NOW()),
('queue_added', '00000000-0000-0000-0000-000000000000', '{"description": "Song added to queue"}', 'completed', NOW()),
('queue_removed', '00000000-0000-0000-0000-000000000000', '{"description": "Song removed from queue"}', 'completed', NOW()),
-- Menu events
('product_ordered', '00000000-0000-0000-0000-000000000000', '{"description": "Product was ordered"}', 'completed', NOW()),
('product_sold', '00000000-0000-0000-0000-000000000000', '{"description": "Product was sold"}', 'completed', NOW()),
('points_spent', '00000000-0000-0000-0000-000000000000', '{"description": "User spent points"}', 'completed', NOW()),
('payment_completed', '00000000-0000-0000-0000-000000000000', '{"description": "Payment was completed"}', 'completed', NOW()),
-- User events
('user_registered', '00000000-0000-0000-0000-000000000000', '{"description": "New user registered"}', 'completed', NOW()),
('user_login', '00000000-0000-0000-0000-000000000000', '{"description": "User logged in"}', 'completed', NOW()),
('user_logout', '00000000-0000-0000-0000-000000000000', '{"description": "User logged out"}', 'completed', NOW()),
('profile_updated', '00000000-0000-0000-0000-000000000000', '{"description": "User updated profile"}', 'completed', NOW())
ON CONFLICT DO NOTHING;

-- Delete the reference events (they were just for documentation)
DELETE FROM events WHERE bar_id = '00000000-0000-0000-0000-000000000000';

-- Create function to clean up old events
CREATE OR REPLACE FUNCTION cleanup_old_events(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM events 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get event counts by type and period
CREATE OR REPLACE FUNCTION get_event_counts(
    p_bar_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW(),
    p_event_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    event_type TEXT,
    event_count BIGINT,
    unique_users BIGINT,
    unique_sessions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.type::TEXT as event_type,
        COUNT(*)::BIGINT as event_count,
        COUNT(DISTINCT e.user_id)::BIGINT as unique_users,
        COUNT(DISTINCT e.session_id)::BIGINT as unique_sessions
    FROM events e
    WHERE 
        (p_bar_id IS NULL OR e.bar_id = p_bar_id)
        AND e.timestamp >= p_start_date
        AND e.timestamp <= p_end_date
        AND (p_event_types IS NULL OR e.type = ANY(p_event_types))
        AND e.status = 'completed'
    GROUP BY e.type
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT ON recent_events TO authenticated;
GRANT SELECT ON failed_events TO authenticated;
GRANT SELECT ON event_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_events(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]) TO authenticated;

-- Grant basic read access to anonymous users for public statistics
GRANT SELECT ON event_statistics TO anon;

-- Create notification trigger for real-time updates
CREATE OR REPLACE FUNCTION notify_event_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('event_created', json_build_object(
        'id', NEW.id,
        'type', NEW.type,
        'bar_id', NEW.bar_id,
        'timestamp', NEW.timestamp
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_event_created_trigger
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_created();

-- =============================================================================
-- Migration Complete
-- =============================================================================