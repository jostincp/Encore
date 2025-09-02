-- Encore Database Schema
-- Initial migration for all microservices

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Authentication Service)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'bar_admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bars table
CREATE TABLE bars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website_url TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bar settings table
CREATE TABLE bar_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    max_songs_per_user INTEGER DEFAULT 3,
    song_request_cost INTEGER DEFAULT 100, -- in points
    priority_play_cost INTEGER DEFAULT 500, -- in points
    auto_approve_songs BOOLEAN DEFAULT false,
    allow_explicit_content BOOLEAN DEFAULT true,
    max_queue_size INTEGER DEFAULT 50,
    points_per_euro INTEGER DEFAULT 100,
    welcome_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bar_id)
);

-- Tables in bars
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    qr_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_capacity INTEGER DEFAULT 6,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bar_id, table_number)
);

-- Table sessions (for anonymous users)
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    points_balance INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Songs table (Music Service)
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) NOT NULL, -- YouTube/Spotify ID
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('youtube', 'spotify')),
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album VARCHAR(500),
    duration INTEGER NOT NULL, -- in seconds
    thumbnail_url TEXT,
    preview_url TEXT,
    external_url TEXT NOT NULL,
    is_explicit BOOLEAN DEFAULT false,
    genre VARCHAR(100),
    release_date DATE,
    popularity_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(external_id, platform)
);

-- Queue table (Queue Service)
CREATE TABLE queue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    requester_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'playing', 'played', 'skipped')),
    is_priority BOOLEAN DEFAULT false,
    position INTEGER NOT NULL,
    points_spent INTEGER DEFAULT 0,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    played_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK ((user_id IS NOT NULL) OR (table_session_id IS NOT NULL))
);

-- Menu categories
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Menu items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    allergens TEXT[], -- Array of allergen strings
    preparation_time INTEGER, -- in minutes
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    customer_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'points')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    special_instructions TEXT,
    estimated_ready_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK ((user_id IS NOT NULL) OR (table_session_id IS NOT NULL))
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Points transactions (Points Service)
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'refund', 'bonus', 'penalty')),
    amount INTEGER NOT NULL, -- positive for credits, negative for debits
    description TEXT NOT NULL,
    reference_id UUID, -- Reference to order, queue_item, etc.
    reference_type VARCHAR(50), -- 'order', 'song_request', 'priority_play', etc.
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK ((user_id IS NOT NULL) OR (table_session_id IS NOT NULL))
);

-- Analytics events (Analytics Service)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_bars_owner_id ON bars(owner_id);
CREATE INDEX idx_bars_is_active ON bars(is_active);
CREATE INDEX idx_tables_bar_id ON tables(bar_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code);
CREATE INDEX idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX idx_table_sessions_token ON table_sessions(session_token);
CREATE INDEX idx_table_sessions_expires_at ON table_sessions(expires_at);
CREATE INDEX idx_songs_external_id_platform ON songs(external_id, platform);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_artist ON songs(artist);
CREATE INDEX idx_queue_items_bar_id ON queue_items(bar_id);
CREATE INDEX idx_queue_items_status ON queue_items(status);
CREATE INDEX idx_queue_items_position ON queue_items(position);
CREATE INDEX idx_queue_items_requested_at ON queue_items(requested_at);
CREATE INDEX idx_menu_items_bar_id ON menu_items(bar_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX idx_orders_bar_id ON orders(bar_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_points_transactions_bar_id ON points_transactions(bar_id);
CREATE INDEX idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX idx_points_transactions_table_session_id ON points_transactions(table_session_id);
CREATE INDEX idx_points_transactions_created_at ON points_transactions(created_at);
CREATE INDEX idx_analytics_events_bar_id ON analytics_events(bar_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bars_updated_at BEFORE UPDATE ON bars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bar_settings_updated_at BEFORE UPDATE ON bar_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_table_sessions_updated_at BEFORE UPDATE ON table_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_queue_items_updated_at BEFORE UPDATE ON queue_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for development
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@encore.com', '$2b$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQ', 'Admin', 'User', 'super_admin', true),
('550e8400-e29b-41d4-a716-446655440001', 'bar@example.com', '$2b$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQ', 'Bar', 'Owner', 'bar_admin', true),
('550e8400-e29b-41d4-a716-446655440002', 'customer@example.com', '$2b$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQ', 'John', 'Doe', 'customer', true);

INSERT INTO bars (id, name, description, address, city, country, owner_id) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'The Music Lounge', 'A cozy bar with great music and atmosphere', '123 Music Street', 'Barcelona', 'Spain', '550e8400-e29b-41d4-a716-446655440001');

INSERT INTO bar_settings (bar_id) VALUES
('660e8400-e29b-41d4-a716-446655440000');

INSERT INTO tables (bar_id, table_number, qr_code) VALUES
('660e8400-e29b-41d4-a716-446655440000', 1, 'QR_TABLE_001'),
('660e8400-e29b-41d4-a716-446655440000', 2, 'QR_TABLE_002'),
('660e8400-e29b-41d4-a716-446655440000', 3, 'QR_TABLE_003');

INSERT INTO menu_categories (bar_id, name, description, display_order) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Bebidas', 'Refrescos, cervezas y cócteles', 1),
('660e8400-e29b-41d4-a716-446655440000', 'Comida', 'Tapas y platos principales', 2);

INSERT INTO menu_items (bar_id, category_id, name, description, price, is_available) VALUES
('660e8400-e29b-41d4-a716-446655440000', (SELECT id FROM menu_categories WHERE name = 'Bebidas' LIMIT 1), 'Cerveza Estrella', 'Cerveza nacional 33cl', 3.50, true),
('660e8400-e29b-41d4-a716-446655440000', (SELECT id FROM menu_categories WHERE name = 'Bebidas' LIMIT 1), 'Mojito', 'Cóctel clásico con ron, menta y lima', 8.00, true),
('660e8400-e29b-41d4-a716-446655440000', (SELECT id FROM menu_categories WHERE name = 'Comida' LIMIT 1), 'Patatas Bravas', 'Patatas fritas con salsa brava', 5.50, true);