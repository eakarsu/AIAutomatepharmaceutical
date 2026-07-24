'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../db');

async function prepareRuntime() {
  if (process.env.MIGRATE_ON_START !== 'true') return;

  await pool.runMigrations();
  const email = process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin'`,
      ['Runtime Administrator', email.trim().toLowerCase(), passwordHash]
    );
  }
}

prepareRuntime()
  .catch((error) => {
    console.error(`Runtime preparation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
