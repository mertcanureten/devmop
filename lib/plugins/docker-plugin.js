import { BasePlugin } from "../base-plugin.js";
import { IS_MACOS, IS_WINDOWS, HOME, removeDir } from "../platform.js";
import path from "node:path";
import { execa } from "execa";

export class DockerPlugin extends BasePlugin {
  constructor() {
    super("docker", "Clean Docker images, containers, and builder cache");
  }

  /** Returns the Docker Desktop data directory for aggressive cleanup */
  _getDockerDesktopDir() {
    if (IS_MACOS) {
      return path.join(HOME, "Library", "Containers", "com.docker.docker");
    }
    if (IS_WINDOWS) {
      const localAppData = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
      return path.join(localAppData, "Docker");
    }
    // Linux: Docker Desktop (if installed via .deb/.rpm)
    return path.join(HOME, ".docker", "desktop");
  }

  async getSize() {
    try {
      const { stdout } = await execa("docker", ["system", "df", "--format", "{{.Size}}"]);
      const sizes = stdout.split("\n").filter(Boolean);
      let totalBytes = 0;
      for (const size of sizes) {
        const match = size.match(/([\d.]+)([A-Z]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          const unit = match[2];
          const multipliers = {
            B: 1,
            KB: 1024,
            MB: 1024 ** 2,
            GB: 1024 ** 3,
            TB: 1024 ** 4,
          };
          totalBytes += num * (multipliers[unit] || 1);
        }
      }
      return totalBytes;
    } catch {
      // Docker not installed or daemon not running
      return 0;
    }
  }

  async clean({ dry = false, aggressive = false }) {
    if (dry) {
      console.log("[Dry Run] docker system prune -a --volumes -f");
      console.log("[Dry Run] docker builder prune -a -f");
      if (aggressive) {
        console.log(`[Dry Run] Remove: ${this._getDockerDesktopDir()}`);
      }
      return;
    }

    try {
      await execa("docker", ["system", "prune", "-a", "--volumes", "-f"]);
      await execa("docker", ["builder", "prune", "-a", "-f"]);
    } catch {
      console.error("  ✗ Docker cleanup failed — is Docker running?");
      return;
    }

    if (aggressive) {
      await removeDir(this._getDockerDesktopDir(), false);
    }

    console.log("  ✔ Docker images, containers, volumes, and builder cache cleaned");
  }
}
