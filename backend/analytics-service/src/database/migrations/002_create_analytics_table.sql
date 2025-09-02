-- =============================================================================
-- Encore Analytics Service - Analytics Table Migration
-- =============================================================================
-- Description: Creates the analytics table for storing aggregated metrics
-- Version: 1.0.0
-- Created: 2024-01-20
-- =============================================================================

-- Create analytics table for aggregated metrics
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    bar_id UUID NOT NULL,
    user_id UUID,
    period_type VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    value DECIMAL(15,4) NOT NULL DEFAULT 0,
    count_value BIGINT DEFAULT 0,
    dimensions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_type ON analytics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_bar_id ON analytics(bar_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_period_type ON analytics(period_type);
CREATE INDEX IF NOT EXISTS idx_analytics_period_start ON analytics(period_start);
CREATE INDEX IF NOT EXISTS idx_analytics_period_end ON analytics(period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_calculated_at ON analytics(calculated_at);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_bar_metric_period ON analytics(bar_id, metric_name, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_period_range ON analytics(metric_name, period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_user_metric_period ON analytics(user_id, metric_name, period_type, period_start) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_type_period_calculated ON analytics(metric_type, period_type, calculated_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_gin ON analytics USING GIN(dimensions);
CREATE INDEX IF NOT EXISTS idx_analytics_metadata_gin ON analytics USING GIN(metadata);

-- Create unique constraint to prevent duplicate metrics for same period
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_metric_period 
    ON analytics(metric_name, bar_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), period_type, period_start);

-- Add constraints
ALTER TABLE analytics ADD CONSTRAINT chk_analytics_period_type 
    CHECK (period_type IN ('hour', 'day', 'week', 'month', 'quarter', 'year', 'custom'));

ALTER TABLE analytics ADD CONSTRAINT chk_analytics_metric_type 
    CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary', 'rate', 'percentage', 'duration'));

ALTER TABLE analytics ADD CONSTRAINT chk_analytics_period_order 
    CHECK (period_start <= period_end);

ALTER TABLE analytics ADD CONSTRAINT chk_analytics_metric_name_not_empty 
    CHECK (LENGTH(TRIM(metric_name)) > 0);

ALTER TABLE analytics ADD CONSTRAINT chk_analytics_value_not_negative 
    CHECK (value >= 0);

ALTER TABLE analytics ADD CONSTRAINT chk_analytics_count_not_negative 
    CHECK (count_value >= 0);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_analytics_updated_at 
    BEFORE UPDATE ON analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE analytics IS 'Stores aggregated analytics data for the Encore platform';
COMMENT ON COLUMN analytics.id IS 'Unique identifier for the analytics record';
COMMENT ON COLUMN analytics.metric_name IS 'Name of the metric (e.g., songs_played, revenue, active_users)';
COMMENT ON COLUMN analytics.metric_type IS 'Type of metric (counter, gauge, histogram, etc.)';
COMMENT ON COLUMN analytics.bar_id IS 'ID of the bar this metric belongs to';
COMMENT ON COLUMN analytics.user_id IS 'ID of the user (for user-specific metrics, nullable for bar-wide metrics)';
COMMENT ON COLUMN analytics.period_type IS 'Time period type (hour, day, week, month, etc.)';
COMMENT ON COLUMN analytics.period_start IS 'Start of the time period for this metric';
COMMENT ON COLUMN analytics.period_end IS 'End of the time period for this metric';
COMMENT ON COLUMN analytics.value IS 'Numeric value of the metric';
COMMENT ON COLUMN analytics.count_value IS 'Count value for metrics that track occurrences';
COMMENT ON COLUMN analytics.dimensions IS 'Additional dimensions/filters in JSON format';
COMMENT ON COLUMN analytics.metadata IS 'Additional metadata about the metric calculation';
COMMENT ON COLUMN analytics.calculated_at IS 'When this metric was calculated';
COMMENT ON COLUMN analytics.created_at IS 'When the analytics record was created';
COMMENT ON COLUMN analytics.updated_at IS 'When the analytics record was last updated';

-- Create views for common analytics queries

-- View for daily metrics
CREATE OR REPLACE VIEW daily_analytics AS
SELECT 
    metric_name,
    metric_type,
    bar_id,
    period_start::DATE as date,
    SUM(value) as total_value,
    SUM(count_value) as total_count,
    AVG(value) as avg_value,
    MAX(value) as max_value,
    MIN(value) as min_value,
    COUNT(*) as records_count
FROM analytics
WHERE period_type = 'day'
GROUP BY metric_name, metric_type, bar_id, period_start::DATE
ORDER BY date DESC, metric_name;

-- View for weekly metrics
CREATE OR REPLACE VIEW weekly_analytics AS
SELECT 
    metric_name,
    metric_type,
    bar_id,
    DATE_TRUNC('week', period_start) as week_start,
    SUM(value) as total_value,
    SUM(count_value) as total_count,
    AVG(value) as avg_value,
    COUNT(*) as records_count
FROM analytics
WHERE period_type IN ('day', 'week')
GROUP BY metric_name, metric_type, bar_id, DATE_TRUNC('week', period_start)
ORDER BY week_start DESC, metric_name;

-- View for monthly metrics
CREATE OR REPLACE VIEW monthly_analytics AS
SELECT 
    metric_name,
    metric_type,
    bar_id,
    DATE_TRUNC('month', period_start) as month_start,
    SUM(value) as total_value,
    SUM(count_value) as total_count,
    AVG(value) as avg_value,
    COUNT(*) as records_count
FROM analytics
WHERE period_type IN ('day', 'week', 'month')
GROUP BY metric_name, metric_type, bar_id, DATE_TRUNC('month', period_start)
ORDER BY month_start DESC, metric_name;

-- View for real-time metrics (last 24 hours)
CREATE OR REPLACE VIEW realtime_analytics AS
SELECT 
    metric_name,
    metric_type,
    bar_id,
    user_id,
    value,
    count_value,
    dimensions,
    period_start,
    period_end,
    calculated_at
FROM analytics
WHERE calculated_at >= NOW() - INTERVAL '24 hours'
ORDER BY calculated_at DESC;

-- View for top metrics by bar
CREATE OR REPLACE VIEW top_metrics_by_bar AS
SELECT 
    bar_id,
    metric_name,
    metric_type,
    SUM(value) as total_value,
    SUM(count_value) as total_count,
    AVG(value) as avg_value,
    COUNT(*) as periods_count,
    MIN(period_start) as first_period,
    MAX(period_end) as last_period
FROM analytics
WHERE calculated_at >= NOW() - INTERVAL '30 days'
GROUP BY bar_id, metric_name, metric_type
ORDER BY bar_id, total_value DESC;

-- Create functions for analytics operations

-- Function to upsert analytics metrics
CREATE OR REPLACE FUNCTION upsert_analytics_metric(
    p_metric_name VARCHAR(100),
    p_metric_type VARCHAR(50),
    p_bar_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_period_type VARCHAR(20),
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_value DECIMAL(15,4),
    p_count_value BIGINT DEFAULT 0,
    p_dimensions JSONB DEFAULT '{}',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO analytics (
        metric_name, metric_type, bar_id, user_id, period_type,
        period_start, period_end, value, count_value, dimensions, metadata
    ) VALUES (
        p_metric_name, p_metric_type, p_bar_id, p_user_id, p_period_type,
        p_period_start, p_period_end, p_value, p_count_value, p_dimensions, p_metadata
    )
    ON CONFLICT (metric_name, bar_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), period_type, period_start)
    DO UPDATE SET
        value = analytics.value + EXCLUDED.value,
        count_value = analytics.count_value + EXCLUDED.count_value,
        dimensions = EXCLUDED.dimensions,
        metadata = EXCLUDED.metadata,
        calculated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO result_id;
    
    RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get metrics for a specific period
CREATE OR REPLACE FUNCTION get_metrics_for_period(
    p_bar_id UUID,
    p_metric_names TEXT[] DEFAULT NULL,
    p_period_type VARCHAR(20) DEFAULT 'day',
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW(),
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    metric_name TEXT,
    metric_type TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    value DECIMAL(15,4),
    count_value BIGINT,
    dimensions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.metric_name::TEXT,
        a.metric_type::TEXT,
        a.period_start,
        a.period_end,
        a.value,
        a.count_value,
        a.dimensions
    FROM analytics a
    WHERE 
        a.bar_id = p_bar_id
        AND (p_metric_names IS NULL OR a.metric_name = ANY(p_metric_names))
        AND a.period_type = p_period_type
        AND a.period_start >= p_start_date
        AND a.period_end <= p_end_date
        AND (p_user_id IS NULL OR a.user_id = p_user_id)
    ORDER BY a.period_start DESC, a.metric_name;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trending metrics
CREATE OR REPLACE FUNCTION get_trending_metrics(
    p_bar_id UUID,
    p_metric_type VARCHAR(50) DEFAULT NULL,
    p_days INTEGER DEFAULT 7,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    metric_name TEXT,
    current_value DECIMAL(15,4),
    previous_value DECIMAL(15,4),
    change_percentage DECIMAL(10,2),
    trend_direction TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            a.metric_name,
            SUM(a.value) as current_val
        FROM analytics a
        WHERE 
            a.bar_id = p_bar_id
            AND (p_metric_type IS NULL OR a.metric_type = p_metric_type)
            AND a.period_start >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY a.metric_name
    ),
    previous_period AS (
        SELECT 
            a.metric_name,
            SUM(a.value) as previous_val
        FROM analytics a
        WHERE 
            a.bar_id = p_bar_id
            AND (p_metric_type IS NULL OR a.metric_type = p_metric_type)
            AND a.period_start >= NOW() - (p_days * 2 || ' days')::INTERVAL
            AND a.period_start < NOW() - (p_days || ' days')::INTERVAL
        GROUP BY a.metric_name
    )
    SELECT 
        c.metric_name::TEXT,
        c.current_val,
        COALESCE(p.previous_val, 0) as previous_val,
        CASE 
            WHEN COALESCE(p.previous_val, 0) = 0 THEN 100.0
            ELSE ROUND(((c.current_val - COALESCE(p.previous_val, 0)) / COALESCE(p.previous_val, 1) * 100)::DECIMAL, 2)
        END as change_percentage,
        CASE 
            WHEN c.current_val > COALESCE(p.previous_val, 0) THEN 'up'
            WHEN c.current_val < COALESCE(p.previous_val, 0) THEN 'down'
            ELSE 'stable'
        END::TEXT as trend_direction
    FROM current_period c
    LEFT JOIN previous_period p ON c.metric_name = p.metric_name
    ORDER BY c.current_val DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analytics 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND period_type IN ('hour', 'day');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics TO authenticated;
GRANT SELECT ON daily_analytics TO authenticated;
GRANT SELECT ON weekly_analytics TO authenticated;
GRANT SELECT ON monthly_analytics TO authenticated;
GRANT SELECT ON realtime_analytics TO authenticated;
GRANT SELECT ON top_metrics_by_bar TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_analytics_metric(VARCHAR, VARCHAR, UUID, UUID, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, DECIMAL, BIGINT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_metrics_for_period(UUID, TEXT[], VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_metrics(UUID, VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_analytics(INTEGER) TO authenticated;

-- Grant read access to anonymous users for public analytics
GRANT SELECT ON daily_analytics TO anon;
GRANT SELECT ON weekly_analytics TO anon;
GRANT SELECT ON monthly_analytics TO anon;
GRANT EXECUTE ON FUNCTION get_metrics_for_period(UUID, TEXT[], VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO anon;

-- Create notification trigger for real-time updates
CREATE OR REPLACE FUNCTION notify_analytics_updated()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('analytics_updated', json_build_object(
        'metric_name', NEW.metric_name,
        'bar_id', NEW.bar_id,
        'period_type', NEW.period_type,
        'value', NEW.value,
        'calculated_at', NEW.calculated_at
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_analytics_updated_trigger
    AFTER INSERT OR UPDATE ON analytics
    FOR EACH ROW
    EXECUTE FUNCTION notify_analytics_updated();

-- =============================================================================
-- Migration Complete
-- =============================================================================