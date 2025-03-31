/**
 * Configuration Manager for ModMail
 * 
 * Handles retrieving and updating configuration settings in the database
 */

const Config = require('../schemas/Config');
const logger = require('./logger');

class ConfigManager {
  /**
   * Gets a guild's configuration from the database
   * @param {string} guildId - The Discord guild ID
   * @returns {Promise<Object|null>} The configuration or null if not found
   */
  static async getConfig(guildId) {
    try {
      const config = await Config.findOne({ guildId });
      
      if (!config) {
        logger.warn(`No configuration found for guild ${guildId}`);
        return null;
      }
      
      return config;
    } catch (error) {
      logger.error(`Error getting configuration for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Updates a specific setting in a guild's configuration
   * @param {string} guildId - The Discord guild ID
   * @param {string} path - The path to the setting (dot notation)
   * @param {*} value - The new value
   * @returns {Promise<Object|null>} The updated configuration or null on error
   */
  static async updateSetting(guildId, path, value) {
    try {
      // Check if guild config exists
      let config = await this.getConfig(guildId);
      
      if (!config) {
        logger.error(`Cannot update setting for non-existent guild ${guildId}`);
        return null;
      }
      
      // Convert dot notation path to MongoDB update syntax
      const updateData = {};
      updateData[path] = value;
      
      // Update the setting and return the updated document
      const updated = await Config.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { new: true }
      );
      
      logger.info(`Updated setting ${path} for guild ${guildId}`);
      return updated;
    } catch (error) {
      logger.error(`Error updating setting ${path} for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Retrieves a specific setting value from a guild's configuration
   * @param {string} guildId - The Discord guild ID
   * @param {string} path - The path to the setting (dot notation)
   * @param {*} defaultValue - Default value if setting doesn't exist
   * @returns {Promise<*>} The setting value or defaultValue if not found
   */
  static async getSetting(guildId, path, defaultValue = null) {
    try {
      const config = await this.getConfig(guildId);
      
      if (!config) {
        logger.warn(`Using default value for ${path} as no config exists for guild ${guildId}`);
        return defaultValue;
      }
      
      // Navigate through the configuration object using the path
      const pathParts = path.split('.');
      let current = config;
      
      for (const part of pathParts) {
        if (current === null || current === undefined) {
          return defaultValue;
        }
        
        current = current[part];
      }
      
      // Return the value or the default if undefined/null
      return current !== undefined && current !== null ? current : defaultValue;
    } catch (error) {
      logger.error(`Error getting setting ${path} for guild ${guildId}:`, error);
      return defaultValue;
    }
  }
}

module.exports = ConfigManager; 