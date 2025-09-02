-- Migration: Create daily_specials table
-- Description: Table to store daily specials with validity periods
-- Created: 2024

-- Create daily_specials table
CREATE TABLE IF NOT EXISTS daily_specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL,
    menu_item_id UUID NOT NULL,
    special_price DECIMAL(10,2),
    description TEXT,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_daily_specials_bar_id 
        FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_specials_menu_item_id 
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT chk_daily_specials_special_price_positive 
        CHECK (special_price IS NULL OR special_price >= 0),
    CONSTRAINT chk_daily_specials_valid_period 
        CHECK (valid_until > valid_from),
    CONSTRAINT chk_daily_specials_description_length 
        CHECK (description IS NULL OR length(description) <= 500)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_specials_bar_id ON daily_specials(bar_id);
CREATE INDEX IF NOT EXISTS idx_daily_specials_menu_item_id ON daily_specials(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_daily_specials_valid_period ON daily_specials(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_daily_specials_active ON daily_specials(is_active);
CREATE INDEX IF NOT EXISTS idx_daily_specials_bar_active ON daily_specials(bar_id, is_active);

-- Create composite index for active specials within valid period
CREATE INDEX IF NOT EXISTS idx_daily_specials_active_valid 
    ON daily_specials(bar_id, is_active, valid_from, valid_until) 
    WHERE is_active = true;

-- Create unique constraint to prevent duplicate active specials for same menu item in overlapping periods
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_specials_unique_active_period 
    ON daily_specials(menu_item_id, valid_from, valid_until) 
    WHERE is_active = true;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_specials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_specials_updated_at
    BEFORE UPDATE ON daily_specials
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_specials_updated_at();

-- Add comments for documentation
COMMENT ON TABLE daily_specials IS 'Daily specials with validity periods for menu items';
COMMENT ON COLUMN daily_specials.id IS 'Unique identifier for the daily special';
COMMENT ON COLUMN daily_specials.bar_id IS 'Reference to the bar that owns this special';
COMMENT ON COLUMN daily_specials.menu_item_id IS 'Reference to the menu item on special';
COMMENT ON COLUMN daily_specials.special_price IS 'Special price for the item (optional, can use original price)';
COMMENT ON COLUMN daily_specials.description IS 'Special description or promotion details';
COMMENT ON COLUMN daily_specials.valid_from IS 'Start date and time when special becomes active';
COMMENT ON COLUMN daily_specials.valid_until IS 'End date and time when special expires';
COMMENT ON COLUMN daily_specials.is_active IS 'Whether the special is currently active (can be manually disabled)';
COMMENT ON COLUMN daily_specials.created_at IS 'Timestamp when the special was created';
COMMENT ON COLUMN daily_specials.updated_at IS 'Timestamp when the special was last updated';

-- Create a view for currently active specials
CREATE OR REPLACE VIEW active_daily_specials AS
SELECT 
    ds.*,
    mi.name as menu_item_name,
    mi.price as original_price,
    mi.image_url as menu_item_image,
    c.name as category_name
FROM daily_specials ds
JOIN menu_items mi ON ds.menu_item_id = mi.id
JOIN categories c ON mi.category_id = c.id
WHERE ds.is_active = true 
    AND ds.valid_from <= CURRENT_TIMESTAMP 
    AND ds.valid_until > CURRENT_TIMESTAMP
    AND mi.is_available = true;

COMMENT ON VIEW active_daily_specials IS 'View showing currently active daily specials with menu item details';

-- Grant permissions (adjust as needed for your application)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON daily_specials TO menu_service_user;
-- GRANT SELECT ON active_daily_specials TO menu_service_user;
-- GRANT USAGE ON SEQUENCE daily_specials_id_seq TO menu_service_user;