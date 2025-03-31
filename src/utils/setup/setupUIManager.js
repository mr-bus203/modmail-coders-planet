const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  EmbedBuilder 
} = require('discord.js');
const config = require('../../config/config');
const ConfigManager = require('../configManager');

/**
 * Manages the UI components for the setup command
 */
class SetupUIManager {
  /**
   * Creates the main setup embed with buttons
   * @param {Object} guildConfig - The guild's configuration
   * @returns {Object} The embed and components
   */
  static getMainSetupEmbed(guildConfig) {
    // Get settings using fallbacks if they don't exist
    const maxOpenTickets = guildConfig.settings?.tickets?.maxOpenTickets || 3;
    const autoClose = guildConfig.settings?.tickets?.autoClose ?? true;
    const embedColor = guildConfig.settings?.appearance?.embedColor || config.embedColor;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('ModMail Configuration')
      .setDescription('Use the buttons below to configure your ModMail system. Click on a category to view and modify its settings.')
      .addFields(
        { 
          name: 'Current Configuration', 
          value: `
Category: <#${guildConfig.modmailCategoryId}>
Log Channel: <#${guildConfig.logChannelId}>
Staff Role: <@&${guildConfig.staffRoleId}>
Max Open Tickets: ${maxOpenTickets}
Auto-Close: ${autoClose ? 'Enabled' : 'Disabled'}
`
        }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();

    // Main category buttons
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_tickets')
          .setLabel('Ticket Settings')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_messages')
          .setLabel('Message Settings')
          .setEmoji('💬')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_appearance')
          .setLabel('Appearance')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Primary)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_channels')
          .setLabel('Channels & Roles')
          .setEmoji('🔧')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_auto')
          .setLabel('Auto Setup')
          .setEmoji('⚡')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_save')
          .setLabel('Save & Exit')
          .setEmoji('💾')
          .setStyle(ButtonStyle.Success)
      );
    
