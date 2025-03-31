const logger = require('../utils/logger');
const { closeTicket } = require('../utils/modmail');
const Config = require('../schemas/Config');
const SetupHandler = require('../utils/setup/setupHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        
        // If the interaction has been replied to or deferred, edit the reply
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'There was an error while executing this command!',
            ephemeral: true
          });
        } else {
          // Otherwise, reply with the error
          await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true
          });
        }
      }
    }
    
    // Handle buttons
    else if (interaction.isButton()) {
      try {
        const { customId } = interaction;
        
        // Handle specific button interactions that aren't handled by collectors
        
        // Close ticket confirmation buttons
        if (customId === 'confirm_close') {
          await interaction.update({
            content: 'Closing ticket...',
            embeds: [],
            components: []
          });
          
          const reason = interaction.message.embeds[0]?.description?.match(/\*\*Reason:\*\* (.*)/)?.[1] || 'No reason provided';
          
          const result = await closeTicket(
            interaction.channel, 
            client, 
            interaction.user, 
            reason
          );
          
          if (!result.success) {
            await interaction.followUp({
              content: `Error: ${result.error}`,
              ephemeral: true
            });
          }
        } 
        else if (customId === 'cancel_close') {
          await interaction.update({
            content: 'Ticket close canceled.',
            embeds: [],
            components: []
          });
        }
        
        // Setup buttons are handled by the setup command collector
        // Button handlers for other features can be added here as needed
      } catch (error) {
        logger.error(`Error handling button interaction ${interaction.customId}:`, error);
        
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'There was an error processing this interaction!',
              ephemeral: true
            });
          } else {
            await interaction.followUp({
              content: 'There was an error processing this interaction!',
              ephemeral: true
            });
          }
        } catch (replyError) {
          logger.error('Error replying to failed interaction:', replyError);
        }
      }
    }
    
    // Handle select menus
    else if (interaction.isStringSelectMenu()) {
      // Handle select menu interactions that aren't handled by collectors
      logger.debug(`Select menu interaction: ${interaction.customId}`);
    }
    
    // Handle modal submissions that aren't handled by collectors
    else if (interaction.isModalSubmit()) {
      // Skip if this interaction is already being handled by a setup command
      if (interaction._setupHandled) return;
      
      const { customId } = interaction;
      
      // Handle specific modal submissions that aren't part of a collector
      logger.debug(`Modal submission: ${customId}`);
      
      // If it's a setup modal not caught by the collector
      if (customId.startsWith('modal_') && !interaction.replied && !interaction.deferred) {
        try {
          // Get the guild configuration
          const guildConfig = await Config.findOne({ guildId: interaction.guild.id });
          if (!guildConfig) {
            logger.error(`No configuration found for guild ${interaction.guild.id}`);
            return;
          }
          
          // Try to handle with the SetupHandler
          await SetupHandler.handleModalSubmit(interaction, guildConfig);
        } catch (error) {
          logger.error(`Error handling modal submission ${customId}:`, error);
          
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'There was an error processing your submission. Please try again.',
                ephemeral: true
              });
            }
          } catch (replyError) {
            logger.error('Error replying to failed modal submission:', replyError);
          }
        }
      }
    }
  }
}; 