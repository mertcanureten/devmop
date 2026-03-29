export class BasePlugin {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Returns metadata about the plugin.
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
    };
  }

  /**
   * Calculates the current disk usage for this plugin.
   * @returns {Promise<number>} Size in bytes.
   */
  async getSize() {
    throw new Error("getSize() must be implemented");
  }

  /**
   * Performs the cleanup action.
   * @param {Object} options Options like dryRun, aggressive, etc.
   */
  async clean(options) {
    throw new Error("clean() must be implemented");
  }
}
