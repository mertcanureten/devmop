import { BasePlugin } from "../base-plugin.js";
import {
  getPubCacheDir,
  getDirSize,
  removeDir,
  findDirs,
  HOME,
} from "../platform.js";
import { execa } from "execa";

export class FlutterPlugin extends BasePlugin {
  constructor() {
    super("flutter", "Clean Flutter and Dart build artifacts and caches");
  }

  async getSize() {
    let total = 0;

    // pub-cache — OS-aware path
    total += await getDirSize(getPubCacheDir());

    // Find all Flutter project build dirs
    const buildDirs = await findDirs("build", HOME, 5);
    // Only count dirs that look like Flutter projects (contain 'pubspec.yaml' sibling)
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    for (const d of buildDirs) {
      const projectRoot = path.dirname(d);
      if (existsSync(path.join(projectRoot, "pubspec.yaml"))) {
        total += await getDirSize(d);
      }
    }

    return total;
  }

  async clean({ dry = false }) {
    const pubCacheDir = getPubCacheDir();

    if (dry) {
      console.log("[Dry Run] flutter clean (in each Flutter project)");
      console.log(`[Dry Run] Remove: ${pubCacheDir}`);
      return;
    }

    // Run flutter clean — works on all platforms where Flutter is installed
    try {
      await execa("flutter", ["clean"]);
    } catch {
      // Flutter not installed or not a Flutter project dir — skip
    }

    await removeDir(pubCacheDir, false);
    console.log("  ✔ Flutter artifacts and pub-cache cleaned");
  }
}
