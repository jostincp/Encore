import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// Configuración de conexión directa a PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'stackdb',
  user: 'stackuser',
  password: 'SuperSecurePassword123!',
});

// Credenciales predeterminadas para el entorno de desarrollo
const ADMIN_EMAIL = 'admin@encore.com';
const ADMIN_PASSWORD = 'Password123!';

async function seedAdmin() {
  console.log(`🌱 Iniciando sembrado de cuenta ADMIN para: ${ADMIN_EMAIL}...`);

  let client;
  try {
    // Obtener cliente de la pool
    client = await pool.connect();
    
    // 1. Hashear la contraseña para almacenamiento seguro
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    console.log('✅ Contraseña hasheada correctamente');

    // 2. Verificar si el usuario ya existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      // Actualizar usuario existente
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             role = $2, 
             email_verified = true, 
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $3`,
        [hashedPassword, 'admin', ADMIN_EMAIL]
      );
      console.log('✅ Usuario ADMIN actualizado correctamente');
    } else {
      // Crear nuevo usuario
      await client.query(
        `INSERT INTO users (
          id, email, password_hash, first_name, last_name, role, 
          email_verified, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        [ADMIN_EMAIL, hashedPassword, 'Admin', 'User', 'admin']
      );
      console.log('✅ Usuario ADMIN creado correctamente');
    }

    console.log('✅ [ÉXITO] Usuario ADMIN simulado correctamente.');
    console.log(`👉 Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log('📋 El script es idempotente - puede ejecutarse múltiples veces sin problemas.');

  } catch (error) {
    console.error('❌ [ERROR] Falló el sembrado del administrador:', error);
    process.exit(1);
  } finally {
    // Liberar cliente y cerrar pool
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Ejecutar el sembrado
seedAdmin();