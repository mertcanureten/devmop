import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { execa } from "execa";

/** 
 * Singleton to track directories that failed due to lack of permissions 
 */
export const PermissionTracker = {
  failedPaths: new Set(),
  add(path) { this.failedPaths.add(path); },
  get() { return Array.from(this.failedPaths); },
  clear() { this.failedPaths.clear(); }
};

// ─── OS Detection ────────────────────────────────────────────────────────────

/**
 * Returns a normalized platform identifier.
 * @returns {'macos' | 'linux' | 'windows'}
 */
export function getPlatform() {
  switch (process.platform) {
    case "darwin": return "macos";
    case "linux":  return "linux";
    case "win32":  return "windows";
    default:       return "linux"; // fallback
  }
}

export const IS_WINDOWS = process.platform === "win32";
export const IS_MACOS   = process.platform === "darwin";
export const IS_LINUX   = process.platform === "linux";

// ─── Path Helpers ────────────────────────────────────────────────────────────

/** Home directory — cross-platform via Node os module */
export const HOME = os.homedir();

/**
 * Returns the standard user cache directory per OS.
 * macOS  → ~/Library/Caches
 * Linux  → ~/.cache
 * Windows→ %LOCALAPPDATA%
 */
export function getCacheDir() {
  if (IS_MACOS)   return path.join(HOME, "Library", "Caches");
  if (IS_WINDOWS) return process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
  return path.join(HOME, ".cache"); // Linux / others
}

/**
 * Returns the standard user log directory per OS.
 */
export function getLogsDir() {
  if (IS_MACOS)   return path.join(HOME, "Library", "Logs");
  if (IS_WINDOWS) return path.join(process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local"), "Temp");
  return path.join(HOME, ".local", "share"); // Linux (journald is system-level)
}

/**
 * Returns the Flutter pub-cache directory per OS.
 */
export function getPubCacheDir() {
  if (IS_WINDOWS) return path.join(process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local"), "Pub", "Cache");
  return path.join(HOME, ".pub-cache");
}

/**
 * Returns Node.js npm cache directory per OS.
 */
export function getNpmCacheDir() {
  if (IS_WINDOWS) return path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "npm-cache");
  if (IS_MACOS)   return path.join(HOME, "Library", "Caches", "node");
  return path.join(HOME, ".npm");
}

// ─── Filesystem Utilities ────────────────────────────────────────────────────

export async function getDirSize(dirPath) {
  let total = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    
    let entries;
    try {
      entries = await fsp.readdir(dirPath, { withFileTypes: true });
    } catch {
      PermissionTracker.add(dirPath); // Track as permission restricted
      return 0; // Access denied
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += await getDirSize(fullPath);
        } else {
          const stat = await fsp.lstat(fullPath).catch(() => null);
          if (stat) total += stat.size;
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Top-level error catch
  }
  return total;
}

/**
 * Recursively removes a directory — cross-platform using Node.js fs.
 * Highly robust: if a directory can't be removed due to nested perms,
 * it tries to remove what it can inside and adds to PermissionTracker.
 */
export async function removeDir(dirPath, dry = false) {
  try {
    if (!fs.existsSync(dirPath)) return;
    if (dry) {
      console.log(`[Dry Run] Remove: ${dirPath}`);
      return;
    }
    
    // Try primary recursive removal
    try {
      await fsp.rm(dirPath, { recursive: true, force: true });
    } catch (err) {
      // If we failed with permission error, try partial leaf-based removal
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        PermissionTracker.add(dirPath); // Track the main folder failure
        const entries = await fsp.readdir(dirPath, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          await removeDir(fullPath, dry);
        }
        // Try the parent directory again after cleaning children
        await fsp.rmdir(dirPath).catch(() => {}); 
      }
    }
  } catch {
    // Final safety net to prevent CLI crash
  }
}

/**
 * Attempts to remove a directory using sudo (macOS/Linux only).
 * On Windows, this will throw an error telling user to run as Admin.
 */
export async function trySudoRemove(dirPath) {
  if (IS_WINDOWS) {
    throw new Error("Sudo is not available on Windows. Please run your terminal as Administrator.");
  }
  
  try {
    // We use shell:true to ensure sudo can handle paths with spaces or special chars if needed,
    // though execa usually handles it fine. stdio: 'inherit' allows sudo to prompt for password.
    await execa("sudo", ["rm", "-rf", dirPath], { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Finds all directories with a given name under a root path.
 * Uses Node.js fs — fully cross-platform.
 * @param {string} targetName  Directory name to find (e.g. "node_modules")
 * @param {string} rootPath    Where to start searching
 * @param {number} maxDepth    Maximum recursion depth
 * @returns {Promise<string[]>} Array of absolute paths found
 */
export async function findDirs(targetName, rootPath = HOME, maxDepth = 6) {
  const results = [];

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.name === targetName) {
        results.push(fullPath);
        // Don't recurse into matched dirs (e.g. nested node_modules)
        continue;
      }

      // Skip hidden dirs and common non-project dirs to keep it fast
      if (
        entry.name.startsWith(".") ||
        entry.name === "Library" ||
        entry.name === "Applications" ||
        entry.name === "System" ||
        entry.name === "Volumes"
      ) continue;

      await walk(fullPath, depth + 1);
    }
  }

  await walk(rootPath, 0);
  return results;
}
