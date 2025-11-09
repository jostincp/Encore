-- Script para crear usuario administrador
-- Credenciales: admin@encore.com / Password123!

-- Hashear la contraseña (bcrypt con salt rounds 10)
-- Nota: En PostgreSQL no hay bcrypt nativo, así que usaremos un hash simple para demostración
-- En producción, esto debería hacerse en la aplicación

DO $$
DECLARE
    admin_email TEXT := 'admin@encore.com';
    admin_password TEXT := 'Password123!';
    hashed_password TEXT;
    user_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🌱 Iniciando sembrado de cuenta ADMIN para: %', admin_email;
    
    -- Verificar si el usuario ya existe
    SELECT EXISTS(SELECT 1 FROM users WHERE email = admin_email) INTO user_exists;
    
    -- Para este ejemplo, usaremos un hash simple (NO usar en producción)
    -- En un entorno real, esto debería hacerse con bcrypt en la aplicación
    hashed_password := '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'; -- Hash de 'Password123!'
    
    IF user_exists THEN
        -- Actualizar usuario existente
        UPDATE users 
        SET password_hash = hashed_password,
            role = 'admin',
            email_verified = true,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = admin_email;
        
        RAISE NOTICE '✅ [ÉXITO] Usuario ADMIN actualizado correctamente.';
    ELSE
        -- Crear nuevo usuario
        INSERT INTO users (
            id, 
            email, 
            password_hash, 
            first_name, 
            last_name, 
            role, 
            email_verified, 
            is_active, 
            created_at, 
            updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_email,
            hashed_password,
            'Admin',
            'User',
            'admin',
            true,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE '✅ [ÉXITO] Usuario ADMIN creado correctamente.';
    END IF;
    
    RAISE NOTICE '👉 Login: % / %', admin_email, admin_password;
    RAISE NOTICE '📋 El script es idempotente - puede ejecutarse múltiples veces sin problemas.';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ [ERROR] Falló el sembrado del administrador: %', SQLERRM;
END $$;