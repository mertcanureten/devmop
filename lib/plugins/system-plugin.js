import { BasePlugin } from "../base-plugin.js";
import {
  getPlatform,
  IS_MACOS,
  IS_LINUX,
  IS_WINDOWS,
  HOME,
  getCacheDir,
  getLogsDir,
  getDirSize,
  removeDir,
} from "../platform.js";
import path from "node:path";
import { execa } from "execa";

export class SystemPlugin extends BasePlugin {
  constructor() {
    super("system", "Clean system caches and logs");
  }

  /** Returns the list of paths to clean per OS */
  _getPaths(aggressive = false) {
    if (IS_MACOS) {
      const paths = [
        path.join(HOME, "Library", "Caches"),
        path.join(HOME, "Library", "Logs"),
      ];
      if (aggressive) {
        paths.push(path.join(HOME, "Library", "Developer", "Xcode", "DerivedData"));
        paths.push(path.join(HOME, "Library", "Developer", "Xcode", "Archives"));
      }
      return paths;
    }

    if (IS_LINUX) {
      const paths = [
        path.join(HOME, ".cache"),
        path.join(HOME, ".local", "share", "Trash"),
      ];
      if (aggressive) {
        // Thumbnail cache
        paths.push(path.join(HOME, ".cache", "thumbnails"));
      }
      return paths;
    }

    if (IS_WINDOWS) {
      const localAppData = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
      const temp = process.env.TEMP || path.join(localAppData, "Temp");
      const paths = [
        temp,
        path.join(localAppData, "Temp"),
      ];
      if (aggressive) {
        paths.push(path.join(localAppData, "Microsoft", "Windows", "INetCache"));
        paths.push(path.join(localAppData, "Microsoft", "Windows", "Explorer"));
      }
      return [...new Set(paths)]; // deduplicate
    }

    return [getCacheDir(), getLogsDir()];
  }

  async getSize() {
    const paths = this._getPaths(true);
    let total = 0;
    for (const p of paths) {
      total += await getDirSize(p);
    }
    return total;
  }

  async clean({ dry = false, aggressive = false }) {
    const platform = getPlatform();
    const paths = this._getPaths(aggressive);

    for (const p of paths) {
      await removeDir(p, dry);
    }

    // Linux: clear journald logs (system-level, may require sudo)
    if (IS_LINUX && aggressive && !dry) {
      try {
        await execa("journalctl", ["--vacuum-time=7d"]);
      } catch {
        // Silently skip — may need sudo
      }
    }

    if (!dry) {
      console.log(`  ✔ System caches cleaned [${platform}]`);
    }
  }
}
