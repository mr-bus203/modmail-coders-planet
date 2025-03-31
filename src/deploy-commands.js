require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const mongoose = require('mongoose');
const Config = require('./schemas/Config');

/**
 * Deploy commands to Discord
 * This function handles both global command registration and also
 * checks for removed commands to clean them up
 */
async function deployCommands() {
  try {
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    // Read command files
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Load command data
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }
    
    // Get registered commands to compare
    const registeredCommands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
    
    // Find commands to delete (exist on Discord but not in our files)
    const commandsToDelete = registeredCommands.filter(
      registeredCmd => !commands.some(localCmd => localCmd.name === registeredCmd.name)
    );
    
    // Delete commands that don't exist anymore
    for (const cmdToDelete of commandsToDelete) {
      logger.info(`Removing obsolete command: ${cmdToDelete.name}`);
      await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, cmdToDelete.id));
    }
    
    // Deploy all current commands (globally)
    logger.info(`Started refreshing ${commands.length} application (/) commands...`);
    
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    
    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    
    if (commandsToDelete.length > 0) {
      logger.info(`Removed ${commandsToDelete.length} obsolete commands.`);
    }
    
    return { success: true, added: data.length, removed: commandsToDelete.length };
  } catch (error) {
    logger.error('Error deploying commands:', error);
    return { success: false, error: error.message };
  }
}

// Execute the deployment if this file was run directly
if (require.main === module) {
  deployCommands().then(result => {
    if (result.success) {
      logger.info('Command deployment completed successfully');
      process.exit(0);
    } else {
      logger.error('Command deployment failed');
      process.exit(1);
    }
  });
} else {
  // Export for use in other files
  module.exports = deployCommands;
} 