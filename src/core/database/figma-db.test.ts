/**
 * Unit tests for Figma database operations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FigmaDatabase } from './figma-db.js';
import { FigmaFileRecord, FigmaScreenRecord, FigmaNodeRecord } from './types.js';

describe('FigmaDatabase', () => {
  let db: FigmaDatabase;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = new FigmaDatabase(':memory:');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('File Operations', () => {
    it('should upsert a new file', async () => {
      const file = {
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      };

      const result = await db.upsertFile(file);
      
      expect(result.id).toBe(file.id);
      expect(result.created).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('should update an existing file', async () => {
      const file = {
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      };

      // First insert
      await db.upsertFile(file);
      
      // Update with same ID
      const updatedFile = { ...file, name: 'Updated Design' };
      const result = await db.upsertFile(updatedFile);
      
      expect(result.created).toBe(false);
      expect(result.updated).toBe(true);
    });

    it('should get file by ID', async () => {
      const file = {
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      };

      await db.upsertFile(file);
      const retrieved = await db.getFile(file.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(file.id);
      expect(retrieved!.name).toBe(file.name);
    });

    it('should get file by URL', async () => {
      const file = {
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      };

      await db.upsertFile(file);
      const retrieved = await db.getFileByUrl(file.url);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(file.id);
    });
  });

  describe('Screen Operations', () => {
    beforeEach(async () => {
      // Create a test file first
      await db.upsertFile({
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      });
    });

    it('should upsert a screen', async () => {
      const screen: FigmaScreenRecord = {
        id: 'screen-1',
        file_id: 'test-file-1',
        name: 'Home Screen',
        width: 1200,
        height: 800,
        type: 'FRAME'
      };

      const result = await db.upsertScreen(screen);
      
      expect(result.id).toBe(screen.id);
      expect(result.created).toBe(true);
    });

    it('should get screens by file', async () => {
      const screen: FigmaScreenRecord = {
        id: 'screen-1',
        file_id: 'test-file-1',
        name: 'Home Screen',
        width: 1200,
        height: 800,
        type: 'FRAME'
      };

      await db.upsertScreen(screen);
      const screens = await db.getScreensByFile('test-file-1');
      
      expect(screens).toHaveLength(1);
      expect(screens[0].id).toBe(screen.id);
    });
  });

  describe('Database Stats', () => {
    it('should return correct stats', async () => {
      // Add some test data
      await db.upsertFile({
        id: 'test-file-1',
        url: 'https://figma.com/design/test',
        name: 'Test Design',
        file_key: 'test-key'
      });

      const stats = await db.getStats();
      
      expect(stats.files).toBe(1);
      expect(stats.screens).toBe(0);
      expect(stats.nodes).toBe(0);
    });
  });
});