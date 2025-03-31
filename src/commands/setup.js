const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const SetupHandler = require('../utils/setup/setupHandler');
const SetupUIManager = require('../utils/setup/setupUIManager');
const logger = require('../utils/logger');
const Config = require('../schemas/Config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the ModMail system for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    // Initialize setup session
    const setupResult = await SetupHandler.initSetup(interaction);
    
    if (!setupResult.success) {
      return interaction.reply({ 
        content: setupResult.error || 'Failed to initialize setup. Please try again.',
        ephemeral: true 
      });
    }
    
    // Setup successful, we'll track the setup session
    let session = setupResult;
    
    // Create a collector for button interactions
    const message = setupResult.setupMessage;
    const filter = i => i.user.id === interaction.user.id;
    
    const collector = message.createMessageComponentCollector({
      filter,
      idle: 300000 // 5 minute idle timeout
    });
    
    // Handle button and select menu interactions
    collector.on('collect', async (i) => {
      try {
        // Process the interaction based on its type
        if (i.isButton()) {
          const result = await SetupHandler.handleButtonInteraction(i, session.guildConfig);
          
          // Update session with result
          session = { ...session, ...result };
          
          // If setup is no longer active, end the collector
          if (!session.active) {
            collector.stop('completed');
          }
        }
        // Handle select menu interactions
        else if (i.isStringSelectMenu()) {
          const result = await handleSelectMenuInteraction(i, session.guildConfig);
          
          // Update session with result
          session = { ...session, ...result };
        }
      } catch (error) {
        logger.error('Error in setup command collector:', error);
        await i.reply({ 
          content: 'An error occurred while processing your request. Please try again.',
          ephemeral: true 
        });
      }
    });
    
    // Handle collector end
    collector.on('end', (collected, reason) => {
      if (reason === 'idle') {
        interaction.followUp({ 
          content: 'Setup timed out due to inactivity. Your changes have been saved. Use `/setup` again to continue configuring the system.',
          ephemeral: true 
        });
      }
    });
    
    // Set up a listener for modal submissions
    const modalFilter = i => i.user.id === interaction.user.id && i.customId.startsWith('modal_');
    
    // Create a unique listener name for this setup session
    const listenerName = `setupModalListener_${Date.now()}_${interaction.user.id}`;
    
    // This will listen for modal submissions for the duration of the setup session
    const modalHandler = async (i) => {
      // Skip if not a modal or not from the current user or not a setup modal
      if (!i.isModalSubmit() || !modalFilter(i) || i.replied || i.deferred) return;
      
      try {
        // Mark the interaction as being handled by this specific setup session
        i._setupHandled = true;
        
        // Handle the modal submission
        const result = await SetupHandler.handleModalSubmit(i, session.guildConfig);
        
        // Update session with result
        if (result && Object.keys(result).length > 0) {
          session = { ...session, ...result };
        }
      } catch (error) {
        logger.error('Error handling modal submission in setup command:', error);
        
        // Try to notify the user if we haven't replied yet
        try {
          if (!i.replied && !i.deferred) {
            await i.reply({ 
              content: 'An error occurred while processing your setup request. Please try again.',
              ephemeral: true 
            });
          }
        } catch (replyError) {
          logger.error('Error sending error notification to user:', replyError);
        }
      }
    };
    
    // Add the listener
    interaction.client.on('interactionCreate', modalHandler);
    
    // Remove the listener when the collector ends
    collector.on('end', () => {
      interaction.client.removeListener('interactionCreate', modalHandler);
      logger.debug(`Removed setup modal listener: ${listenerName}`);
    });
  }
};

/**
 * Handle select menu interactions for setup
 * @param {Object} interaction - The select menu interaction
 * @param {Object} guildConfig - Current guild config
 * @returns {Promise<Object>} Updated session data
 */
async function handleSelectMenuInteraction(interaction, guildConfig) {
  const { customId, values } = interaction;
  const selectedValue = values[0];
  
  try {
    // Color selection
    if (customId === 'color_select') {
      await Config.findOneAndUpdate(
        { guildId: guildConfig.guildId },
        { $set: { 'settings.appearance.embedColor': selectedValue } },
        { new: true }
      );
      
      const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
      await interaction.update(SetupUIManager.getAppearanceSettingsEmbed(updatedConfig));
      return { guildConfig: updatedConfig, step: 'appearance' };
    }
    
    // Ticket limit selection
    else if (customId === 'ticket_limit_select') {
      const limit = parseInt(selectedValue);
      
      await Config.findOneAndUpdate(
        { guildId: guildConfig.guildId },
        { $set: { 'settings.tickets.maxOpenTickets': limit } },
        { new: true }
      );
      
      const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
      await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
      return { guildConfig: updatedConfig, step: 'tickets' };
    }
    
    // Auto-close time selection
    else if (customId === 'auto_close_select') {
      const hours = parseInt(selectedValue);
      const isEnabled = hours > 0;
      
      await Config.findOneAndUpdate(
        { guildId: guildConfig.guildId },
        { 
          $set: { 
            'settings.tickets.autoClose': isEnabled,
            'settings.tickets.autoCloseTime': hours || 48
          } 
        },
        { new: true }
      );
      
      const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
      await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
      return { guildConfig: updatedConfig, step: 'tickets' };
    }
    
    // Default case - just return current session data
    return {};
    
  } catch (error) {
    logger.error(`Error handling select menu ${customId}:`, error);
    await interaction.reply({
      content: 'An error occurred while processing your selection. Please try again.',
      ephemeral: true
    });
    return { error: error.message };
  }
} 