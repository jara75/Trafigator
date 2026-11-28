import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

if (!process.env.IS_TEST) {
  try {
    (process as any).loadEnvFile?.();
  } catch (_) {}
}

const dbPath = process.env.TRAFICO_DB_PATH || './trafico.db';
export const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function initDatabaseAndSeed() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      logo TEXT,
      created_at INTEGER NOT NULL,
      metadata TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      subscription_status TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      short_name TEXT,
      color TEXT NOT NULL DEFAULT 'cyan',
      avatar_mode TEXT NOT NULL DEFAULT 'initials',
      avatar_icon TEXT NOT NULL DEFAULT 'pen',
      departments TEXT NOT NULL DEFAULT '["Cuentas","Tráfico","Creativos"]',
      phone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_organization_id TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      allowed_client_id TEXT NOT NULL DEFAULT '*',
      status TEXT NOT NULL DEFAULT 'active',
      role_title TEXT NOT NULL DEFAULT 'Creativo',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT,
      allowed_client_id TEXT NOT NULL DEFAULT '*',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'emerald',
      brands_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'amber',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      parent_ot_id TEXT,
      ref TEXT NOT NULL DEFAULT '',
      discipline TEXT NOT NULL DEFAULT 'advertising',
      client TEXT NOT NULL,
      brand TEXT NOT NULL,
      product TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      media TEXT NOT NULL DEFAULT '',
      responsible_dept TEXT NOT NULL DEFAULT 'Tráfico',
      ot_status TEXT NOT NULL DEFAULT 'Abierta',
      sign TEXT NOT NULL DEFAULT '',
      urgent INTEGER NOT NULL DEFAULT 0,
      brief TEXT NOT NULL DEFAULT '',
      legal_text TEXT NOT NULL DEFAULT '',
      reopen_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS route_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT,
      ot_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      line_number INTEGER NOT NULL DEFAULT 1,
      from_dept TEXT NOT NULL DEFAULT 'Cuentas',
      to_dept TEXT NOT NULL DEFAULT 'Creativos',
      task TEXT NOT NULL DEFAULT '',
      entry_date TEXT NOT NULL,
      delivery_date TEXT NOT NULL DEFAULT '',
      sign TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      stamp TEXT,
      locked INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      ot_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      route_entry_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'document',
      ext TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      url TEXT NOT NULL,
      preview_url TEXT,
      preview_kind TEXT,
      content TEXT,
      version_group_id TEXT,
      version_number INTEGER NOT NULL DEFAULT 1,
      review_status TEXT NOT NULL DEFAULT 'draft'
    );
    CREATE TABLE IF NOT EXISTS stripboard_strips (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      user_id TEXT,
      date_str TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'ot',
      ot_id TEXT,
      title TEXT,
      client TEXT,
      brand TEXT,
      product TEXT,
      time_slot TEXT,
      task TEXT,
      assignee TEXT,
      shift_status TEXT NOT NULL DEFAULT 'Por Iniciar'
    );
    CREATE TABLE IF NOT EXISTS shared_reviews (
      token TEXT PRIMARY KEY,
      organization_id TEXT,
      ot_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      media_file_id TEXT,
      route_entry_ids_json TEXT NOT NULL DEFAULT '[]',
      allow_full_ot INTEGER NOT NULL DEFAULT 1,
      reviewer_label TEXT DEFAULT 'Cliente',
      expires_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_threads (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      media_file_id TEXT NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
      pin_number INTEGER NOT NULL,
      x_percent REAL NOT NULL,
      y_percent REAL NOT NULL,
      page_number INTEGER NOT NULL DEFAULT 1,
      pin_color TEXT NOT NULL DEFAULT 'amber',
      is_resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by_name TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_messages (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      media_file_id TEXT NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
      thread_id TEXT REFERENCES review_threads(id) ON DELETE CASCADE,
      author_user_id TEXT,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL DEFAULT 'client',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const safeAlter = (sql: string) => {
    try {
      sqlite.exec(sql);
    } catch (_) {}
  };

  safeAlter("ALTER TABLE organizations ADD COLUMN status TEXT DEFAULT 'active'");
  safeAlter("ALTER TABLE organizations ADD COLUMN subscription_status TEXT DEFAULT 'trialing'");
  safeAlter("ALTER TABLE organizations ADD COLUMN trial_ends_at INTEGER");
  safeAlter("ALTER TABLE members ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  safeAlter("ALTER TABLE members ADD COLUMN role_title TEXT NOT NULL DEFAULT 'Creativo'");
  safeAlter("ALTER TABLE members ADD COLUMN allowed_client_id TEXT NOT NULL DEFAULT '*'");
  safeAlter("ALTER TABLE invitations ADD COLUMN allowed_client_id TEXT NOT NULL DEFAULT '*'");
  safeAlter("ALTER TABLE clients ADD COLUMN color TEXT DEFAULT 'emerald'");
  safeAlter("ALTER TABLE sessions ADD COLUMN active_organization_id TEXT");
  safeAlter("ALTER TABLE users ADD COLUMN short_name TEXT");
  safeAlter("ALTER TABLE users ADD COLUMN color TEXT DEFAULT 'cyan'");
  safeAlter("ALTER TABLE users ADD COLUMN avatar_mode TEXT DEFAULT 'initials'");
  safeAlter("ALTER TABLE users ADD COLUMN avatar_icon TEXT DEFAULT 'pen'");
  safeAlter("ALTER TABLE users ADD COLUMN departments TEXT DEFAULT '[\"Cuentas\",\"Tráfico\",\"Creativos\"]'");
  safeAlter("ALTER TABLE users ADD COLUMN phone TEXT");
  safeAlter("ALTER TABLE clients ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE statuses ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE work_orders ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE work_orders ADD COLUMN parent_ot_id TEXT");
  try {
    const woCols = sqlite.prepare("PRAGMA table_info(work_orders)").all() as Array<{ name: string }>;
    const hasResponsible = woCols.some((c) => c.name === 'responsible');
    const hasSign = woCols.some((c) => c.name === 'sign');
    if (hasResponsible && !hasSign) {
      sqlite.exec("ALTER TABLE work_orders RENAME COLUMN responsible TO sign");
    } else if (!hasSign) {
      safeAlter("ALTER TABLE work_orders ADD COLUMN sign TEXT DEFAULT ''");
    }

    const hasOldStatus = woCols.some((c) => c.name === 'status');
    const hasResponsibleDept = woCols.some((c) => c.name === 'responsible_dept');
    const hasOtStatus = woCols.some((c) => c.name === 'ot_status');
    if (!hasResponsibleDept) {
      safeAlter("ALTER TABLE work_orders ADD COLUMN responsible_dept TEXT NOT NULL DEFAULT 'Tráfico'");
    }
    if (!hasOtStatus) {
      safeAlter("ALTER TABLE work_orders ADD COLUMN ot_status TEXT NOT NULL DEFAULT 'Abierta'");
    }
    if (hasOldStatus && (!hasResponsibleDept || !hasOtStatus)) {
      sqlite.exec(`
        UPDATE work_orders
        SET ot_status = status,
            responsible_dept = COALESCE(
              (SELECT to_dept FROM route_entries WHERE ot_id = work_orders.id ORDER BY line_number DESC, id DESC LIMIT 1),
              'Tráfico'
            )
        WHERE status IN ('Cerrado', 'Cancelado', 'Archivada', 'Aprobado');
      `);
      sqlite.exec(`
        UPDATE work_orders
        SET responsible_dept = CASE WHEN trim(COALESCE(status, '')) != '' THEN status ELSE 'Tráfico' END,
            ot_status = 'Abierta'
        WHERE status NOT IN ('Cerrado', 'Cancelado', 'Archivada', 'Aprobado') OR status IS NULL;
      `);
      safeAlter("ALTER TABLE work_orders DROP COLUMN status");
    }
  } catch (err) {
    console.warn('Error migrando work_orders:', err);
  }
  safeAlter("ALTER TABLE work_orders ADD COLUMN reopen_reason TEXT");
  safeAlter("ALTER TABLE route_entries ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE route_entries ADD COLUMN sign TEXT DEFAULT ''");
  safeAlter("ALTER TABLE route_entries ADD COLUMN notes TEXT DEFAULT ''");
  try {
    const reCols = sqlite.prepare("PRAGMA table_info(route_entries)").all() as Array<{ name: string }>;
    const hasCompleted = reCols.some((c) => c.name === 'completed');
    const hasLocked = reCols.some((c) => c.name === 'locked');
    if (hasCompleted && !hasLocked) {
      sqlite.exec("ALTER TABLE route_entries RENAME COLUMN completed TO locked");
    } else if (!hasLocked) {
      safeAlter("ALTER TABLE route_entries ADD COLUMN locked INTEGER NOT NULL DEFAULT 0");
    }
    safeAlter("ALTER TABLE route_entries ADD COLUMN created_by_user_id TEXT");
    sqlite.exec(`
      UPDATE route_entries
      SET locked = 1
      WHERE id NOT IN (
        SELECT r1.id
        FROM route_entries r1
        WHERE r1.line_number = (
          SELECT MAX(r2.line_number) FROM route_entries r2 WHERE r2.ot_id = r1.ot_id
        )
        AND r1.id = (
          SELECT MAX(r3.id) FROM route_entries r3 WHERE r3.ot_id = r1.ot_id AND r3.line_number = r1.line_number
        )
      );
    `);
  } catch (err) {
    console.warn('Error migrando route_entries:', err);
  }
  safeAlter("ALTER TABLE media_files ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE media_files ADD COLUMN version_group_id TEXT");
  safeAlter("ALTER TABLE review_threads ADD COLUMN pin_color TEXT NOT NULL DEFAULT 'teal'");
  safeAlter("ALTER TABLE media_files ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1");
  safeAlter("ALTER TABLE media_files ADD COLUMN review_status TEXT NOT NULL DEFAULT 'draft'");
  safeAlter("ALTER TABLE stripboard_strips ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE stripboard_strips ADD COLUMN user_id TEXT");
  safeAlter("ALTER TABLE shared_reviews ADD COLUMN organization_id TEXT");
  safeAlter("ALTER TABLE shared_reviews ADD COLUMN media_file_id TEXT");

  safeAlter(`
    CREATE TRIGGER IF NOT EXISTS trg_org_trial_ends_at
    AFTER INSERT ON organizations
    WHEN NEW.trial_ends_at IS NULL
    BEGIN
      UPDATE organizations 
      SET trial_ends_at = CAST(strftime('%s', 'now') AS INTEGER) + (14 * 86400)
      WHERE id = NEW.id;
    END;
  `);

  safeAlter(`
    CREATE TRIGGER IF NOT EXISTS trg_user_short_name
    AFTER INSERT ON users
    WHEN NEW.short_name IS NULL OR NEW.short_name = '' OR NEW.short_name = 'Andrés J.'
    BEGIN
      UPDATE users 
      SET short_name = CASE 
        WHEN instr(trim(NEW.name), ' ') > 0 THEN 
          substr(trim(NEW.name), 1, instr(trim(NEW.name), ' ') - 1) || ' ' || upper(substr(ltrim(substr(trim(NEW.name), instr(trim(NEW.name), ' ') + 1)), 1, 1)) || '.'
        ELSE trim(NEW.name)
      END
      WHERE id = NEW.id AND LOWER(NEW.name) NOT LIKE '%andrés%';
    END;
  `);

  try {
    sqlite.exec(`
      UPDATE users 
      SET short_name = CASE 
        WHEN instr(trim(name), ' ') > 0 THEN 
          substr(trim(name), 1, instr(trim(name), ' ') - 1) || ' ' || upper(substr(ltrim(substr(trim(name), instr(trim(name), ' ') + 1)), 1, 1)) || '.' 
        ELSE trim(name) 
      END 
      WHERE (short_name = 'Andrés J.' OR short_name IS NULL OR short_name = '') 
        AND LOWER(name) NOT LIKE '%andrés%';
    `);
  } catch (_) {}
}
