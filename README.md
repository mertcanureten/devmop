<div align="center">

# devmop

**Mop up the junk that silently eats your disk.**

[![npm version](https://img.shields.io/npm/v/devmop.svg?style=flat-square)](https://www.npmjs.com/package/devmop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)](#cross-platform-support)

`node_modules`, Docker images, git garbage, Flutter caches, system temp files —  
devmop finds them all and wipes them clean, on any OS.

</div>

---

## Quick Start

```bash
# Install globally
npm install -g devmop

# See how much disk space you can recover
devmop usage

# Interactive cleanup — pick what to clean
devmop clean -i

# Clean everything, no questions asked
devmop clean --all
```

---

## Features

- **Plugin Architecture** — Modular cleaners for Node.js, Docker, Git, Flutter, and System caches. Easy to extend.
- **Cross-Platform** — Runs natively on macOS, Linux, and Windows. No bash required.
- **Disk Analyzer** — Visual ASCII bar chart showing exactly how much space each category uses.
- **Interactive Mode** — Multi-select TUI to cherry-pick what to clean.
- **Watch Mode** — Monitors disk usage in the background and sends a native OS notification when a threshold is exceeded.
- **Git Workspace Cleaner** — GC, merged branch removal, stash clearing, and untracked file cleanup across all your repos.
- **Dry Run** — Preview every deletion before anything is touched.
- **Configurable** — Persistent settings via `~/.devmoprc`.
- **Scheduling** — One-line crontab (Linux/macOS) or Task Scheduler (Windows) setup.

---

## Commands

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
