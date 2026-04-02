<div align="center">

# devmop

**Mop up the junk that silently eats your disk.**

[![npm version](https://img.shields.io/npm/v/devmop.svg?style=flat-square)](https://www.npmjs.com/package/devmop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)](#cross-platform-support)

`node_modules`, Docker images, git garbage, Flutter caches, system temp files —  
devmop finds them all and wipes them clean, on any OS.

---

## 🖥 Terminal Dashboard (TUI) — New in v1.1.0!

devmop now features a beautiful, full-screen interactive dashboard (inspired by `htop`). No more guessing — see your disk usage in real-time and clean it with a single keystroke.

Launch it with just:
```bash
devmop
# or
devmop dashboard
```

### Dashboard Features:
- **ASCII Bar Charts** — Visual representation of disk usage per category.
- **Interactive Sidebar** — Navigate through plugins with arrow keys.
- **Instant Cleanup** — Press `C` to clean selected plugin or `A` for everything.
- **Alternate Buffer** — Stays in the dashboard, leaves your terminal scroll-back clean.

---

## Quick Start

```bash
# Install globally
npm install -g devmop

# Launch the Dashboard (Recommended)
devmop

# Classic CLI usage
devmop usage           # Detailed size breakdown
devmop clean -i        # Interactive menu clean
devmop clean --system  # Immediate system cleanup
```

---

## Features

- **Terminal Dashboard (TUI)** — A premium, full-screen interactive experience.
- **Plugin Architecture** — Modular cleaners for Node.js, Docker, Git, Flutter, and System caches.
- **Cross-Platform** — Native support for macOS, Linux, and Windows.
- **Disk Analyzer** — Stylish ASCII charts showing space recovered.
- **Watch Mode** — Background monitoring with native OS notifications.
- **Git Workspace Cleaner** — Deep-clean branches, GC, and more across all local repos.
- **Safety First** — Robust permission handling and `dry-run` support.

---

## Commands

### `devmop dashboard` (or simply `devmop`)

Launches the interactive TUI. Use it to navigate and clean categories visually.

**Shortcuts inside Dashboard:**
- `↑ / ↓` — Navigate categories
- `C` — Clean selected plugin
- `A` — Clean ALL categories
- `Q` — Quits the dashboard

---

### `devmop clean` — Run cleanup

```bash
devmop clean [targets] [options]
```

**Targets**

| Flag | What it cleans |
| --- | --- |
| `--node` | `node_modules` directories + npm cache |
| `--docker` | Docker images, containers, volumes, builder cache |
| `--git` | Git GC, merged branches |
| `--flutter` | Flutter build artifacts + pub cache |
| `--system` | OS temp files, caches, logs |
| `--all` | Everything above |
| `-i, --interactive` | Multi-select TUI to choose targets |

**Options**

| Flag | Description |
| --- | --- |
| `--dry-run` | Show what would be deleted — nothing is touched |
| `--aggressive` | Deep clean (Xcode data, stash, untracked files, git `--aggressive` GC) |

**Examples**

```bash
devmop clean --all --dry-run     # Preview everything
devmop clean --node --docker     # Clean Node + Docker only
devmop clean --all --aggressive  # Deep clean everything
devmop clean -i                  # Pick interactively
```

---

### `devmop usage` — Disk usage breakdown

```bash
devmop usage
```

Scans all plugins and renders an ASCII bar chart:

```
Disk Usage Breakdown:
═══════════════════════════════════════════════════════════
node    [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   3.2 GB
system  [████████████████████████████████████████]  12.1 GB
docker  [██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 800.0 MB
flutter [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 420.0 MB
git     [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 120.0 MB
═══════════════════════════════════════════════════════════
Total Recoverable: 16.64 GB
```

---

### `devmop git` — Git workspace manager

```bash
devmop git [options]
```

| Flag | Description |
| --- | --- |
| `--analyze` | Table view of all repos: branch count, merged branches, stash entries, `.git` size |
| `--branches` | Delete merged local branches (keeps `main`, `master`, `develop`) |
| `--gc` | Run `git gc --prune=now` on every repo |
| `--stash` | Clear all stash entries |
| `--untracked` | Remove untracked files (`git clean -fd`) |
| `--aggressive` | All of the above + deep GC |
| `--dry-run` | Preview actions |

**Examples**

```bash
devmop git --analyze            # See stats across all repos
devmop git --dry-run            # Preview what would change
devmop git --branches --gc      # Remove merged branches + GC
devmop git --aggressive         # Full deep clean
```

**`--analyze` output**

```
Git Repository Analysis (31 repos)

Repo                              Branches  Merged  Stash   Git Size
----------------------------------------------------------------------
projects/my-app                         18       9      1    2.23 MB
projects/another-project                 3       2      0     857 kB
tools/sqlmap                             1       0      0    89.9 MB
----------------------------------------------------------------------
Total                                   31      19           521 MB
```

---

### `devmop watch` — Disk usage monitor

```bash
devmop watch [options]
```

Runs in the foreground, checking disk usage on a set interval. Sends a **native OS notification** (macOS Notification Center, Linux `notify-send`, Windows toast) when the threshold is exceeded.

| Flag | Default | Description |
| --- | --- | --- |
| `-t, --threshold <size>` | `1gb` | Alert threshold. Accepts `500mb`, `2.5gb`, `1024`, etc. |
| `-i, --interval <time>` | `30m` | Check interval. Accepts `30s`, `15m`, `1h`, etc. |
| `--auto-clean` | off | Automatically run `clean --all` when threshold is exceeded |

**Examples**

```bash
devmop watch                              # Default: 1gb threshold, check every 30m
devmop watch --threshold 5gb             # Alert above 5 GB
devmop watch --threshold 2gb --interval 1h
devmop watch --threshold 500mb --auto-clean  # Auto-clean when exceeded
```

---

### `devmop schedule` — Set up automatic cleanup

```bash
devmop schedule [--weekly | --monthly]
```

Prints a ready-to-use cron expression (macOS/Linux) or `schtasks` command (Windows).

```bash
devmop schedule --weekly   # Every Sunday at midnight
devmop schedule --monthly  # First of every month
```

---

## Cross-Platform Support

devmop automatically detects the OS and adapts — no configuration needed.

| Feature | macOS | Linux | Windows |
| --- | :---: | :---: | :---: |
| Node.js cleanup | ✅ | ✅ | ✅ |
| Docker cleanup | ✅ | ✅ | ✅ |
| Git workspace | ✅ | ✅ | ✅ |
| Flutter cleanup | ✅ | ✅ | ✅ |
| System caches | `~/Library/Caches` | `~/.cache` | `%LOCALAPPDATA%\Temp` |
| OS notifications | Notification Center | `notify-send` | Toast notification |
| Scheduling | `crontab` | `crontab` | Task Scheduler |

---

## Plugin System

Each cleaner is a plugin that extends `BasePlugin`:

```js
// lib/plugins/my-plugin.js
import { BasePlugin } from "../base-plugin.js";

export class MyPlugin extends BasePlugin {
  constructor() {
    super("myplugin", "Clean my tool's cache");
  }

  async getSize() { /* return bytes */ }
  async clean({ dry, aggressive }) { /* perform cleanup */ }
}
```

Register it in `lib/plugin-manager.js`:

```js
import { MyPlugin } from "./plugins/my-plugin.js";
this.register(new MyPlugin());
```

---

## Configuration

devmop reads `~/.devmoprc` on startup:

```json
{
  "defaults": {
    "aggressive": false
  },
  "plugins": {}
}
```

---

## Benchmarks

| Scenario | Scan Time | Recovered |
| --- | --- | --- |
| 50+ JS projects (`node_modules`) | ~2.1s | 12.4 GB |
| Docker (medium usage) | ~0.4s | 4.8 GB |
| 31 git repos (GC + branches) | ~18s | 521 MB |
| System caches (macOS) | ~0.8s | 2.1 GB |

---

## Contributing

Contributions welcome! Great first plugins to add: **Python** (`__pycache__`, `.venv`), **Rust** (`target/`), **Go** (`~/go/pkg/mod`), **Gradle** (`.gradle/`, `build/`).

```bash
git clone https://github.com/mertcanureten/devmop
cd devmop
npm install
node bin/devmop.js --help
```

---

## License

MIT © [Mertcan Ureten](https://github.com/mertcanureten)
