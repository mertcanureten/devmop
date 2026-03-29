import { DockerPlugin } from "./plugins/docker-plugin.js";
import { NodePlugin } from "./plugins/node-plugin.js";
import { SystemPlugin } from "./plugins/system-plugin.js";
import { FlutterPlugin } from "./plugins/flutter-plugin.js";
import { GitPlugin } from "./plugins/git-plugin.js";

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.registerDefaultPlugins();
  }

  registerDefaultPlugins() {
    this.register(new DockerPlugin());
    this.register(new NodePlugin());
    this.register(new SystemPlugin());
    this.register(new FlutterPlugin());
    this.register(new GitPlugin());
  }

  register(plugin) {
    this.plugins.set(plugin.name, plugin);
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = new PluginManager();
