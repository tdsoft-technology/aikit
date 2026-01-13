import { logger } from '../../utils/logger.js';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { FigmaDatabase } from '../database/figma-db.js';

/**
 * Get Figma data from database cache (if available)
 */
export async function getCachedFigmaData(
  url: string, 
  database?: FigmaDatabase
): Promise<{
  screens: any[];
  nodes: any[];
  tokens: any[];
  assets: any[];
} | null> {
  if (!database) return null;

  try {
    // Get file by URL
    const file = await database.getFileByUrl(url);
    if (!file) return null;

    // Get all related data
    const screens = await database.getScreensByFile(file.id);
    const nodes = await database.getNodesByFile(file.id);
    const tokens = await database.getDesignTokensByFile(file.id);
    const assets = await database.getAssetsByFile(file.id);

    return {
      screens: screens.map(s => ({
        id: s.id,
        name: s.name,
        width: s.width,
        height: s.height,
        type: s.type,
        childrenCount: s.children_count
      })),
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        content: n.content,
        position: n.position_x ? {
          x: n.position_x,
          y: n.position_y,
          width: n.width,
          height: n.height
        } : undefined,
        styles: n.styles ? JSON.parse(n.styles) : undefined,
        children: n.children_ids ? JSON.parse(n.children_ids) : undefined
      })),
      tokens: tokens.map(t => ({
        type: t.type,
        name: t.name,
        value: t.value,
        category: t.category
      })),
      assets: assets.map(a => ({
        nodeId: a.node_id,
        nodeName: a.node_name,
        nodeType: a.node_type,
        format: a.format,
        path: a.file_path,
        url: a.url,
        width: a.width,
        height: a.height
      }))
    };
  } catch (error) {
    logger.warn(`Failed to get cached Figma data: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
export async function checkCurrentCodeStatus(projectPath: string = process.cwd()): Promise<{
  hasHTML: boolean;
  htmlFile?: string;
  hasCSS: boolean;
  cssFiles: string[];
  hasAssets: boolean;
  assetCount: number;
  sections: string[];
}> {
  const status = {
    hasHTML: false,
    htmlFile: undefined as string | undefined,
    hasCSS: false,
    cssFiles: [] as string[],
    hasAssets: false,
    assetCount: 0,
    sections: [] as string[],
  };

  try {
    // Check for HTML files
    const htmlFiles = ['index.html', 'index.htm', 'main.html'].filter(file => 
      existsSync(join(projectPath, file))
    );
    if (htmlFiles.length > 0) {
      status.hasHTML = true;
      status.htmlFile = htmlFiles[0];
      
      // Try to read HTML to extract sections
      try {
        const htmlContent = await readFile(join(projectPath, htmlFiles[0]), 'utf-8');
        // Extract section IDs and classes
        const sectionMatches = htmlContent.match(/<(section|div|header|footer|main|article|aside)[^>]*(?:id|class)=["']([^"']+)["']/gi);
        if (sectionMatches) {
          status.sections = sectionMatches.map(match => {
            const idMatch = match.match(/id=["']([^"']+)["']/i);
            const classMatch = match.match(/class=["']([^"']+)["']/i);
            return idMatch ? idMatch[1] : (classMatch ? classMatch[1].split(' ')[0] : '');
          }).filter(Boolean);
        }
      } catch (e) {
        // Ignore read errors
      }
    }

    // Check for CSS files
    const stylesDir = join(projectPath, 'styles');
    if (existsSync(stylesDir)) {
      try {
        const files = await readdir(stylesDir);
        const cssFiles = files.filter(f => f.endsWith('.css'));
        if (cssFiles.length > 0) {
          status.hasCSS = true;
          status.cssFiles = cssFiles.map(f => join(stylesDir, f));
        }
      } catch (e) {
        // Ignore read errors
      }
    }

    // Check for assets
    const assetsDir = join(projectPath, 'assets', 'images');
    if (existsSync(assetsDir)) {
      try {
        const files = await readdir(assetsDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|svg|webp)$/i.test(f));
        if (imageFiles.length > 0) {
          status.hasAssets = true;
          status.assetCount = imageFiles.length;
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  } catch (error) {
    logger.warn(`Error checking code status: ${error instanceof Error ? error.message : String(error)}`);
  }

  return status;
}

/**
 * Compare current code with Figma design to identify what needs to be implemented
 * Can use database cache or fresh figma data
 */
export async function compareCodeWithFigma(
  figmaTokens: any,
  selectedScreenId: string,
  projectPath: string = process.cwd(),
  database?: FigmaDatabase,
  figmaUrl?: string
): Promise<{
  missingSections: string[];
  missingAssets: string[];
  needsUpdate: boolean;
  recommendations: string[];
}> {
  // Try to use cached data if available
  let cachedData;
  if (database && figmaUrl) {
    cachedData = await getCachedFigmaData(figmaUrl, database);
  }
  
  // Use cached data or fallback to provided tokens
  const dataToUse = cachedData || figmaTokens;
  const codeStatus = await checkCurrentCodeStatus(projectPath);
  const result = {
    missingSections: [] as string[],
    missingAssets: [] as string[],
    needsUpdate: false,
    recommendations: [] as string[],
  };

  // Find selected screen
  const selectedScreen = dataToUse.screens?.find((s: any) => s.id === selectedScreenId);
  if (!selectedScreen) {
    result.recommendations.push('Selected screen not found in Figma design');
    return result;
  }

  // Extract sections from Figma structure
  const figmaSections: string[] = [];
  if (dataToUse.structure?.nodes || dataToUse.nodes) {
    const nodes = dataToUse.structure?.nodes || dataToUse.nodes;
    const screenNode = nodes.find((n: any) => n.id === selectedScreenId);
    if (screenNode?.children) {
      // Extract main sections from children
      screenNode.children.forEach((childId: string) => {
        const childNode = nodes.find((n: any) => n.id === childId);
        if (childNode && (childNode.type === 'FRAME' || childNode.type === 'COMPONENT')) {
          const sectionName = childNode.name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');
          figmaSections.push(sectionName);
        }
      });
    }
  }

  // Compare sections
  const existingSections = codeStatus.sections.map(s => s.toLowerCase());
  result.missingSections = figmaSections.filter(s => 
    !existingSections.some(existing => existing.includes(s) || s.includes(existing))
  );

  // Check assets
  if (codeStatus.assetCount === 0) {
    result.missingAssets.push('All assets need to be downloaded');
    result.needsUpdate = true;
  }

  // Generate recommendations
  if (!codeStatus.hasHTML) {
    result.recommendations.push('Create index.html with HTML5 structure');
  }
  if (!codeStatus.hasCSS) {
    result.recommendations.push('Create CSS files (variables.css, base.css, components.css)');
  }
  if (result.missingSections.length > 0) {
    result.recommendations.push(`Implement missing sections: ${result.missingSections.join(', ')}`);
  }
  if (result.missingAssets.length > 0) {
    result.recommendations.push('Download required assets from Figma');
  }

  return result;
}




