import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { Logger } from '../../utils/logger.js';

export interface FileEntry {
  name: string;
  relativePath: string;
  sizeBytes: number;
  isDir: boolean;
  modifiedAt: string;
  isEditable: boolean;
}

export class FileService {
  private static rootDir = path.resolve(config.palworldDir);

  /**
   * Resolves and verifies that a relative path stays inside rootDir.
   * Prevents path traversal vulnerabilities.
   */
  private static resolveSafePath(userRelativePath: string): string {
    const cleanRel = (userRelativePath || '').replace(/^[\\\/]+/, '');
    const fullPath = path.resolve(this.rootDir, cleanRel);

    if (!fullPath.startsWith(this.rootDir)) {
      throw new Error('Access denied: Path traversal detected.');
    }

    return fullPath;
  }

  /**
   * Lists files and folders in a permitted relative path.
   */
  static listDirectory(subPath: string = ''): FileEntry[] {
    const targetDir = this.resolveSafePath(subPath);

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const item of items) {
      // Exclude hidden system files
      if (item.name.startsWith('.')) continue;

      const itemFullPath = path.join(targetDir, item.name);
      try {
        const stats = fs.statSync(itemFullPath);
        const relPath = path.relative(this.rootDir, itemFullPath).replace(/\\/g, '/');
        const ext = path.extname(item.name).toLowerCase();
        const editableExts = ['.ini', '.cfg', '.txt', '.json', '.sh', '.log'];

        results.push({
          name: item.name,
          relativePath: relPath,
          sizeBytes: stats.size,
          isDir: item.isDirectory(),
          modifiedAt: stats.mtime.toISOString(),
          isEditable: !item.isDirectory() && editableExts.includes(ext),
        });
      } catch {}
    }

    // Sort folders first, then alphabetically
    return results.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Reads a text file safely.
   */
  static readFileContent(subPath: string): string {
    const filePath = this.resolveSafePath(subPath);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    const stats = fs.statSync(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      throw new Error('File too large to open in browser editor (>5MB)');
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Saves content to a text file.
   */
  static writeFileContent(subPath: string, content: string): void {
    const filePath = this.resolveSafePath(subPath);
    fs.writeFileSync(filePath, content, 'utf-8');
    Logger.info(`[FileService] Modified file: ${subPath}`);
  }

  /**
   * Renames a file or folder.
   */
  static rename(oldSubPath: string, newName: string): void {
    const oldPath = this.resolveSafePath(oldSubPath);
    const parentDir = path.dirname(oldPath);
    const cleanNewName = path.basename(newName);
    const newPath = path.join(parentDir, cleanNewName);

    if (fs.existsSync(newPath)) {
      throw new Error('Target filename already exists');
    }

    fs.renameSync(oldPath, newPath);
    Logger.info(`[FileService] Renamed: ${oldSubPath} -> ${cleanNewName}`);
  }

  /**
   * Deletes a file or directory.
   */
  static delete(subPath: string): void {
    const target = this.resolveSafePath(subPath);
    if (!fs.existsSync(target)) return;

    const stats = fs.statSync(target);
    if (stats.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      fs.unlinkSync(target);
    }
    Logger.info(`[FileService] Deleted: ${subPath}`);
  }
}

