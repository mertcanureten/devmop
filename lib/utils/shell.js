import { getDirSize as platformGetDirSize, removeDir } from "../platform.js";

/**
 * Executes a command and returns stdout as string.
 * Use only for tools that are cross-platform themselves (e.g. docker, npm, flutter).
 */
export { removeDir };

/**
 * Calculates directory size in bytes — cross-platform, no shell needed.
 * @param {string} path
 * @returns {Promise<number>}
 */
export async function getDirSize(path) {
  return platformGetDirSize(path);
}
