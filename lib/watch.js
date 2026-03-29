import { pluginManager } from "./plugin-manager.js";
import { IS_MACOS, IS_LINUX, IS_WINDOWS } from "./platform.js";
import chalk from "chalk";
import prettyBytes from "pretty-bytes";
import { execa } from "execa";

// ─── Threshold Parser ─────────────────────────────────────────────────────────

/**
 * Parse a human-readable size string into bytes.
 * Supports: "1gb", "500mb", "2.5GB", "1024"
 * @param {string} str
 * @returns {number} bytes
 */
export function parseThreshold(str) {
  if (typeof str === "number") return str;
  const match = String(str).match(/^([\d.]+)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) throw new Error(`Invalid threshold: "${str}". Use e.g. 1gb, 500mb, 512`);
  const num = parseFloat(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const multipliers = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(num * multipliers[unit]);
}

// ─── Notification ─────────────────────────────────────────────────────────────

/**
 * Send a native OS notification. Falls back to terminal output on failure.
 * @param {string} title
 * @param {string} message
 */
export async function sendNotification(title, message) {
  try {
    if (IS_MACOS) {
      await execa("osascript", [
        "-e",
        `display notification "${message}" with title "${title}" sound name "Basso"`,
      ]);
      return;
    }

    if (IS_LINUX) {
      await execa("notify-send", [title, message, "--urgency=normal"]);
      return;
    }

    if (IS_WINDOWS) {
      // PowerShell toast notification
      const ps = [
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null",
        "$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
        `$xml.GetElementsByTagName('text')[0].InnerText = '${title}'`,
        `$xml.GetElementsByTagName('text')[1].InnerText = '${message}'`,
        "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('DevClean').Show($toast)",
      ].join("; ");
      await execa("powershell", ["-Command", ps]);
      return;
    }
  } catch {
    // All notification methods failed — terminal fallback below
  }

  // Terminal fallback (always works)
  process.stdout.write("\u0007"); // BEL character (terminal bell)
  console.log(chalk.bgRed.white.bold(` 🔔 ${title}: ${message} `));
}

// ─── Watch ────────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD_BYTES = parseThreshold("1gb");
const DEFAULT_INTERVAL_MS     = 30 * 60 * 1000; // 30 minutes

/**
 * Parse interval string to milliseconds.
 * Supports: "30m", "1h", "90s", "3600"
 */
export function parseInterval(str) {
  if (typeof str === "number") return str;
  const match = String(str).match(/^([\d.]+)\s*(s|m|h|d)?$/i);
  if (!match) throw new Error(`Invalid interval: "${str}". Use e.g. 30m, 1h, 90s`);
  const num = parseFloat(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Math.round(num * multipliers[unit]);
}

/**
 * Measure total recoverable space across all plugins.
 */
async function measureTotal() {
  const plugins = pluginManager.getAllPlugins();
  let total = 0;
  for (const plugin of plugins) {
    try {
      total += await plugin.getSize();
    } catch {
      // Plugin unavailable — skip
    }
  }
  return total;
}

/**
 * Start watch mode.
 * @param {Object} opts
 * @param {string|number} opts.threshold  Human-readable threshold (default "1gb")
 * @param {string|number} opts.interval   Check interval (default "30m")
 * @param {boolean}       opts.autoClean  If true, auto-run cleanup when threshold exceeded
 */
export async function startWatch({ threshold = DEFAULT_THRESHOLD_BYTES, interval = DEFAULT_INTERVAL_MS, autoClean = false } = {}) {
  const thresholdBytes = typeof threshold === "string" ? parseThreshold(threshold) : threshold;
  const intervalMs     = typeof interval  === "string" ? parseInterval(interval)   : interval;

  const thresholdHuman = prettyBytes(thresholdBytes);
  const intervalHuman  = formatInterval(intervalMs);

  console.log(chalk.bold("\n👁  DevClean Watch Mode"));
  console.log(chalk.gray(`   Threshold : ${chalk.yellow(thresholdHuman)}`));
  console.log(chalk.gray(`   Interval  : ${chalk.yellow(intervalHuman)}`));
  console.log(chalk.gray(`   Auto-clean: ${autoClean ? chalk.green("enabled") : chalk.gray("disabled")}`));
  console.log(chalk.gray(`   Press ${chalk.white("Ctrl+C")} to stop.\n`));

  let lastAlerted = false;

  const check = async () => {
    const total = await measureTotal();
    const totalHuman = prettyBytes(total);
    const ts = new Date().toLocaleTimeString();

    if (total >= thresholdBytes) {
      if (!lastAlerted) {
        console.log(chalk.red(`\n  [${ts}] ⚠️  Recoverable space ${chalk.bold(totalHuman)} exceeds threshold ${chalk.bold(thresholdHuman)}`));
        await sendNotification(
          "DevClean — Disk Alert 🚨",
          `${totalHuman} recoverable — run \`devclean clean --all\``
        );
        lastAlerted = true;

        if (autoClean) {
          console.log(chalk.yellow("  🧹 Auto-cleaning..."));
          for (const plugin of pluginManager.getAllPlugins()) {
            try { await plugin.clean({ dry: false, aggressive: false }); } catch { /* skip */ }
          }
          console.log(chalk.green("  ✔ Auto-clean complete\n"));
          lastAlerted = false; // reset after clean
        }
      } else {
        console.log(chalk.gray(`  [${ts}] Still above threshold: ${totalHuman}`));
      }
    } else {
      lastAlerted = false; // reset if falls below
      console.log(chalk.green(`  [${ts}] ✔ ${totalHuman} recoverable — under threshold`));
    }
  };

  // Run immediately, then on interval
  await check();
  const timer = setInterval(check, intervalMs);

  // Graceful shutdown
  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log(chalk.gray("\n\n  Watch stopped. Goodbye.\n"));
    process.exit(0);
  });
}

// ─── Internal ────────────────────────────────────────────────────────────────

function formatInterval(ms) {
  if (ms < 60_000)        return `${ms / 1000}s`;
  if (ms < 3_600_000)     return `${ms / 60_000}m`;
  if (ms < 86_400_000)    return `${ms / 3_600_000}h`;
  return `${ms / 86_400_000}d`;
}
