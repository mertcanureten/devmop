import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const CONFIG_FILE = path.join(os.homedir(), ".devmoprc");

export async function loadConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return {
      plugins: {},
      defaults: {
        aggressive: false,
      }
    };
  }
}

export async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Failed to save config:", err.message);
  }
}
