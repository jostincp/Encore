-- Inicialización de tabla de usuarios para el servicio de autenticación
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
role VARCHAR(50) NOT NULL DEFAULT 'user',
    phone VARCHAR(20),
    avatar_url TEXT,
    bar_id UUID,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_bar_id ON users(bar_id);

-- Función para actualizar el timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE users IS 'Tabla de usuarios para el sistema de autenticación de Encore';
COMMENT ON COLUMN users.id IS 'Identificador único del usuario';
COMMENT ON COLUMN users.email IS 'Correo electrónico único del usuario';
COMMENT ON COLUMN users.password_hash IS 'Hash de la contraseña del usuario';
COMMENT ON COLUMN users.first_name IS 'Nombre del usuario';
COMMENT ON COLUMN users.last_name IS 'Apellido del usuario';
COMMENT ON COLUMN users.role IS 'Rol del usuario (guest, user, staff, bar_owner, admin)';
COMMENT ON COLUMN users.phone IS 'Teléfono del usuario';
COMMENT ON COLUMN users.avatar_url IS 'URL del avatar del usuario';
COMMENT ON COLUMN users.bar_id IS 'ID del bar asociado al usuario (para bar_owner)';
COMMENT ON COLUMN users.is_active IS 'Indica si el usuario está activo';
COMMENT ON COLUMN users.email_verified IS 'Indica si el email del usuario está verificado';
COMMENT ON COLUMN users.created_at IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN users.updated_at IS 'Fecha y hora de última actualización del registro';