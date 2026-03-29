import { BasePlugin } from "../base-plugin.js";
import {
  HOME,
  IS_WINDOWS,
  findDirs,
  getDirSize,
  removeDir,
  getNpmCacheDir,
} from "../platform.js";
import path from "node:path";
import { execa } from "execa";

export class NodePlugin extends BasePlugin {
  constructor() {
    super("node", "Clean node_modules and npm cache");
  }

  async getSize() {
    // Find all node_modules dirs and sum their sizes
    const dirs = await findDirs("node_modules", HOME);
    let total = 0;
    for (const d of dirs) {
      total += await getDirSize(d);
    }
    // Add npm cache size
    total += await getDirSize(getNpmCacheDir());
    return total;
  }

  async clean({ dry = false }) {
    const dirs = await findDirs("node_modules", HOME);

    if (dry) {
      console.log(`[Dry Run] Would remove ${dirs.length} node_modules director${dirs.length === 1 ? "y" : "ies"}:`);
      dirs.forEach(d => console.log(`  - ${d}`));
      console.log("[Dry Run] npm cache clean --force");
      return;
    }

    for (const d of dirs) {
      await removeDir(d, false);
    }

    // npm cache clean is cross-platform
    try {
      await execa("npm", ["cache", "clean", "--force"]);
    } catch {
      // npm may not be in PATH — skip silently
    }

    console.log(`  ✔ Removed ${dirs.length} node_modules director${dirs.length === 1 ? "y" : "ies"} + npm cache`);
  }
}
