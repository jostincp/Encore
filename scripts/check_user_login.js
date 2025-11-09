// Script to check user record and validate password hash in Encore DB
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

(async () => {
  try {
    // Load monorepo root .env
    dotenv.config({ path: path.resolve(__dirname, '../.env') });

    const email = process.argv[2] || 'jostin02castillo@gmail.com';
    const password = process.argv[3] || 'Password123!';

    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 5432);
    const database = process.env.DB_NAME || 'encore_db';
    const user = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'password';

    const client = new Client({ host, port, database, user, password: dbPassword });
    await client.connect();

    const q = `SELECT id, email, role, is_active, password_hash, email_verified
               FROM users WHERE email = $1`;
    const res = await client.query(q, [email.toLowerCase()]);

    if (res.rows.length === 0) {
      console.log('User not found for email:', email);
      await client.end();
      process.exit(0);
    }

    const row = res.rows[0];
    const { id, role, is_active, password_hash, email_verified } = row;
    console.log('User:', { id, email: row.email, role, is_active, email_verified });
    console.log('Hash present:', Boolean(password_hash), 'Length:', password_hash ? password_hash.length : 0);

    // Validate role eligibility for login (bar_owner or admin)
    const allowedRoles = ['bar_owner', 'admin'];
    console.log('Role allowed for login:', allowedRoles.includes(role));

    // Validate password hash
    if (!password_hash) {
      console.log('No password_hash stored.');
    } else {
      const match = await bcrypt.compare(password, password_hash);
      console.log('Password matches hash:', match);
    }

    await client.end();
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err);
    process.exit(1);
  }
})();