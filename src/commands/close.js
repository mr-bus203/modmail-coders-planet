const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { closeTicket } = require('../utils/modmail');
const Config = require('../schemas/Config');
const ConfigManager = require('../utils/configManager');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ModMail ticket')
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for closing the ticket')
        .setRequired(false)),
  
  async execute(interaction) {
    // Check if this is a modmail channel
    if (!interaction.channel.name.startsWith('modmail-')) {
      return interaction.reply({
        content: 'This command can only be used in ModMail ticket channels.',
        ephemeral: true
      });
    }

    // Get the server configuration
    const guildConfig = await Config.findOne({ guildId: interaction.guild.id });
      
    if (!guildConfig) {
      logger.error(`No configuration found for guild ${interaction.guild.id}`);
      return interaction.reply({
        content: 'Error: Bot has not been set up. Please ask an administrator to run the /setup command.',
        ephemeral: true
      });
    }
    
    // Check if user has staff role
    const hasStaffRole = interaction.member.roles.cache.has(guildConfig.staffRoleId);
    if (!hasStaffRole) {
      return interaction.reply({
        content: `You do not have permission to close tickets. You need the <@&${guildConfig.staffRoleId}> role.`,
        ephemeral: true
      });
    }

    // Get the reason if provided
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Check if confirmation is required in config
    const closeConfirmation = await ConfigManager.getSetting(
      interaction.guild.id,
      'settings.tickets.closeConfirmation',
      true
    );
    
    // Get the configured embed color
    const embedColor = await ConfigManager.getSetting(
      interaction.guild.id, 
      'settings.appearance.embedColor',
      config.embedColor
    );

    if (closeConfirmation) {
      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_close')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_close')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder()
        .addComponents(confirmButton, cancelButton);

      // Send confirmation message
      const confirmEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Close Ticket?')
        .setDescription(`Are you sure you want to close this ticket?\n\n**Reason:** ${reason}`)
        .setFooter({ text: `${config.footer} • This confirmation will expire in 30 seconds` })
        .setTimestamp();

      const response = await interaction.reply({
        embeds: [confirmEmbed],
        components: [row],
        fetchReply: true
      });

      // Create a collector for button interactions
      const filter = i => i.user.id === interaction.user.id;
      try {
        const confirmation = await response.awaitMessageComponent({ filter, time: 30_000 });
        
        if (confirmation.customId === 'confirm_close') {
          // Proceed with closing the ticket
          await confirmation.update({
            content: 'Closing ticket...',
            embeds: [],
            components: []
          });
          
          const result = await closeTicket(
            interaction.channel, 
            interaction.client, 
            interaction.user, 
            reason
          );
          
          if (!result.success) {
            await interaction.followUp({
              content: `Error: ${result.error}`,
              ephemeral: true
            });
          }
        } else if (confirmation.customId === 'cancel_close') {
          await confirmation.update({
            content: 'Ticket close canceled.',
            embeds: [],
            components: []
          });
        }
      } catch (error) {
        // If the user doesn't respond in time
        await interaction.editReply({
          content: 'Ticket close canceled - confirmation timed out.',
          embeds: [],
          components: []
        });
      }
    } else {
      // If no confirmation required, close the ticket directly
      await interaction.reply({ content: 'Closing ticket...' });
      
      const result = await closeTicket(
        interaction.channel, 
        interaction.client, 
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
  }
}; 