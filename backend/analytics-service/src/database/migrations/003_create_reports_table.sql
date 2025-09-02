-- =============================================================================
-- Encore Analytics Service - Reports Table Migration
-- =============================================================================
-- Description: Creates the reports table for storing generated reports
-- Version: 1.0.0
-- Created: 2024-01-20
-- =============================================================================

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'json',
    bar_id UUID NOT NULL,
    user_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    schedule_type VARCHAR(20),
    schedule_config JSONB DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    data JSONB,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    generated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_name ON reports(name);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_format ON reports(format);
CREATE INDEX IF NOT EXISTS idx_reports_bar_id ON reports(bar_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_schedule_type ON reports(schedule_type) WHERE schedule_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_next_run_at ON reports(next_run_at) WHERE next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by) WHERE created_by IS NOT NULL;

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reports_bar_type_status ON reports(bar_id, type, status);
CREATE INDEX IF NOT EXISTS idx_reports_user_type_created ON reports(user_id, type, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status_next_run ON reports(status, next_run_at) WHERE next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_schedule_next_run ON reports(schedule_type, next_run_at) WHERE schedule_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_type_generated ON reports(type, generated_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_reports_schedule_config_gin ON reports USING GIN(schedule_config);
CREATE INDEX IF NOT EXISTS idx_reports_filters_gin ON reports USING GIN(filters);
CREATE INDEX IF NOT EXISTS idx_reports_parameters_gin ON reports USING GIN(parameters);
CREATE INDEX IF NOT EXISTS idx_reports_data_gin ON reports USING GIN(data) WHERE data IS NOT NULL;

-- Create partial indexes for specific statuses
CREATE INDEX IF NOT EXISTS idx_reports_pending ON reports(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reports_failed ON reports(created_at, retry_count) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_reports_scheduled ON reports(next_run_at) WHERE status = 'scheduled' AND next_run_at IS NOT NULL;

-- Add constraints
ALTER TABLE reports ADD CONSTRAINT chk_reports_status 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'scheduled', 'expired'));

ALTER TABLE reports ADD CONSTRAINT chk_reports_type 
    CHECK (type IN ('daily_summary', 'weekly_summary', 'monthly_summary', 'custom', 'music_analytics', 'menu_analytics', 'user_analytics', 'revenue_report', 'performance_report', 'trending_report'));

ALTER TABLE reports ADD CONSTRAINT chk_reports_format 
    CHECK (format IN ('json', 'csv', 'xlsx', 'pdf', 'html'));

ALTER TABLE reports ADD CONSTRAINT chk_reports_schedule_type 
    CHECK (schedule_type IS NULL OR schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'));

ALTER TABLE reports ADD CONSTRAINT chk_reports_retry_count 
    CHECK (retry_count >= 0 AND retry_count <= 5);

ALTER TABLE reports ADD CONSTRAINT chk_reports_name_not_empty 
    CHECK (LENGTH(TRIM(name)) > 0);

ALTER TABLE reports ADD CONSTRAINT chk_reports_file_size_positive 
    CHECK (file_size IS NULL OR file_size > 0);

ALTER TABLE reports ADD CONSTRAINT chk_reports_expires_after_generated 
    CHECK (expires_at IS NULL OR generated_at IS NULL OR expires_at > generated_at);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE reports IS 'Stores generated reports and report configurations for the Encore platform';
COMMENT ON COLUMN reports.id IS 'Unique identifier for the report';
COMMENT ON COLUMN reports.name IS 'Human-readable name of the report';
COMMENT ON COLUMN reports.description IS 'Detailed description of the report';
COMMENT ON COLUMN reports.type IS 'Type of report (daily_summary, music_analytics, etc.)';
COMMENT ON COLUMN reports.format IS 'Output format of the report (json, csv, xlsx, pdf, html)';
COMMENT ON COLUMN reports.bar_id IS 'ID of the bar this report belongs to';
COMMENT ON COLUMN reports.user_id IS 'ID of the user who requested the report (nullable for system reports)';
COMMENT ON COLUMN reports.status IS 'Current status of the report';
COMMENT ON COLUMN reports.schedule_type IS 'How often the report should be generated (nullable for one-time reports)';
COMMENT ON COLUMN reports.schedule_config IS 'Configuration for scheduled reports (cron expression, etc.)';
COMMENT ON COLUMN reports.filters IS 'Filters applied to the report data';
COMMENT ON COLUMN reports.parameters IS 'Additional parameters for report generation';
COMMENT ON COLUMN reports.data IS 'Generated report data (for small reports stored inline)';
COMMENT ON COLUMN reports.file_path IS 'Path to the generated report file (for large reports)';
COMMENT ON COLUMN reports.file_size IS 'Size of the generated report file in bytes';
COMMENT ON COLUMN reports.mime_type IS 'MIME type of the generated report file';
COMMENT ON COLUMN reports.generated_at IS 'When the report was successfully generated';
COMMENT ON COLUMN reports.expires_at IS 'When the report expires and can be deleted';
COMMENT ON COLUMN reports.error_message IS 'Error message if report generation failed';
COMMENT ON COLUMN reports.retry_count IS 'Number of retry attempts for failed reports';
COMMENT ON COLUMN reports.last_run_at IS 'When the report was last generated (for scheduled reports)';
COMMENT ON COLUMN reports.next_run_at IS 'When the report should be generated next (for scheduled reports)';
COMMENT ON COLUMN reports.created_by IS 'ID of the user who created the report configuration';
COMMENT ON COLUMN reports.created_at IS 'When the report record was created';
COMMENT ON COLUMN reports.updated_at IS 'When the report record was last updated';

-- Create views for common report queries

-- View for active scheduled reports
CREATE OR REPLACE VIEW scheduled_reports AS
SELECT 
    id,
    name,
    type,
    format,
    bar_id,
    schedule_type,
    schedule_config,
    filters,
    parameters,
    last_run_at,
    next_run_at,
    status,
    created_at
FROM reports
WHERE schedule_type IS NOT NULL 
    AND status IN ('scheduled', 'pending')
    AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY next_run_at ASC NULLS LAST;

-- View for recent reports
CREATE OR REPLACE VIEW recent_reports AS
SELECT 
    id,
    name,
    type,
    format,
    bar_id,
    user_id,
    status,
    generated_at,
    file_size,
    expires_at,
    created_at
FROM reports
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- View for failed reports that need retry
CREATE OR REPLACE VIEW failed_reports AS
SELECT 
    id,
    name,
    type,
    bar_id,
    status,
    error_message,
    retry_count,
    created_at,
    updated_at
FROM reports
WHERE status = 'failed' AND retry_count < 3
ORDER BY created_at ASC;

-- View for expired reports
CREATE OR REPLACE VIEW expired_reports AS
SELECT 
    id,
    name,
    type,
    bar_id,
    file_path,
    file_size,
    expires_at,
    generated_at
FROM reports
WHERE expires_at IS NOT NULL 
    AND expires_at <= NOW()
    AND status = 'completed'
ORDER BY expires_at ASC;

-- View for report statistics
CREATE OR REPLACE VIEW report_statistics AS
SELECT 
    type,
    format,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE schedule_type IS NOT NULL) as scheduled_count,
    AVG(EXTRACT(EPOCH FROM (generated_at - created_at))) as avg_generation_time_seconds,
    AVG(file_size) as avg_file_size_bytes,
    MIN(created_at) as first_report,
    MAX(created_at) as last_report
FROM reports
GROUP BY type, format
ORDER BY total_count DESC;

-- Create functions for report operations

-- Function to create a new report
CREATE OR REPLACE FUNCTION create_report(
    p_name VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_type VARCHAR(50),
    p_format VARCHAR(20) DEFAULT 'json',
    p_bar_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_schedule_type VARCHAR(20) DEFAULT NULL,
    p_schedule_config JSONB DEFAULT '{}',
    p_filters JSONB DEFAULT '{}',
    p_parameters JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    report_id UUID;
    next_run TIMESTAMPTZ;
BEGIN
    -- Calculate next run time for scheduled reports
    IF p_schedule_type IS NOT NULL THEN
        CASE p_schedule_type
            WHEN 'daily' THEN next_run := DATE_TRUNC('day', NOW()) + INTERVAL '1 day';
            WHEN 'weekly' THEN next_run := DATE_TRUNC('week', NOW()) + INTERVAL '1 week';
            WHEN 'monthly' THEN next_run := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
            WHEN 'quarterly' THEN next_run := DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months';
            WHEN 'yearly' THEN next_run := DATE_TRUNC('year', NOW()) + INTERVAL '1 year';
            ELSE next_run := NULL;
        END CASE;
    END IF;
    
    INSERT INTO reports (
        name, description, type, format, bar_id, user_id,
        schedule_type, schedule_config, filters, parameters,
        next_run_at, status, created_by
    ) VALUES (
        p_name, p_description, p_type, p_format, p_bar_id, p_user_id,
        p_schedule_type, p_schedule_config, p_filters, p_parameters,
        next_run, 
        CASE WHEN p_schedule_type IS NOT NULL THEN 'scheduled' ELSE 'pending' END,
        p_created_by
    )
    RETURNING id INTO report_id;
    
    RETURN report_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update report status and data
CREATE OR REPLACE FUNCTION update_report_status(
    p_report_id UUID,
    p_status VARCHAR(20),
    p_data JSONB DEFAULT NULL,
    p_file_path TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_mime_type VARCHAR(100) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    next_run TIMESTAMPTZ;
    schedule_type_val VARCHAR(20);
BEGIN
    -- Get schedule type for calculating next run
    SELECT schedule_type INTO schedule_type_val FROM reports WHERE id = p_report_id;
    
    -- Calculate next run time for completed scheduled reports
    IF p_status = 'completed' AND schedule_type_val IS NOT NULL THEN
        CASE schedule_type_val
            WHEN 'daily' THEN next_run := NOW() + INTERVAL '1 day';
            WHEN 'weekly' THEN next_run := NOW() + INTERVAL '1 week';
            WHEN 'monthly' THEN next_run := NOW() + INTERVAL '1 month';
            WHEN 'quarterly' THEN next_run := NOW() + INTERVAL '3 months';
            WHEN 'yearly' THEN next_run := NOW() + INTERVAL '1 year';
            ELSE next_run := NULL;
        END CASE;
    END IF;
    
    UPDATE reports SET
        status = p_status,
        data = COALESCE(p_data, data),
        file_path = COALESCE(p_file_path, file_path),
        file_size = COALESCE(p_file_size, file_size),
        mime_type = COALESCE(p_mime_type, mime_type),
        error_message = p_error_message,
        expires_at = COALESCE(p_expires_at, expires_at),
        generated_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE generated_at END,
        last_run_at = CASE WHEN p_status = 'completed' AND schedule_type_val IS NOT NULL THEN NOW() ELSE last_run_at END,
        next_run_at = CASE WHEN p_status = 'completed' AND schedule_type_val IS NOT NULL THEN next_run ELSE next_run_at END,
        retry_count = CASE WHEN p_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
        updated_at = NOW()
    WHERE id = p_report_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get reports due for generation
CREATE OR REPLACE FUNCTION get_reports_due_for_generation()
RETURNS TABLE(
    report_id UUID,
    name TEXT,
    type TEXT,
    format TEXT,
    bar_id UUID,
    filters JSONB,
    parameters JSONB,
    schedule_type TEXT,
    next_run_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name::TEXT,
        r.type::TEXT,
        r.format::TEXT,
        r.bar_id,
        r.filters,
        r.parameters,
        r.schedule_type::TEXT,
        r.next_run_at
    FROM reports r
    WHERE 
        r.status IN ('scheduled', 'pending')
        AND (r.next_run_at IS NULL OR r.next_run_at <= NOW())
        AND (r.expires_at IS NULL OR r.expires_at > NOW())
        AND r.retry_count < 3
    ORDER BY r.next_run_at ASC NULLS FIRST, r.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Update status of expired reports
    UPDATE reports 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at IS NOT NULL 
        AND expires_at <= NOW()
        AND status = 'completed';
    
    -- Delete old expired reports (older than 30 days)
    DELETE FROM reports 
    WHERE status = 'expired' 
        AND updated_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get report history for a bar
CREATE OR REPLACE FUNCTION get_report_history(
    p_bar_id UUID,
    p_report_types TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    report_id UUID,
    name TEXT,
    type TEXT,
    format TEXT,
    status TEXT,
    file_size BIGINT,
    generated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name::TEXT,
        r.type::TEXT,
        r.format::TEXT,
        r.status::TEXT,
        r.file_size,
        r.generated_at,
        r.expires_at,
        r.created_at
    FROM reports r
    WHERE 
        r.bar_id = p_bar_id
        AND (p_report_types IS NULL OR r.type = ANY(p_report_types))
    ORDER BY r.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO authenticated;
GRANT SELECT ON scheduled_reports TO authenticated;
GRANT SELECT ON recent_reports TO authenticated;
GRANT SELECT ON failed_reports TO authenticated;
GRANT SELECT ON expired_reports TO authenticated;
GRANT SELECT ON report_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION create_report(VARCHAR, TEXT, VARCHAR, VARCHAR, UUID, UUID, VARCHAR, JSONB, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_report_status(UUID, VARCHAR, JSONB, TEXT, BIGINT, VARCHAR, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reports_due_for_generation() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_history(UUID, TEXT[], INTEGER, INTEGER) TO authenticated;

-- Grant read access to anonymous users for public report statistics
GRANT SELECT ON report_statistics TO anon;

-- Create notification trigger for real-time updates
CREATE OR REPLACE FUNCTION notify_report_status_changed()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify on status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM pg_notify('report_status_changed', json_build_object(
            'report_id', NEW.id,
            'name', NEW.name,
            'type', NEW.type,
            'bar_id', NEW.bar_id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'generated_at', NEW.generated_at
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_report_status_changed_trigger
    AFTER UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION notify_report_status_changed();

-- Create trigger for new report notifications
CREATE OR REPLACE FUNCTION notify_report_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('report_created', json_build_object(
        'report_id', NEW.id,
        'name', NEW.name,
        'type', NEW.type,
        'bar_id', NEW.bar_id,
        'schedule_type', NEW.schedule_type,
        'created_at', NEW.created_at
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_report_created_trigger
    AFTER INSERT ON reports
    FOR EACH ROW
    EXECUTE FUNCTION notify_report_created();

-- =============================================================================
-- Migration Complete
-- =============================================================================