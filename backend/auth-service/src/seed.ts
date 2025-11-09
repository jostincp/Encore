import { Pool } from 'pg';
import { UserRole } from './constants/roles';
import bcrypt from 'bcrypt';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno: primero monorepo root, luego service root como fallback
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Configuración de conexión a base de datos utilizando variables de entorno o defaults de docker-compose
let pool: Pool;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  pool = new Pool({ connectionString: databaseUrl });
} else {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbName = process.env.DB_NAME || 'encore_db';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'password';

  pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
  });
}

// Credenciales predeterminadas para el entorno de desarrollo
const ADMIN_EMAIL = 'admin@encore.com';
const ADMIN_PASSWORD = 'Password123!';

async function seedAdmin() {
  console.log(`🌱 Iniciando sembrado de cuenta ADMIN para: ${ADMIN_EMAIL}...`);

  const client = await pool.connect();

  try {
    // Asegurar extensión pgcrypto para gen_random_uuid (idempotente)
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    // 1. Hashear la contraseña para almacenamiento seguro
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

    // 2. Verificar si el usuario ya existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      // Actualizar usuario existente
      await client.query(
        'UPDATE users SET password_hash = $1, role = $2, email_verified = true, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE email = $3',
        [hashedPassword, UserRole.ADMIN, ADMIN_EMAIL]
      );
      console.log('✅ [ÉXITO] Usuario ADMIN actualizado correctamente.');
    } else {
      // Crear nuevo usuario
      await client.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [ADMIN_EMAIL, hashedPassword, 'Admin', 'User', UserRole.ADMIN]
      );
      console.log('✅ [ÉXITO] Usuario ADMIN creado correctamente.');
    }

    console.log(`👉 Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log('📋 El script es idempotente - puede ejecutarse múltiples veces sin problemas.');

  } catch (error) {
    console.error('❌ [ERROR] Falló el sembrado del administrador:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el sembrado
seedAdmin().then(() => {
  console.log('🎯 Proceso de sembrado completado.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error crítico:', error);
  process.exit(1);
});