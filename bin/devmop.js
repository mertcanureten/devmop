#!/usr/bin/env node

import { Command } from "commander";
import { pluginManager } from "../lib/plugin-manager.js";
import chalk from "chalk";
import ora from "ora";
import enquirer from "enquirer";
import { drawBarChart } from "../lib/utils/chart.js";
import { loadConfig } from "../lib/config.js";
import { getPlatform, IS_WINDOWS, PermissionTracker, trySudoRemove } from "../lib/platform.js";
import { startWatch, parseThreshold, parseInterval } from "../lib/watch.js";
import { GitPlugin } from "../lib/plugins/git-plugin.js";
import prettyBytes from "pretty-bytes";

const program = new Command();

program
  .name("devmop")
  .description("Mop up developer disk junk — node_modules, Docker, Git, Flutter, system caches")
  .version("1.0.1");

// ─── clean ───────────────────────────────────────────────────────────────────

program
  .command("clean")
  .description("Clean developer caches")
  .option("--docker",      "Clean Docker")
  .option("--node",        "Clean node_modules")
  .option("--system",      "Clean system caches")
  .option("--flutter",     "Clean Flutter caches")
  .option("--git",         "Clean git repos (GC, merged branches)")
  .option("--all",         "Clean everything")
  .option("--dry-run",     "Show what would be deleted")
  .option("--aggressive",  "Deep clean")
  .option("-i, --interactive", "Interactive selection")
  .action(async (opts) => {
    const config = await loadConfig();
    const aggressive = opts.aggressive || config.defaults?.aggressive;
    const plugins = pluginManager.getAllPlugins();
    let selectedPlugins = [];

    if (opts.interactive) {
      const { MultiSelect } = enquirer;
      const prompt = new MultiSelect({
        name: "value",
        message: "Select items to clean:",
        choices: plugins.map(p => ({ name: p.name, message: `${p.name} — ${p.description}` })),
      });
      selectedPlugins = await prompt.run();
    } else if (opts.all) {
      selectedPlugins = plugins.map(p => p.name);
    } else {
      if (opts.docker)  selectedPlugins.push("docker");
      if (opts.node)    selectedPlugins.push("node");
      if (opts.system)  selectedPlugins.push("system");
      if (opts.flutter) selectedPlugins.push("flutter");
      if (opts.git)     selectedPlugins.push("git");
    }

    if (selectedPlugins.length === 0) {
      console.log(chalk.yellow("No targets selected. Use --all or specific flags."));
      return;
    }

    const spinner = ora("Cleaning...").start();
    const startTime = Date.now();

    for (const name of selectedPlugins) {
      const plugin = pluginManager.getPlugin(name);
      if (plugin) {
        spinner.text = `Cleaning ${name}...`;
        spinner.stop();
        await plugin.clean({ dry: opts.dryRun, aggressive });
        spinner.start();
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    spinner.succeed(chalk.green(`Cleanup finished in ${duration}s`));

    // ─── Permission Escalation Prompt ───────────────────────────────────────
    const failed = PermissionTracker.get();
    if (failed.length > 0 && !opts.dryRun) {
      console.log(chalk.yellow(`\n⚠️  ${failed.length} paths could not be cleaned due to permissions.`));
      
      const { Confirm } = enquirer;
      const prompt = new Confirm({
        name: "retry",
        message: IS_WINDOWS 
          ? "Some files require Administrator privileges. Retry as Administrator?" 
          : "Would you like to retry cleaning these restricted paths with 'sudo'?",
        initial: false
      });

      const answer = await prompt.run().catch(() => false);
      if (answer) {
        if (IS_WINDOWS) {
          console.log(chalk.cyan("\n💡 Please restart your terminal as Administrator and run the command again."));
        } else {
          console.log(chalk.bold("\n🚀 Escalating to sudo..."));
          for (const p of failed) {
            const success = await trySudoRemove(p);
            if (success) {
              console.log(chalk.green(`  ✔ Removed: ${p}`));
            } else {
              console.log(chalk.red(`  ✘ Failed again (requires higher privileges or Full Disk Access): ${p}`));
            }
          }
          console.log(chalk.green("\nDone."));
        }
      }
      PermissionTracker.clear();
    }
  });

// ─── usage ───────────────────────────────────────────────────────────────────

program
  .command("usage")
  .description("Show disk usage breakdown")
  .action(async () => {
    const spinner = ora("Scanning disk...").start();
    const plugins = pluginManager.getAllPlugins();
    const data = [];

    for (const plugin of plugins) {
      spinner.text = `Checking ${plugin.name}...`;
      const size = await plugin.getSize();
      data.push({ label: plugin.name, value: size });
    }

    spinner.stop();
    drawBarChart(data);
  });

// ─── git ─────────────────────────────────────────────────────────────────────

program
  .command("git")
  .description("Manage and analyze git repositories")
  .option("--analyze",    "Show repo stats (branches, stash, .git size)")
  .option("--branches",   "Remove merged local branches", true)
  .option("--gc",         "Run git garbage collection", true)
  .option("--stash",      "Clear git stash entries")
  .option("--untracked",  "Remove untracked files (git clean -fd)")
  .option("--dry-run",    "Preview actions without applying")
  .option("--aggressive", "Deep GC + stash + untracked")
  .action(async (opts) => {
    const gitPlugin = new GitPlugin();

    if (opts.analyze) {
      const spinner = ora("Scanning git repositories...").start();
      const report = await gitPlugin.analyze();
      spinner.stop();

      if (report.length === 0) {
        console.log(chalk.yellow("No git repositories found."));
        return;
      }

      console.log(chalk.bold(`\n📊 Git Repository Analysis (${report.length} repos)\n`));
      const maxName = Math.max(...report.map(r => r.name.length), 4);

      // Header
      console.log(
        chalk.gray(
          `${"Repo".padEnd(maxName)}  ${"Branches".padStart(8)}  ${"Merged".padStart(6)}  ${"Stash".padStart(5)}  ${"Git Size".padStart(9)}`
        )
      );
      console.log(chalk.gray("-".repeat(maxName + 35)));

      // Rows
      for (const r of report) {
        const merged = r.mergedCount > 0 ? chalk.yellow(String(r.mergedCount).padStart(6)) : chalk.gray("0".padStart(6));
        const stash  = r.stashCount  > 0 ? chalk.yellow(String(r.stashCount).padStart(5))  : chalk.gray("0".padStart(5));
        console.log(
          `${chalk.cyan(r.name.padEnd(maxName))}  ${String(r.branchCount).padStart(8)}  ${merged}  ${stash}  ${prettyBytes(r.gitSize).padStart(9)}`
        );
      }

      const totalSize = report.reduce((a, r) => a + r.gitSize, 0);
      const totalMerged = report.reduce((a, r) => a + r.mergedCount, 0);
      console.log(chalk.gray("-".repeat(maxName + 35)));
      console.log(`${"Total".padEnd(maxName)}  ${String(report.length).padStart(8)}  ${chalk.yellow(String(totalMerged).padStart(6))}  ${"".padStart(5)}  ${prettyBytes(totalSize).padStart(9)}\n`);
      return;
    }

    // Cleanup mode
    await gitPlugin.clean({
      dry:       opts.dryRun,
      aggressive: opts.aggressive,
      branches:  opts.branches,
      gc:        opts.gc,
      stash:     opts.stash || opts.aggressive,
      untracked: opts.untracked || opts.aggressive,
    });
  });

// ─── watch ───────────────────────────────────────────────────────────────────

program
  .command("watch")
  .description("Monitor disk usage and alert when threshold is exceeded")
  .option("-t, --threshold <size>", "Alert threshold (e.g. 1gb, 500mb)", "1gb")
  .option("-i, --interval <time>",  "Check interval (e.g. 30m, 1h, 90s)", "30m")
  .option("--auto-clean",           "Automatically clean when threshold exceeded")
  .action(async (opts) => {
    let thresholdBytes, intervalMs;

    try {
      thresholdBytes = parseThreshold(opts.threshold);
      intervalMs     = parseInterval(opts.interval);
    } catch (err) {
      console.error(chalk.red(`  ✗ ${err.message}`));
      process.exit(1);
    }

    await startWatch({
      threshold:  thresholdBytes,
      interval:   intervalMs,
      autoClean:  opts.autoClean,
    });
  });

// ─── schedule ────────────────────────────────────────────────────────────────

program
  .command("schedule")
  .description("Show instructions to schedule auto-cleanup")
  .option("--weekly",  "Schedule weekly cleanup")
  .option("--monthly", "Schedule monthly cleanup")
  .action((opts) => {
    const binPath = process.argv[1];
    const period  = opts.monthly ? "monthly" : "weekly";

    console.log(chalk.bold(`\n📅 Auto-Cleanup Schedule (${period}) — ${getPlatform().toUpperCase()}`));

    if (IS_WINDOWS) {
      const trigger = opts.monthly ? "MONTHLY" : "WEEKLY";
      console.log(chalk.gray("Run the following command in an elevated PowerShell/CMD:\n"));
      console.log(chalk.cyan(
        `schtasks /create /sc ${trigger} /tn "DevMop" /tr "node ${binPath} clean --all --aggressive" /f`
      ));
      console.log(chalk.yellow("\nNote: Run as Administrator to ensure Task Scheduler access.\n"));
    } else {
      const cronExpr = opts.monthly ? "0 0 1 * *" : "0 0 * * 0";
      console.log(chalk.gray("Add the following line to your crontab (run 'crontab -e'):\n"));
      console.log(chalk.cyan(`${cronExpr} ${binPath} clean --all --aggressive`));
      console.log(chalk.yellow("\nNote: Make sure the path to 'node' is in your crontab's PATH or use absolute paths.\n"));
    }
  });

program.parse();