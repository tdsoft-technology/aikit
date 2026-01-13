/**
 * Database types for Figma data storage
 */

/**
 * Figma file record in database
 */
export interface FigmaFileRecord {
  id: string;
  url: string;
  name?: string;
  file_key: string;
  last_analyzed?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Figma screen/frame record in database
 */
export interface FigmaScreenRecord {
  id: string;
  file_id: string;
  name: string;
  width?: number;
  height?: number;
  type?: string;
  description?: string;
  children_count?: number;
}

/**
 * Figma node (component/section) record in database
 */
export interface FigmaNodeRecord {
  id: string;
  file_id: string;
  screen_id?: string;
  parent_id?: string;
  name: string;
  type: string;
  content?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  styles?: string; // JSON string
  children_ids?: string; // JSON string array
}

/**
 * Design token record in database
 */
export interface DesignTokenRecord {
  id?: number;
  file_id: string;
  type: 'color' | 'typography' | 'spacing' | 'component';
  name: string;
  value: string;
  category?: string;
}

/**
 * Figma asset record in database
 */
export interface FigmaAssetRecord {
  id?: number;
  file_id: string;
  node_id: string;
  node_name?: string;
  node_type?: string;
  format?: 'png' | 'svg' | 'jpg';
  file_path?: string;
  url?: string;
  width?: number;
  height?: number;
}

/**
 * Node styles structure (for JSON storage)
 */
export interface NodeStyles {
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  layout?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  gap?: number;
}

/**
 * Query options for database operations
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Upsert result
 */
export interface UpsertResult {
  id: string;
  created: boolean;
  updated: boolean;
}

/**
 * Database interface for Figma data
 */
export interface FigmaDatabase {
  // File operations
  upsertFile(file: Omit<FigmaFileRecord, 'created_at' | 'updated_at'>): Promise<UpsertResult>;
  getFile(id: string): Promise<FigmaFileRecord | null>;
  getFileByUrl(url: string): Promise<FigmaFileRecord | null>;
  deleteFile(id: string): Promise<boolean>;
  listFiles(options?: QueryOptions): Promise<FigmaFileRecord[]>;

  // Screen operations
  upsertScreen(screen: FigmaScreenRecord): Promise<UpsertResult>;
  getScreen(id: string): Promise<FigmaScreenRecord | null>;
  getScreensByFile(fileId: string): Promise<FigmaScreenRecord[]>;
  deleteScreen(id: string): Promise<boolean>;

  // Node operations
  upsertNode(node: FigmaNodeRecord): Promise<UpsertResult>;
  getNode(id: string): Promise<FigmaNodeRecord | null>;
  getNodesByScreen(screenId: string): Promise<FigmaNodeRecord[]>;
  getNodesByFile(fileId: string): Promise<FigmaNodeRecord[]>;
  deleteNode(id: string): Promise<boolean>;

  // Design token operations
  upsertDesignToken(token: Omit<DesignTokenRecord, 'id'>): Promise<UpsertResult>;
  getDesignTokensByFile(fileId: string, type?: string): Promise<DesignTokenRecord[]>;
  deleteDesignTokensByFile(fileId: string): Promise<boolean>;

  // Asset operations
  upsertAsset(asset: Omit<FigmaAssetRecord, 'id'>): Promise<UpsertResult>;
  getAssetsByFile(fileId: string): Promise<FigmaAssetRecord[]>;
  deleteAssetsByFile(fileId: string): Promise<boolean>;

  // Utility operations
  close(): Promise<void>;
  vacuum(): Promise<void>;
  getStats(): Promise<{
    files: number;
    screens: number;
    nodes: number;
    tokens: number;
    assets: number;
  }>;
}