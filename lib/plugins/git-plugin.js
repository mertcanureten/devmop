import { BasePlugin } from "../base-plugin.js";
import { findDirs, getDirSize, HOME, IS_WINDOWS } from "../platform.js";
import path from "node:path";
import fs from "node:fs";
import { execa } from "execa";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a directory is a git repo root */
function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

/** Run a git command inside a repo, return stdout or '' on error */
async function git(repoPath, args) {
  try {
    const { stdout } = await execa("git", args, { cwd: repoPath });
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Find all git repository roots under HOME.
 * Stops recursing into found repos (no nested repo support needed).
 */
async function findGitRepos(rootPath = HOME, maxDepth = 5) {
  const results = [];
  const fsp = (await import("node:fs/promises")).default;

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    if (isGitRepo(dir)) {
      results.push(dir);
      return; // don't recurse into submodules
    }

    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip dirs that are clearly not project dirs
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "Library" ||
        entry.name === "Applications" ||
        entry.name === "System" ||
        entry.name === "Volumes" ||
        entry.name === "AppData"
      ) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  return results;
}

/** Return size of .git directory for a repo */
async function getGitDirSize(repoPath) {
  return getDirSize(path.join(repoPath, ".git"));
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export class GitPlugin extends BasePlugin {
  constructor() {
    super("git", "Clean git repos: GC, merged branches, stash, untracked files");
  }

  async getSize() {
    const repos = await findGitRepos();
    let total = 0;
    for (const repo of repos) {
      // .git dir size is reclaimed by gc
      total += await getGitDirSize(repo);
    }
    return total;
  }

  /**
   * @param {Object} opts
   * @param {boolean} opts.dry        - Dry run mode
   * @param {boolean} opts.aggressive - Also clear stash and untracked files
   * @param {boolean} opts.branches   - Remove merged branches
   * @param {boolean} opts.gc         - Run git garbage collection
   * @param {boolean} opts.stash      - Clear git stash
   * @param {boolean} opts.untracked  - Remove untracked files (git clean -fd)
   */
  async clean({ dry = false, aggressive = false, branches = true, gc = true, stash = false, untracked = false } = {}) {
    const repos = await findGitRepos();

    if (repos.length === 0) {
      console.log("  ℹ No git repositories found.");
      return;
    }

    console.log(`\n  Found ${repos.length} git repositor${repos.length === 1 ? "y" : "ies"}\n`);

    let totalBranchesRemoved = 0;
    let totalReposGC = 0;

    for (const repo of repos) {
      const name = path.relative(HOME, repo) || path.basename(repo);
      const actions = [];

      // ── 1. Remove merged local branches ───────────────────────────────────
      if (branches) {
        const mergedRaw = await git(repo, ["branch", "--merged", "HEAD"]);
        const merged = mergedRaw
          .split("\n")
          .map(b => b.trim())
          .filter(b => b && !b.startsWith("*") && b !== "main" && b !== "master" && b !== "develop");

        if (merged.length > 0) {
          if (dry) {
            actions.push(`Would delete ${merged.length} merged branch(es): ${merged.join(", ")}`);
          } else {
            for (const branch of merged) {
              await git(repo, ["branch", "-d", branch]);
            }
            actions.push(`Deleted ${merged.length} merged branch(es)`);
            totalBranchesRemoved += merged.length;
          }
        }
      }

      // ── 2. Git garbage collection ──────────────────────────────────────────
      if (gc) {
        if (dry) {
          actions.push("Would run: git gc --prune=now");
        } else {
          if (aggressive) {
            await git(repo, ["gc", "--aggressive", "--prune=now"]);
          } else {
            await git(repo, ["gc", "--prune=now", "--quiet"]);
          }
          actions.push("Git GC completed");
          totalReposGC++;
        }
      }

      // ── 3. Clear stash ────────────────────────────────────────────────────
      if (stash || aggressive) {
        const stashList = await git(repo, ["stash", "list"]);
        if (stashList) {
          const count = stashList.split("\n").filter(Boolean).length;
          if (dry) {
            actions.push(`Would drop ${count} stash entr${count === 1 ? "y" : "ies"}`);
          } else {
            await git(repo, ["stash", "clear"]);
            actions.push(`Dropped ${count} stash entr${count === 1 ? "y" : "ies"}`);
          }
        }
      }

      // ── 4. Remove untracked files ─────────────────────────────────────────
      if (untracked || aggressive) {
        if (dry) {
          const preview = await git(repo, ["clean", "-fdn"]);
          if (preview) actions.push(`Would remove untracked:\n${preview.split("\n").map(l => `    ${l}`).join("\n")}`);
        } else {
          await git(repo, ["clean", "-fd", "--quiet"]);
          actions.push("Untracked files removed");
        }
      }

      // ── Print repo summary ────────────────────────────────────────────────
      if (actions.length > 0) {
        console.log(`  📁 ${name}`);
        actions.forEach(a => console.log(`     • ${a}`));
      }
    }

    if (!dry) {
      console.log(`\n  ✔ Git cleanup done — GC'd ${totalReposGC} repos, removed ${totalBranchesRemoved} merged branches`);
    }
  }

  /**
   * Analyze repos and report large objects, stash sizes, branch counts.
   * Used by `devclean git --analyze`.
   */
  async analyze() {
    const repos = await findGitRepos();
    const report = [];

    for (const repo of repos) {
      const name = path.relative(HOME, repo) || path.basename(repo);

      // Branch count
      const branchRaw = await git(repo, ["branch"]);
      const branchCount = branchRaw ? branchRaw.split("\n").filter(Boolean).length : 0;

      // Merged branches
      const mergedRaw = await git(repo, ["branch", "--merged", "HEAD"]);
      const mergedCount = mergedRaw
        .split("\n")
        .map(b => b.trim())
        .filter(b => b && !b.startsWith("*") && b !== "main" && b !== "master" && b !== "develop")
        .length;

      // Stash count
      const stashRaw = await git(repo, ["stash", "list"]);
      const stashCount = stashRaw ? stashRaw.split("\n").filter(Boolean).length : 0;

      // .git dir size
      const gitSize = await getGitDirSize(repo);

      // Top 3 large objects (pack files) — safe, no extra deps
      const largeObjects = await git(repo, [
        "rev-list", "--objects", "--all",
        "--no-walk",
      ]).catch(() => "");

      report.push({ name, branchCount, mergedCount, stashCount, gitSize });
    }

    return report;
  }
}
