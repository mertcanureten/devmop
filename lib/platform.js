import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { execa } from "execa";

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

/**
 * Recursively calculates directory size in bytes using only Node.js fs.
 * No shell commands — fully cross-platform.
 * @param {string} dirPath
 * @returns {Promise<number>} size in bytes
 */
export async function getDirSize(dirPath) {
  let total = 0;
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const tasks = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          return await getDirSize(fullPath);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const stat = await fsp.lstat(fullPath);
          return stat.size;
        }
      } catch {
        return 0;
      }
      return 0;
    });
    const sizes = await Promise.all(tasks);
    total = sizes.reduce((a, b) => a + b, 0);
  } catch {
    // Directory doesn't exist or no permission
  }
  return total;
}

/**
 * Recursively removes a directory — cross-platform using Node.js fs.
 * @param {string} dirPath
 * @param {boolean} dry — if true, only prints without deleting
 */
export async function removeDir(dirPath, dry = false) {
  if (!fs.existsSync(dirPath)) return;
  if (dry) {
    console.log(`[Dry Run] Remove: ${dirPath}`);
    return;
  }
  await fsp.rm(dirPath, { recursive: true, force: true });
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
