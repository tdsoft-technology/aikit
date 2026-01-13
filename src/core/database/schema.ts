/**
 * Database schema for Figma data storage
 */
import { logger } from '../../utils/logger.js';

/**
 * Current database version
 */
export const DATABASE_VERSION = 1;

/**
 * SQL schema definitions
 */
export const SCHEMA_SQL = {
  // Files table - stores Figma file metadata
  figma_files: `
    CREATE TABLE IF NOT EXISTS figma_files (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      name TEXT,
      file_key TEXT NOT NULL,
      last_analyzed DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // Screens table - stores screen/frame information
  figma_screens: `
    CREATE TABLE IF NOT EXISTS figma_screens (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      name TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      type TEXT,
      description TEXT,
      children_count INTEGER,
      FOREIGN KEY (file_id) REFERENCES figma_files(id) ON DELETE CASCADE
    )
  `,

  // Nodes table - stores hierarchical component structure
  figma_nodes: `
    CREATE TABLE IF NOT EXISTS figma_nodes (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      screen_id TEXT,
      parent_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT,
      position_x REAL,
      position_y REAL,
      width REAL,
      height REAL,
      styles TEXT, -- JSON string
      children_ids TEXT, -- JSON string array
      FOREIGN KEY (file_id) REFERENCES figma_files(id) ON DELETE CASCADE,
      FOREIGN KEY (screen_id) REFERENCES figma_screens(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES figma_nodes(id) ON DELETE CASCADE
    )
  `,

  // Design tokens table - stores extracted design tokens
  design_tokens: `
    CREATE TABLE IF NOT EXISTS design_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'color', 'typography', 'spacing', 'component'
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT,
      FOREIGN KEY (file_id) REFERENCES figma_files(id) ON DELETE CASCADE
    )
  `,

  // Assets table - stores downloadable assets
  figma_assets: `
    CREATE TABLE IF NOT EXISTS figma_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      node_name TEXT,
      node_type TEXT,
      format TEXT, -- 'png', 'svg', 'jpg'
      file_path TEXT,
      url TEXT,
      width INTEGER,
      height INTEGER,
      FOREIGN KEY (file_id) REFERENCES figma_files(id) ON DELETE CASCADE
    )
  `,

  // Schema version tracking
  schema_version: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Index definitions for performance optimization
 */
export const INDEX_SQL = {
  // Files indexes
  idx_files_url: 'CREATE INDEX IF NOT EXISTS idx_files_url ON figma_files(url)',
  idx_files_file_key: 'CREATE INDEX IF NOT EXISTS idx_files_file_key ON figma_files(file_key)',
  idx_files_last_analyzed: 'CREATE INDEX IF NOT EXISTS idx_files_last_analyzed ON figma_files(last_analyzed)',

  // Screens indexes
  idx_screens_file_id: 'CREATE INDEX IF NOT EXISTS idx_screens_file_id ON figma_screens(file_id)',
  idx_screens_type: 'CREATE INDEX IF NOT EXISTS idx_screens_type ON figma_screens(type)',

  // Nodes indexes
  idx_nodes_file_id: 'CREATE INDEX IF NOT EXISTS idx_nodes_file_id ON figma_nodes(file_id)',
  idx_nodes_screen_id: 'CREATE INDEX IF NOT EXISTS idx_nodes_screen_id ON figma_nodes(screen_id)',
  idx_nodes_parent_id: 'CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON figma_nodes(parent_id)',
  idx_nodes_type: 'CREATE INDEX IF NOT EXISTS idx_nodes_type ON figma_nodes(type)',

  // Design tokens indexes
  idx_tokens_file_id: 'CREATE INDEX IF NOT EXISTS idx_tokens_file_id ON design_tokens(file_id)',
  idx_tokens_type: 'CREATE INDEX IF NOT EXISTS idx_tokens_type ON design_tokens(type)',
  idx_tokens_file_type: 'CREATE INDEX IF NOT EXISTS idx_tokens_file_type ON design_tokens(file_id, type)',

  // Assets indexes
  idx_assets_file_id: 'CREATE INDEX IF NOT EXISTS idx_assets_file_id ON figma_assets(file_id)',
  idx_assets_node_id: 'CREATE INDEX IF NOT EXISTS idx_assets_node_id ON figma_assets(node_id)',
  idx_assets_format: 'CREATE INDEX IF NOT EXISTS idx_assets_format ON figma_assets(format)',
};

/**
 * Trigger definitions for automatic timestamp updates
 */
export const TRIGGER_SQL = {
  // Update timestamp trigger for files table
  trigger_files_updated_at: `
    CREATE TRIGGER IF NOT EXISTS trigger_files_updated_at
    AFTER UPDATE ON figma_files
    FOR EACH ROW
    BEGIN
      UPDATE figma_files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `,
};

/**
 * Initialize database schema
 */
export function initializeSchema(db: any): void {
  try {
    logger.info('Initializing Figma database schema...');

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Use WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Create tables
    Object.entries(SCHEMA_SQL).forEach(([tableName, sql]) => {
      logger.debug(`Creating table: ${tableName}`);
      db.exec(sql);
    });

    // Create indexes
    Object.entries(INDEX_SQL).forEach(([indexName, sql]) => {
      logger.debug(`Creating index: ${indexName}`);
      db.exec(sql);
    });

    // Create triggers
    Object.entries(TRIGGER_SQL).forEach(([triggerName, sql]) => {
      logger.debug(`Creating trigger: ${triggerName}`);
      db.exec(sql);
    });

    // Set schema version
    const currentVersion = getCurrentSchemaVersion(db);
    if (currentVersion < DATABASE_VERSION) {
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(DATABASE_VERSION);
      logger.info(`Schema updated to version ${DATABASE_VERSION}`);
    }

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize database schema: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get current schema version
 */
export function getCurrentSchemaVersion(db: any): number {
  try {
    const result = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    return result?.version || 0;
  } catch {
    return 0;
  }
}

/**
 * Migration functions (for future schema changes)
 */
export const MIGRATIONS: Record<number, (db: any) => void> = {
  // Example migration (not needed for v1)
  // 2: (db: Database) => {
  //   db.exec('ALTER TABLE figma_files ADD COLUMN new_field TEXT');
  // }
};

/**
 * Run pending migrations
 */
export function runMigrations(db: any): void {
  const currentVersion = getCurrentSchemaVersion(db);
  
  Object.entries(MIGRATIONS)
    .map(([version, migration]) => ({ version: parseInt(version), migration }))
    .filter(({ version }) => version > currentVersion && version <= DATABASE_VERSION)
    .sort((a, b) => a.version - b.version)
    .forEach(({ version, migration }) => {
      logger.info(`Running migration to version ${version}`);
      migration(db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
    });
}