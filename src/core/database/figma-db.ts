/**
 * Figma Database Manager
 * SQLite-based persistent storage for Figma design data
 */
import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import { initializeSchema } from './schema.js';
import {
  FigmaDatabase as FigmaDatabaseInterface,
  FigmaFileRecord,
  FigmaScreenRecord,
  FigmaNodeRecord,
  DesignTokenRecord,
  FigmaAssetRecord,
  UpsertResult,
  QueryOptions
} from './types.js';

/**
 * SQLite-based Figma database implementation
 */
export class FigmaDatabase implements FigmaDatabaseInterface {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    try {
      // Create database connection
      this.db = new Database(dbPath);
      
      // Initialize schema
      initializeSchema(this.db);
      
      logger.info(`Figma database initialized at: ${dbPath}`);
    } catch (error) {
      logger.error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Export database data to JSON
   */
  async exportData(fileId?: string): Promise<{
    files: FigmaFileRecord[];
    screens: FigmaScreenRecord[];
    nodes: FigmaNodeRecord[];
    tokens: DesignTokenRecord[];
    assets: FigmaAssetRecord[];
    exported_at: string;
  }> {
    try {
      const files = fileId ? [await this.getFile(fileId)].filter(Boolean) as FigmaFileRecord[] : await this.listFiles();
      const fileIds = files.map(f => f.id);
      
      let screens: FigmaScreenRecord[] = [];
      let nodes: FigmaNodeRecord[] = [];
      let tokens: DesignTokenRecord[] = [];
      let assets: FigmaAssetRecord[] = [];
      
      for (const fId of fileIds) {
        screens.push(...await this.getScreensByFile(fId));
        nodes.push(...await this.getNodesByFile(fId));
        tokens.push(...await this.getDesignTokensByFile(fId));
        assets.push(...await this.getAssetsByFile(fId));
      }
      
      return {
        files,
        screens,
        nodes,
        tokens,
        assets,
        exported_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Import database data from JSON
   */
  async importData(data: {
    files: FigmaFileRecord[];
    screens: FigmaScreenRecord[];
    nodes: FigmaNodeRecord[];
    tokens: DesignTokenRecord[];
    assets: FigmaAssetRecord[];
  }): Promise<{
    files: number;
    screens: number;
    nodes: number;
    tokens: number;
    assets: number;
  }> {
    try {
      const stats = { files: 0, screens: 0, nodes: 0, tokens: 0, assets: 0 };
      
      // Import files first (they're referenced by other tables)
      for (const file of data.files) {
        await this.upsertFile(file);
        stats.files++;
      }
      
      // Import screens
      for (const screen of data.screens) {
        await this.upsertScreen(screen);
        stats.screens++;
      }
      
      // Import nodes
      for (const node of data.nodes) {
        await this.upsertNode(node);
        stats.nodes++;
      }
      
      // Import tokens
      for (const token of data.tokens) {
        await this.upsertDesignToken(token);
        stats.tokens++;
      }
      
      // Import assets
      for (const asset of data.assets) {
        await this.upsertAsset(asset);
        stats.assets++;
      }
      
      logger.info(`Imported ${stats.files} files, ${stats.screens} screens, ${stats.nodes} nodes, ${stats.tokens} tokens, ${stats.assets} assets`);
      return stats;
    } catch (error) {
      logger.error(`Failed to import data: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Utility Operations
   */
  async upsertFile(file: Omit<FigmaFileRecord, 'created_at' | 'updated_at'>): Promise<UpsertResult> {
    try {
      // Convert Date to ISO string for SQLite
      const lastAnalyzed = file.last_analyzed instanceof Date 
        ? file.last_analyzed.toISOString() 
        : file.last_analyzed || null;
      
      // Check if file exists
      const existing = this.db.prepare('SELECT id FROM figma_files WHERE id = ?').get(file.id) as { id: string } | undefined;
      
      if (existing) {
        // Update existing file
        this.db.prepare(`
          UPDATE figma_files 
          SET url = ?, name = ?, file_key = ?, last_analyzed = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(file.url, file.name || null, file.file_key, lastAnalyzed, file.id);
        
        return { id: file.id, created: false, updated: true };
      } else {
        // Insert new file
        this.db.prepare(`
          INSERT INTO figma_files (id, url, name, file_key, last_analyzed)
          VALUES (?, ?, ?, ?, ?)
        `).run(file.id, file.url, file.name || null, file.file_key, lastAnalyzed);
        
        return { id: file.id, created: true, updated: false };
      }
    } catch (error) {
      logger.error(`Failed to upsert file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getFile(id: string): Promise<FigmaFileRecord | null> {
    try {
      const row = this.db.prepare('SELECT * FROM figma_files WHERE id = ?').get(id) as any;
      if (!row) return null;
      
      return {
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        last_analyzed: row.last_analyzed ? new Date(row.last_analyzed) : undefined
      };
    } catch (error) {
      logger.error(`Failed to get file: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getFileByUrl(url: string): Promise<FigmaFileRecord | null> {
    try {
      const row = this.db.prepare('SELECT * FROM figma_files WHERE url = ?').get(url) as any;
      if (!row) return null;
      
      return {
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        last_analyzed: row.last_analyzed ? new Date(row.last_analyzed) : undefined
      };
    } catch (error) {
      logger.error(`Failed to get file by URL: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM figma_files WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async listFiles(options?: QueryOptions): Promise<FigmaFileRecord[]> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const orderBy = options?.orderBy || 'updated_at';
      const orderDirection = options?.orderDirection || 'DESC';
      
      const query = `
        SELECT * FROM figma_files 
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT ? OFFSET ?
      `;
      
      const rows = this.db.prepare(query).all(limit, offset) as any[];
      
      return rows.map(row => ({
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        last_analyzed: row.last_analyzed ? new Date(row.last_analyzed) : undefined
      }));
    } catch (error) {
      logger.error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Screen Operations
   */
  async upsertScreen(screen: FigmaScreenRecord): Promise<UpsertResult> {
    try {
      const existing = this.db.prepare('SELECT id FROM figma_screens WHERE id = ?').get(screen.id) as { id: string } | undefined;
      
      if (existing) {
        this.db.prepare(`
          UPDATE figma_screens 
          SET file_id = ?, name = ?, width = ?, height = ?, type = ?, description = ?, children_count = ?
          WHERE id = ?
        `).run(screen.file_id, screen.name, screen.width || null, screen.height || null, 
               screen.type || null, screen.description || null, screen.children_count || null, screen.id);
        
        return { id: screen.id, created: false, updated: true };
      } else {
        this.db.prepare(`
          INSERT INTO figma_screens (id, file_id, name, width, height, type, description, children_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(screen.id, screen.file_id, screen.name, screen.width || null, screen.height || null, 
               screen.type || null, screen.description || null, screen.children_count || null);
        
        return { id: screen.id, created: true, updated: false };
      }
    } catch (error) {
      logger.error(`Failed to upsert screen: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getScreen(id: string): Promise<FigmaScreenRecord | null> {
    try {
      const row = this.db.prepare('SELECT * FROM figma_screens WHERE id = ?').get(id) as FigmaScreenRecord | undefined;
      return row || null;
    } catch (error) {
      logger.error(`Failed to get screen: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getScreensByFile(fileId: string): Promise<FigmaScreenRecord[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM figma_screens WHERE file_id = ? ORDER BY name').all(fileId) as FigmaScreenRecord[];
      return rows;
    } catch (error) {
      logger.error(`Failed to get screens by file: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteScreen(id: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM figma_screens WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete screen: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Node Operations
   */
  async upsertNode(node: FigmaNodeRecord): Promise<UpsertResult> {
    try {
      const existing = this.db.prepare('SELECT id FROM figma_nodes WHERE id = ?').get(node.id) as { id: string } | undefined;
      
      if (existing) {
        this.db.prepare(`
          UPDATE figma_nodes 
          SET file_id = ?, screen_id = ?, parent_id = ?, name = ?, type = ?, content = ?,
              position_x = ?, position_y = ?, width = ?, height = ?, styles = ?, children_ids = ?
          WHERE id = ?
        `).run(
          node.file_id, node.screen_id || null, node.parent_id || null, node.name, node.type,
          node.content || null, node.position_x || null, node.position_y || null,
          node.width || null, node.height || null, node.styles || null, node.children_ids || null, node.id
        );
        
        return { id: node.id, created: false, updated: true };
      } else {
        this.db.prepare(`
          INSERT INTO figma_nodes (id, file_id, screen_id, parent_id, name, type, content, 
                                   position_x, position_y, width, height, styles, children_ids)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          node.id, node.file_id, node.screen_id || null, node.parent_id || null, node.name, node.type,
          node.content || null, node.position_x || null, node.position_y || null,
          node.width || null, node.height || null, node.styles || null, node.children_ids || null
        );
        
        return { id: node.id, created: true, updated: false };
      }
    } catch (error) {
      logger.error(`Failed to upsert node: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getNode(id: string): Promise<FigmaNodeRecord | null> {
    try {
      const row = this.db.prepare('SELECT * FROM figma_nodes WHERE id = ?').get(id) as FigmaNodeRecord | undefined;
      return row || null;
    } catch (error) {
      logger.error(`Failed to get node: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getNodesByScreen(screenId: string): Promise<FigmaNodeRecord[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM figma_nodes WHERE screen_id = ? ORDER BY name').all(screenId) as FigmaNodeRecord[];
      return rows;
    } catch (error) {
      logger.error(`Failed to get nodes by screen: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async getNodesByFile(fileId: string): Promise<FigmaNodeRecord[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM figma_nodes WHERE file_id = ? ORDER BY name').all(fileId) as FigmaNodeRecord[];
      return rows;
    } catch (error) {
      logger.error(`Failed to get nodes by file: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteNode(id: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM figma_nodes WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete node: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Design Token Operations
   */
  async upsertDesignToken(token: Omit<DesignTokenRecord, 'id'>): Promise<UpsertResult> {
    try {
      // Check if token exists (match by file_id, type, and name)
      const existing = this.db.prepare(`
        SELECT id FROM design_tokens 
        WHERE file_id = ? AND type = ? AND name = ?
      `).get(token.file_id, token.type, token.name) as { id: number } | undefined;
      
      if (existing) {
        this.db.prepare(`
          UPDATE design_tokens 
          SET value = ?, category = ?
          WHERE id = ?
        `).run(token.value, token.category || null, existing.id);
        
        return { id: existing.id.toString(), created: false, updated: true };
      } else {
        const result = this.db.prepare(`
          INSERT INTO design_tokens (file_id, type, name, value, category)
          VALUES (?, ?, ?, ?, ?)
        `).run(token.file_id, token.type, token.name, token.value, token.category || null);
        
        return { id: result.lastInsertRowid.toString(), created: true, updated: false };
      }
    } catch (error) {
      logger.error(`Failed to upsert design token: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getDesignTokensByFile(fileId: string, type?: string): Promise<DesignTokenRecord[]> {
    try {
      const query = type 
        ? 'SELECT * FROM design_tokens WHERE file_id = ? AND type = ? ORDER BY name'
        : 'SELECT * FROM design_tokens WHERE file_id = ? ORDER BY type, name';
      
      const rows = type
        ? this.db.prepare(query).all(fileId, type) as DesignTokenRecord[]
        : this.db.prepare(query).all(fileId) as DesignTokenRecord[];
      
      return rows;
    } catch (error) {
      logger.error(`Failed to get design tokens: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteDesignTokensByFile(fileId: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM design_tokens WHERE file_id = ?').run(fileId);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete design tokens: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Asset Operations
   */
  async upsertAsset(asset: Omit<FigmaAssetRecord, 'id'>): Promise<UpsertResult> {
    try {
      // Check if asset exists (match by file_id and node_id)
      const existing = this.db.prepare(`
        SELECT id FROM figma_assets 
        WHERE file_id = ? AND node_id = ?
      `).get(asset.file_id, asset.node_id) as { id: number } | undefined;
      
      if (existing) {
        this.db.prepare(`
          UPDATE figma_assets 
          SET node_name = ?, node_type = ?, format = ?, file_path = ?, url = ?, width = ?, height = ?
          WHERE id = ?
        `).run(
          asset.node_name || null, asset.node_type || null, asset.format || null,
          asset.file_path || null, asset.url || null, asset.width || null, asset.height || null,
          existing.id
        );
        
        return { id: existing.id.toString(), created: false, updated: true };
      } else {
        const result = this.db.prepare(`
          INSERT INTO figma_assets (file_id, node_id, node_name, node_type, format, file_path, url, width, height)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          asset.file_id, asset.node_id, asset.node_name || null, asset.node_type || null,
          asset.format || null, asset.file_path || null, asset.url || null,
          asset.width || null, asset.height || null
        );
        
        return { id: result.lastInsertRowid.toString(), created: true, updated: false };
      }
    } catch (error) {
      logger.error(`Failed to upsert asset: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAssetsByFile(fileId: string): Promise<FigmaAssetRecord[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM figma_assets WHERE file_id = ? ORDER BY node_name').all(fileId) as FigmaAssetRecord[];
      return rows;
    } catch (error) {
      logger.error(`Failed to get assets by file: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteAssetsByFile(fileId: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM figma_assets WHERE file_id = ?').run(fileId);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete assets by file: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Cache invalidation logic
   */
  async isCacheValid(url: string, maxAgeHours: number = 24): Promise<boolean> {
    try {
      const file = await this.getFileByUrl(url);
      if (!file || !file.last_analyzed) return false;
      
      const now = new Date();
      const ageHours = (now.getTime() - file.last_analyzed.getTime()) / (1000 * 60 * 60);
      
      return ageHours < maxAgeHours;
    } catch (error) {
      logger.error(`Failed to check cache validity: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Clear cache for a specific file
   */
  async clearFileCache(url: string): Promise<boolean> {
    try {
      const file = await this.getFileByUrl(url);
      if (!file) return false;

      // Delete all related data
      await this.deleteDesignTokensByFile(file.id);
      await this.deleteAssetsByFile(file.id);
      
      // Delete nodes (this will cascade to child nodes)
      const nodes = await this.getNodesByFile(file.id);
      for (const node of nodes) {
        await this.deleteNode(node.id);
      }
      
      // Delete screens
      const screens = await this.getScreensByFile(file.id);
      for (const screen of screens) {
        await this.deleteScreen(screen.id);
      }
      
      // Delete the file itself
      return await this.deleteFile(file.id);
    } catch (error) {
      logger.error(`Failed to clear file cache: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Clear all expired cache entries
   */
  async clearExpiredCache(maxAgeHours: number = 24 * 7): Promise<number> { // Default 7 days
    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      const expiredFiles = this.db.prepare(`
        SELECT * FROM figma_files 
        WHERE last_analyzed < ? OR last_analyzed IS NULL
      `).all(cutoffDate.toISOString()) as FigmaFileRecord[];
      
      let clearedCount = 0;
      for (const file of expiredFiles) {
        if (await this.clearFileCache(file.url)) {
          clearedCount++;
        }
      }
      
      return clearedCount;
    } catch (error) {
      logger.error(`Failed to clear expired cache: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
  async close(): Promise<void> {
    try {
      this.db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error(`Failed to close database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async vacuum(): Promise<void> {
    try {
      this.db.exec('VACUUM');
      logger.info('Database vacuumed');
    } catch (error) {
      logger.error(`Failed to vacuum database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStats(): Promise<{
    files: number;
    screens: number;
    nodes: number;
    tokens: number;
    assets: number;
  }> {
    try {
      const files = this.db.prepare('SELECT COUNT(*) as count FROM figma_files').get() as { count: number };
      const screens = this.db.prepare('SELECT COUNT(*) as count FROM figma_screens').get() as { count: number };
      const nodes = this.db.prepare('SELECT COUNT(*) as count FROM figma_nodes').get() as { count: number };
      const tokens = this.db.prepare('SELECT COUNT(*) as count FROM design_tokens').get() as { count: number };
      const assets = this.db.prepare('SELECT COUNT(*) as count FROM figma_assets').get() as { count: number };
      
      return {
        files: files.count,
        screens: screens.count,
        nodes: nodes.count,
        tokens: tokens.count,
        assets: assets.count
      };
    } catch (error) {
      logger.error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
      return { files: 0, screens: 0, nodes: 0, tokens: 0, assets: 0 };
    }
  }
}