    return {
      embeds: [embed],
      components: [row1, row2]
    };
  }

  /**
   * Creates the ticket settings embed with buttons
   * @param {Object} guildConfig - The guild's configuration
   * @returns {Object} The embed and components
   */
  static getTicketSettingsEmbed(guildConfig) {
    // Get settings with fallbacks
    const maxOpenTickets = guildConfig.settings?.tickets?.maxOpenTickets || 3;
    const closeConfirmation = guildConfig.settings?.tickets?.closeConfirmation ?? true;
    const transcripts = guildConfig.settings?.tickets?.transcripts ?? true;
    const logsEnabled = guildConfig.settings?.tickets?.logsEnabled ?? true;
    const autoClose = guildConfig.settings?.tickets?.autoClose ?? true;
    const autoCloseTime = guildConfig.settings?.tickets?.autoCloseTime || 48;
    const pingStaff = guildConfig.settings?.tickets?.pingStaff ?? false;
    const requireTopic = guildConfig.settings?.tickets?.requireTopic ?? false;
    const nameFormat = guildConfig.settings?.tickets?.nameFormat || 'modmail-{username}';
    const embedColor = guildConfig.settings?.appearance?.embedColor || config.embedColor;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Ticket Settings')
      .setDescription('Configure how tickets are handled in your server.')
      .addFields(
        { name: 'Max Open Tickets', value: `${maxOpenTickets}`, inline: true },
        { name: 'Close Confirmation', value: closeConfirmation ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Transcripts', value: transcripts ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Logs', value: logsEnabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Auto-Close', value: `${autoClose ? `After ${autoCloseTime} hours` : 'Disabled'}`, inline: true },
        { name: 'Ping Staff', value: pingStaff ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Require Topic', value: requireTopic ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Channel Name Format', value: `\`${nameFormat}\``, inline: true }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create the buttons for ticket settings
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_ticket_limit')
          .setLabel('Set Max Tickets')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_close_confirmation')
          .setLabel(closeConfirmation ? 'Disable Confirmation' : 'Enable Confirmation')
          .setStyle(closeConfirmation ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_transcripts')
          .setLabel(transcripts ? 'Disable Transcripts' : 'Enable Transcripts')
          .setStyle(transcripts ? ButtonStyle.Danger : ButtonStyle.Success)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_logs')
          .setLabel(logsEnabled ? 'Disable Logs' : 'Enable Logs')
          .setStyle(logsEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_auto_close')
          .setLabel(autoClose ? 'Configure Auto-Close' : 'Enable Auto-Close')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_ping_staff')
          .setLabel(pingStaff ? 'Disable Ping Staff' : 'Enable Ping Staff')
          .setStyle(pingStaff ? ButtonStyle.Danger : ButtonStyle.Success)
      );
    
    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_require_topic')
          .setLabel(requireTopic ? 'Disable Topic' : 'Require Topic')
          .setStyle(requireTopic ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_name_format')
          .setLabel('Edit Name Format')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Primary)
      );
      
    return {
      embeds: [embed],
      components: [row1, row2, row3]
    };
  }

  /**
   * Get the embed for configuring message templates
   * @param {Object} guildConfig - Guild configuration
   * @returns {Object} Embed and components
   */
  static getMessageSettingsEmbed(guildConfig) {
    // Get message templates with fallbacks
    const welcomeMessage = guildConfig.settings?.messages?.welcomeMessage || 
      'Thank you for creating a ticket. The staff team will respond as soon as possible.';
    const closeMessage = guildConfig.settings?.messages?.closeMessage || 
      'This ticket has been closed. If you need further assistance, please create a new ticket.';
    const responseMessage = guildConfig.settings?.messages?.responseMessage || 'Staff reply:';
    const embedColor = guildConfig.settings?.appearance?.embedColor || config.embedColor;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Message Templates')
      .setDescription('Configure message templates used by the ModMail bot.')
      .addFields(
        { 
          name: 'Welcome Message', 
          value: welcomeMessage.length > 100 ? welcomeMessage.substring(0, 100) + '...' : welcomeMessage
        },
        { 
          name: 'Close Message', 
          value: closeMessage.length > 100 ? closeMessage.substring(0, 100) + '...' : closeMessage
        },
        { 
          name: 'Staff Response Prefix', 
          value: responseMessage
        }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create buttons for message settings
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_welcome_message')
          .setLabel('Edit Welcome Message')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_close_message')
          .setLabel('Edit Close Message')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_response_message')
          .setLabel('Edit Response Prefix')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Primary)
      );
    
    return {
      embeds: [embed],
      components: [row1, row2]
    };
  }

  /**
   * Get the embed for configuring appearance settings
   * @param {Object} guildConfig - Guild configuration
   * @returns {Object} Embed and components
   */
  static getAppearanceSettingsEmbed(guildConfig) {
    // Get appearance settings with fallbacks
    const embedColor = guildConfig.settings?.appearance?.embedColor || config.embedColor;
    const useTimestamps = guildConfig.settings?.appearance?.useTimestamps ?? true;
    const showUserInfo = guildConfig.settings?.appearance?.showUserInfo ?? true;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Appearance Settings')
      .setDescription('Configure how messages and embeds look.')
      .addFields(
        { name: 'Embed Color', value: embedColor, inline: true },
        { name: 'Use Timestamps', value: useTimestamps ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Show User Info', value: showUserInfo ? 'Enabled' : 'Disabled', inline: true }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create buttons for appearance settings
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_embed_color')
          .setLabel('Set Embed Color')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_timestamps')
          .setLabel(useTimestamps ? 'Disable Timestamps' : 'Enable Timestamps')
          .setStyle(useTimestamps ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_user_info')
          .setLabel(showUserInfo ? 'Hide User Info' : 'Show User Info')
          .setStyle(showUserInfo ? ButtonStyle.Danger : ButtonStyle.Success)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Primary)
      );
    
    return {
      embeds: [embed],
      components: [row1, row2]
    };
  }

  /**
   * Get the embed for configuring channels and roles
   * @param {Object} guildConfig - Guild configuration
   * @returns {Object} Embed and components
   */
  static getChannelsRolesEmbed(guildConfig) {
    const embedColor = guildConfig.settings?.appearance?.embedColor || config.embedColor;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Channels & Roles')
      .setDescription('Configure essential channels and roles for the ModMail system.')
      .addFields(
        { name: 'ModMail Category', value: `<#${guildConfig.modmailCategoryId}>`, inline: true },
        { name: 'Log Channel', value: `<#${guildConfig.logChannelId}>`, inline: true },
        { name: 'Staff Role', value: `<@&${guildConfig.staffRoleId}>`, inline: true }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create buttons for channel and role settings
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category')
          .setLabel('Set Category')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_log_channel')
          .setLabel('Set Log Channel')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_staff_role')
          .setLabel('Set Staff Role')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Primary)
      );
    
    return {
      embeds: [embed],
      components: [row1, row2]
    };
  }

  /**
   * Get the embed for selecting an embed color
   * @returns {Object} Embed and components
   */
  static getColorPickerEmbed() {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Select Embed Color')
      .setDescription('Choose a color for ModMail embeds:')
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create a select menu for color options
    const colorOptions = [
      { label: 'Blurple', value: '#5865F2', description: 'Default Discord color' },
      { label: 'Red', value: '#ED4245', description: 'For errors or warnings' },
      { label: 'Green', value: '#57F287', description: 'For success messages' },
      { label: 'Yellow', value: '#FEE75C', description: 'For pending or in-progress' },
      { label: 'Pink', value: '#EB459E', description: 'For playful or fun themes' },
      { label: 'Purple', value: '#9C27B0', description: 'Calm and professional' },
      { label: 'Orange', value: '#FF9800', description: 'Energetic and warm' },
      { label: 'Cyan', value: '#00BCD4', description: 'Cool and calming' }
    ];
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('color_select')
          .setPlaceholder('Select a color')
          .addOptions(colorOptions)
      );
    
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_appearance')
          .setLabel('Back to Appearance')
          .setStyle(ButtonStyle.Secondary)
      );
    
    return {
      embeds: [embed],
      components: [row, backButton]
    };
  }

  /**
   * Get the embed for setting ticket limit
   * @returns {Object} Embed and components
   */
  static getTicketLimitEmbed() {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Set Max Open Tickets')
      .setDescription('Select the maximum number of open tickets a user can have at once:')
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create a select menu for ticket limit options
    const limitOptions = [
      { label: 'Unlimited', value: '0', description: 'No limit on open tickets' },
      { label: '1 Ticket', value: '1', description: 'Only one open ticket per user' },
      { label: '2 Tickets', value: '2', description: 'Two open tickets per user' },
      { label: '3 Tickets', value: '3', description: 'Three open tickets per user (recommended)' },
      { label: '5 Tickets', value: '5', description: 'Five open tickets per user' },
      { label: '10 Tickets', value: '10', description: 'Ten open tickets per user' }
    ];
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_limit_select')
          .setPlaceholder('Select a limit')
          .addOptions(limitOptions)
      );
    
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_tickets')
          .setLabel('Back to Ticket Settings')
          .setStyle(ButtonStyle.Secondary)
      );
    
    return {
      embeds: [embed],
      components: [row, backButton]
    };
  }

  /**
   * Get the embed for setting auto-close time
   * @returns {Object} Embed and components
   */
  static getAutoCloseEmbed() {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Configure Auto-Close')
      .setDescription('Select how many hours of inactivity before tickets are automatically closed:')
      .setFooter({ text: config.footer })
      .setTimestamp();
    
    // Create a select menu for auto-close options
    const timeOptions = [
      { label: 'Disable Auto-Close', value: '0', description: 'Never auto-close tickets' },
      { label: '12 Hours', value: '12', description: 'Close after 12 hours of inactivity' },
      { label: '24 Hours', value: '24', description: 'Close after 1 day of inactivity' },
      { label: '48 Hours', value: '48', description: 'Close after 2 days of inactivity (recommended)' },
      { label: '72 Hours', value: '72', description: 'Close after 3 days of inactivity' },
      { label: '1 Week', value: '168', description: 'Close after 7 days of inactivity' }
    ];
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('auto_close_select')
          .setPlaceholder('Select time')
          .addOptions(timeOptions)
      );
    
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_tickets')
          .setLabel('Back to Ticket Settings')
          .setStyle(ButtonStyle.Secondary)
      );
    
    return {
      embeds: [embed],
      components: [row, backButton]
    };
  }
}

module.exports = SetupUIManager; 