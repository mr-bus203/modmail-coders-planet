const { ChannelType, PermissionFlagsBits } = require('discord.js');
const SetupUIManager = require('./setupUIManager');
const ConfigManager = require('../configManager');
const Config = require('../../schemas/Config');
const logger = require('../logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handles the setup interactions and manages configurations
 */
class SetupHandler {
  /**
   * Initializes a setup session 
   * @param {Object} interaction - The interaction that triggered setup
   * @returns {Promise<Object>} Setup session data
   */
  static async initSetup(interaction) {
    try {
      // Get guild configuration or create new one
      let guildConfig = await Config.findOne({ guildId: interaction.guild.id });
      
      if (!guildConfig) {
        // Initialize default channels
        let category = await this.findOrCreateCategory(interaction.guild);
        let logChannel = await this.findOrCreateLogChannel(interaction.guild, category);
        let staffRole = await this.findOrCreateStaffRole(interaction.guild);
        
        // Create new configuration
        guildConfig = new Config({
          guildId: interaction.guild.id,
          modmailCategoryId: category.id,
          logChannelId: logChannel.id,
          staffRoleId: staffRole.id
        });
        
        await guildConfig.save();
      }
      
      // Send initial setup UI
      const setupMessage = await interaction.reply({
        ...SetupUIManager.getMainSetupEmbed(guildConfig),
        ephemeral: true,
        fetchReply: true
      });
      
      // Return session data
      return { 
        success: true, 
        guildConfig, 
        setupMessage,
        active: true,
        step: 'main'
      };
    } catch (error) {
      logger.error('Error initializing setup:', error);
      return { 
        success: false, 
        error: 'An error occurred while initializing setup. Please try again later.' 
      };
    }
  }

  /**
   * Finds or creates a ModMail category
   * @param {Object} guild - The Discord guild
   * @returns {Promise<Object>} The category channel
   */
  static async findOrCreateCategory(guild) {
    // Try to find existing ModMail category
    const existingCategory = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase() === 'modmail'
    );
    
    if (existingCategory) return existingCategory;
    
    // Create a new category with proper permissions
    const modmailCategory = await guild.channels.create({
      name: 'ModMail',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        }
      ]
    });
    
    return modmailCategory;
  }

  /**
   * Finds or creates a ModMail log channel
   * @param {Object} guild - The Discord guild
   * @param {Object} category - The ModMail category
   * @returns {Promise<Object>} The log channel
   */
  static async findOrCreateLogChannel(guild, category) {
    // Try to find existing ModMail logs channel
    const existingLogChannel = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildText && 
      channel.name.toLowerCase() === 'modmail-logs'
    );
    
    if (existingLogChannel) return existingLogChannel;
    
    // Create a new log channel
    const logChannel = await guild.channels.create({
      name: 'modmail-logs',
      type: ChannelType.GuildText,
      parent: category,
      topic: 'ModMail ticket logs and transcripts'
    });
    
    return logChannel;
  }

  /**
   * Finds or creates a ModMail staff role
   * @param {Object} guild - The Discord guild
   * @returns {Promise<Object>} The staff role
   */
  static async findOrCreateStaffRole(guild) {
    // Try to find existing ModMail staff role
    const existingRole = guild.roles.cache.find(
      role => role.name.toLowerCase() === 'modmail staff'
    );
    
    if (existingRole) return existingRole;
    
    // Create a new staff role
    const staffRole = await guild.roles.create({
      name: 'ModMail Staff',
      color: '#1ABC9C',
      reason: 'ModMail staff role for ticket management'
    });
    
    return staffRole;
  }

  /**
   * Updates guild configuration settings
   * @param {Object} guildConfig - Current guild config
   * @param {String} path - Setting path (dot notation)
   * @param {*} value - New value
   * @returns {Promise<Object>} Updated config
   */
  static async updateSetting(guildConfig, path, value) {
    try {
      return await ConfigManager.updateSetting(guildConfig.guildId, path, value);
    } catch (error) {
      logger.error(`Error updating setting ${path}:`, error);
      throw error;
    }
  }

  /**
   * Handles button interactions during setup
   * @param {Object} interaction - Button interaction
   * @param {Object} guildConfig - Guild configuration
   * @returns {Promise<Object>} Updated session data
   */
  static async handleButtonInteraction(interaction, guildConfig) {
    const customId = interaction.customId;
    
    try {
      // Main menu buttons
      if (customId === 'setup_tickets') {
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(guildConfig));
        return { step: 'tickets' };
      }
      
      else if (customId === 'setup_messages') {
        await interaction.update(SetupUIManager.getMessageSettingsEmbed(guildConfig));
        return { step: 'messages' };
      }
      
      else if (customId === 'setup_appearance') {
        await interaction.update(SetupUIManager.getAppearanceSettingsEmbed(guildConfig));
        return { step: 'appearance' };
      }
      
      else if (customId === 'setup_channels') {
        await interaction.update(SetupUIManager.getChannelsRolesEmbed(guildConfig));
        return { step: 'channels' };
      }
      
      // Back buttons
      else if (customId === 'setup_back') {
        await interaction.update(SetupUIManager.getMainSetupEmbed(guildConfig));
        return { step: 'main' };
      }
      
      // Toggle buttons for ticket settings
      else if (customId === 'setup_close_confirmation') {
        const current = guildConfig.settings?.tickets?.closeConfirmation ?? true;
        await this.updateSetting(guildConfig, 'settings.tickets.closeConfirmation', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_transcripts') {
        const current = guildConfig.settings?.tickets?.transcripts ?? true;
        await this.updateSetting(guildConfig, 'settings.tickets.transcripts', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_logs') {
        const current = guildConfig.settings?.tickets?.logsEnabled ?? true;
        await this.updateSetting(guildConfig, 'settings.tickets.logsEnabled', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_ping_staff') {
        const current = guildConfig.settings?.tickets?.pingStaff ?? false;
        await this.updateSetting(guildConfig, 'settings.tickets.pingStaff', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_require_topic') {
        const current = guildConfig.settings?.tickets?.requireTopic ?? false;
        await this.updateSetting(guildConfig, 'settings.tickets.requireTopic', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getTicketSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_timestamps') {
        const current = guildConfig.settings?.appearance?.useTimestamps ?? true;
        await this.updateSetting(guildConfig, 'settings.appearance.useTimestamps', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getAppearanceSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      else if (customId === 'setup_user_info') {
        const current = guildConfig.settings?.appearance?.showUserInfo ?? true;
        await this.updateSetting(guildConfig, 'settings.appearance.showUserInfo', !current);
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getAppearanceSettingsEmbed(updatedConfig));
        return { guildConfig: updatedConfig };
      }
      
      // Special setting pages
      else if (customId === 'setup_ticket_limit') {
        await interaction.update(SetupUIManager.getTicketLimitEmbed());
        return { step: 'ticket_limit' };
      }
      
      else if (customId === 'setup_auto_close') {
        await interaction.update(SetupUIManager.getAutoCloseEmbed());
        return { step: 'auto_close' };
      }
      
      else if (customId === 'setup_embed_color') {
        await interaction.update(SetupUIManager.getColorPickerEmbed());
        return { step: 'color_picker' };
      }
      
      // Save and exit
      else if (customId === 'setup_save') {
        await interaction.update({ 
          content: 'Your ModMail configuration has been saved!', 
          embeds: [], 
          components: [] 
        });
        return { active: false };
      }
      
      // Channel and role selection buttons
      else if (customId === 'setup_category') {
        // Show a modal to input a category ID
        await interaction.showModal({
          title: 'Set ModMail Category',
          customId: 'modal_category',
          components: [
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 4, // TextInput
                  customId: 'category_id',
                  label: 'Category ID',
                  style: 1, // Short
                  placeholder: 'Enter the category ID or leave empty to create a new one',
                  required: false
                }
              ]
            }
          ]
        });
        return { step: 'channels', awaitingModal: 'category' };
      }
      
      else if (customId === 'setup_log_channel') {
        // Show a modal to input a log channel ID
        await interaction.showModal({
          title: 'Set Log Channel',
          customId: 'modal_log_channel',
          components: [
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 4, // TextInput
                  customId: 'log_channel_id',
                  label: 'Channel ID',
                  style: 1, // Short
                  placeholder: 'Enter the channel ID or leave empty to create a new one',
                  required: false
                }
              ]
            }
          ]
        });
        return { step: 'channels', awaitingModal: 'log_channel' };
      }
      
      else if (customId === 'setup_staff_role') {
        // Show a modal to input a staff role ID
        await interaction.showModal({
          title: 'Set Staff Role',
          customId: 'modal_staff_role',
          components: [
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 4, // TextInput
                  customId: 'staff_role_id',
                  label: 'Role ID',
                  style: 1, // Short
                  placeholder: 'Enter the role ID or leave empty to create a new one',
                  required: false
                }
              ]
            }
          ]
        });
        return { step: 'channels', awaitingModal: 'staff_role' };
      }
      
      // Auto Setup
      else if (customId === 'setup_auto') {
        // Ask for confirmation before proceeding with automatic setup
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('setup_auto_confirm')
              .setLabel('Confirm Auto Setup')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('setup_auto_cancel')
              .setLabel('Cancel')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Secondary)
          );
        
        await interaction.update({
          content: 'Automatic setup will create or update the following:',
          embeds: [{
            title: 'Auto Setup Confirmation',
            description: 'This will set up the following with recommended settings:',
            color: 0x5865F2,
            fields: [
              {
                name: 'Channels & Categories',
                value: '• ModMail Category\n• modmail-logs Channel\n• modmail-info Channel'
              },
              {
                name: 'Roles',
                value: '• ModMail Staff Role'
              },
              {
                name: 'Settings',
                value: '• Optimal ticket settings\n• Welcome messages\n• Appearance and formatting'
              },
              {
                name: 'Warning',
                value: 'This will overwrite any existing ModMail configurations. Are you sure you want to proceed?'
              }
            ]
          }],
          components: [confirmRow]
        });
        
        return { step: 'auto_confirm' };
      }
      
      // Auto Setup Confirmation
      else if (customId === 'setup_auto_confirm') {
        await interaction.deferUpdate();
        
        // Perform the automatic setup
        const autoSetupResult = await this.performAutoSetup(interaction);
        
        if (autoSetupResult.success) {
          await interaction.editReply({
            content: autoSetupResult.message,
            embeds: [{
              title: 'ModMail Auto Setup Complete',
              description: 'Your ModMail system has been configured with recommended settings!',
              color: 0x5865F2,
              fields: [
                {
                  name: 'What Now?',
                  value: 'Your staff members with the ModMail Staff role can now receive and respond to user DMs.'
                },
                {
                  name: 'Next Steps',
                  value: '1. Assign the ModMail Staff role to your team members\n2. Test the system by sending a DM to the bot'
                }
              ],
              footer: {
                text: 'You can customize any settings with the /setup command'
              }
            }],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('setup_return_main')
                    .setLabel('Return to Setup')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder()
                    .setCustomId('setup_save')
                    .setLabel('Exit Setup')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success)
                )
            ]
          });
          
          return { guildConfig: autoSetupResult.guildConfig, step: 'auto_complete' };
        } else {
          await interaction.editReply({
            content: 'An error occurred during automatic setup.',
            embeds: [{
              title: 'Auto Setup Failed',
              description: autoSetupResult.error || 'An unknown error occurred.',
              color: 0xFF0000
            }],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('setup_return_main')
                    .setLabel('Return to Setup')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                )
            ]
          });
          
          return { step: 'error' };
        }
      }
      
      // Cancel Auto Setup
      else if (customId === 'setup_auto_cancel') {
        await interaction.update(SetupUIManager.getMainSetupEmbed(guildConfig));
        return { step: 'main' };
      }
      
      // Return to main setup from any page
      else if (customId === 'setup_return_main') {
        const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
        await interaction.update(SetupUIManager.getMainSetupEmbed(updatedConfig));
        return { step: 'main', guildConfig: updatedConfig };
      }
      
    } catch (error) {
      logger.error('Error handling setup button:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your setup request. Please try again.', 
        ephemeral: true 
      });
      return { error: error.message };
    }
    
    return {};
  }

  /**
   * Handles modal submissions during setup
   * @param {Object} interaction - Modal submit interaction
   * @param {Object} guildConfig - Guild configuration
   * @returns {Promise<Object>} Updated session data
   */
  static async handleModalSubmit(interaction, guildConfig) {
    const customId = interaction.customId;
    
    // Return early if the interaction has already been handled
    if (interaction.replied || interaction.deferred) {
      logger.debug(`Modal ${customId} already handled, skipping duplicate handling`);
      return {};
    }
    
    try {
      // Handle category ID submission
      if (customId === 'modal_category') {
        const categoryId = interaction.fields.getTextInputValue('category_id').trim();
        
        if (categoryId) {
          // Use the provided category ID
          try {
            const category = await interaction.guild.channels.fetch(categoryId);
            
            if (category && category.type === ChannelType.GuildCategory) {
              // Update the category ID in the database
              await this.updateSetting(guildConfig, 'modmailCategoryId', category.id);
              
              const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
              await interaction.reply({ 
                content: `ModMail category set to ${category.name} (${category.id})`,
                ephemeral: true 
              });
              
              // Update the channels/roles embed
              await interaction.followUp({
                ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
                ephemeral: true
              });
              
              return { guildConfig: updatedConfig };
            } else {
              await interaction.reply({ 
                content: 'Invalid category ID. Please make sure you provide a valid category ID.',
                ephemeral: true 
              });
              return { };
            }
          } catch (error) {
            logger.error('Error setting category:', error);
            await interaction.reply({ 
              content: 'Error: Could not find a category with that ID. Please try again.',
              ephemeral: true 
            });
            return { };
          }
        } else {
          // Create a new category
          try {
            const category = await this.findOrCreateCategory(interaction.guild);
            
            // Update the category ID in the database
            await this.updateSetting(guildConfig, 'modmailCategoryId', category.id);
            
            const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
            await interaction.reply({ 
              content: `Created and set new ModMail category: ${category.name} (${category.id})`,
              ephemeral: true 
            });
            
            // Update the channels/roles embed
            await interaction.followUp({
              ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
              ephemeral: true
            });
            
            return { guildConfig: updatedConfig };
          } catch (error) {
            logger.error('Error creating category:', error);
            await interaction.reply({ 
              content: 'Error: Could not create a new category. Please try again or provide an existing category ID.',
              ephemeral: true 
            });
            return { };
          }
        }
      }
      
      // Handle log channel ID submission
      else if (customId === 'modal_log_channel') {
        const channelId = interaction.fields.getTextInputValue('log_channel_id').trim();
        
        if (channelId) {
          // Use the provided channel ID
          try {
            const channel = await interaction.guild.channels.fetch(channelId);
            
            if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
              // Update the log channel ID in the database
              await this.updateSetting(guildConfig, 'logChannelId', channel.id);
              
              const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
              await interaction.reply({ 
                content: `Log channel set to ${channel.name} (${channel.id})`,
                ephemeral: true 
              });
              
              // Update the channels/roles embed
              await interaction.followUp({
                ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
                ephemeral: true
              });
              
              return { guildConfig: updatedConfig };
            } else {
              await interaction.reply({ 
                content: 'Invalid channel ID. Please make sure you provide a valid text channel ID.',
                ephemeral: true 
              });
              return { };
            }
          } catch (error) {
            logger.error('Error setting log channel:', error);
            await interaction.reply({ 
              content: 'Error: Could not find a channel with that ID. Please try again.',
              ephemeral: true 
            });
            return { };
          }
        } else {
          // Create a new log channel
          try {
            // Get the ModMail category
            const category = await interaction.guild.channels.fetch(guildConfig.modmailCategoryId).catch(() => null);
            if (!category) {
              await interaction.reply({ 
                content: 'Error: ModMail category not found. Please set up the category first.',
                ephemeral: true 
              });
              return { };
            }
            
            const logChannel = await this.findOrCreateLogChannel(interaction.guild, category);
            
            // Update the log channel ID in the database
            await this.updateSetting(guildConfig, 'logChannelId', logChannel.id);
            
            const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
            await interaction.reply({ 
              content: `Created and set new log channel: ${logChannel.name} (${logChannel.id})`,
              ephemeral: true 
            });
            
            // Update the channels/roles embed
            await interaction.followUp({
              ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
              ephemeral: true
            });
            
            return { guildConfig: updatedConfig };
          } catch (error) {
            logger.error('Error creating log channel:', error);
            await interaction.reply({ 
              content: 'Error: Could not create a new log channel. Please try again or provide an existing channel ID.',
              ephemeral: true 
            });
            return { };
          }
        }
      }
      
      // Handle staff role ID submission
      else if (customId === 'modal_staff_role') {
        const roleId = interaction.fields.getTextInputValue('staff_role_id').trim();
        
        if (roleId) {
          // Use the provided role ID
          try {
            const role = await interaction.guild.roles.fetch(roleId);
            
            if (role) {
              // Update the staff role ID in the database
              await this.updateSetting(guildConfig, 'staffRoleId', role.id);
              
              const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
              await interaction.reply({ 
                content: `Staff role set to ${role.name} (${role.id})`,
                ephemeral: true 
              });
              
              // Update the channels/roles embed
              await interaction.followUp({
                ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
                ephemeral: true
              });
              
              return { guildConfig: updatedConfig };
            } else {
              await interaction.reply({ 
                content: 'Invalid role ID. Please make sure you provide a valid role ID.',
                ephemeral: true 
              });
              return { };
            }
          } catch (error) {
            logger.error('Error setting staff role:', error);
            await interaction.reply({ 
              content: 'Error: Could not find a role with that ID. Please try again.',
              ephemeral: true 
            });
            return { };
          }
        } else {
          // Create a new staff role
          try {
            const staffRole = await this.findOrCreateStaffRole(interaction.guild);
            
            // Update the staff role ID in the database
            await this.updateSetting(guildConfig, 'staffRoleId', staffRole.id);
            
            const updatedConfig = await Config.findOne({ guildId: guildConfig.guildId });
            await interaction.reply({ 
              content: `Created and set new staff role: ${staffRole.name} (${staffRole.id})`,
              ephemeral: true 
            });
            
            // Update the channels/roles embed
            await interaction.followUp({
              ...SetupUIManager.getChannelsRolesEmbed(updatedConfig),
              ephemeral: true
            });
            
            return { guildConfig: updatedConfig };
          } catch (error) {
            logger.error('Error creating staff role:', error);
            await interaction.reply({ 
              content: 'Error: Could not create a new staff role. Please try again or provide an existing role ID.',
              ephemeral: true 
            });
            return { };
          }
        }
      }
      
      return { };
    } catch (error) {
      logger.error('Error handling modal submission:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your input. Please try again.',
        ephemeral: true 
      });
      return { error: error.message };
    }
  }

  /**
   * Performs automatic setup with recommended settings
   * @param {Object} interaction - The interaction that triggered setup
   * @returns {Promise<Object>} Setup result
   */
  static async performAutoSetup(interaction) {
    try {
      // Create the necessary components
      const category = await this.findOrCreateCategory(interaction.guild);
      const logChannel = await this.findOrCreateLogChannel(interaction.guild, category);
      const staffRole = await this.findOrCreateStaffRole(interaction.guild);
      
      // Find existing config or create new one
      let guildConfig = await Config.findOne({ guildId: interaction.guild.id });
      
      if (!guildConfig) {
        guildConfig = new Config({
          guildId: interaction.guild.id,
          modmailCategoryId: category.id,
          logChannelId: logChannel.id,
          staffRoleId: staffRole.id
        });
      } else {
        // Update existing config with the new channels and roles
        guildConfig.modmailCategoryId = category.id;
        guildConfig.logChannelId = logChannel.id;
        guildConfig.staffRoleId = staffRole.id;
      }
      
      // Set optimal recommended settings
      guildConfig.settings = {
        tickets: {
          maxOpenTickets: 5,
          closeConfirmation: true,
          transcripts: true,
          logsEnabled: true,
          autoClose: true,
          autoCloseTime: 48,
          pingStaff: true,
          requireTopic: false,
          nameFormat: 'modmail-{username}'
        },
        messages: {
          greeting: 'Thank you for contacting our team! Please describe your issue, and a staff member will assist you shortly.',
          closeMessage: 'Your ticket has been closed. If you need further assistance, feel free to create a new ticket anytime.',
          responseMessage: 'Staff reply:'
        },
        appearance: {
          embedColor: '#5865F2',
          timestampFormat: 'MMM D, YYYY [at] h:mm A'
        }
      };
      
      // Update category permissions for staff role
      await category.permissionOverwrites.edit(staffRole.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true,
        ManageMessages: true
      });
      
      // Save the configuration
      await guildConfig.save();
      
      // Create a welcome/information channel in the category
      const welcomeChannel = await interaction.guild.channels.create({
        name: 'modmail-info',
        type: ChannelType.GuildText,
        parent: category,
        topic: 'Information about the ModMail system'
      });
      
      // Send setup information to the welcome channel
      await welcomeChannel.send({
        embeds: [{
          title: 'ModMail System Setup',
          description: 'Your ModMail system has been automatically set up with recommended settings!',
          color: 0x5865F2,
          fields: [
            {
              name: 'Staff Role',
              value: `<@&${staffRole.id}>`,
              inline: true
            },
            {
              name: 'Log Channel',
              value: `<#${logChannel.id}>`,
              inline: true
            },
            {
              name: 'How It Works',
              value: 'Users can send a direct message to the bot to create a ticket. Staff members with the ModMail Staff role can respond through the created ticket channels.'
            },
            {
              name: 'Commands',
              value: '`/close` or `!close [reason]` - Close the current ticket\n`/setup` - Modify your ModMail configuration'
            }
          ],
          footer: {
            text: 'You can customize these settings with the /setup command'
          },
          timestamp: new Date()
        }]
      });
      
      return {
        success: true,
        message: 'Automatic setup complete! Your ModMail system is now ready to use.',
        guildConfig
      };
    } catch (error) {
      logger.error('Error during automatic setup:', error);
      return {
        success: false,
        error: `An error occurred during automatic setup: ${error.message}`
      };
    }
  }
}

module.exports = SetupHandler; 