const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const Ticket = require('../../schemas/Ticket');
const Config = require('../../schemas/Config');
const ConfigManager = require('../configManager');
const config = require('../../config/config');
const logger = require('../logger');
const moment = require('moment');

/**
 * Create a new ticket
 * @param {Object} message - The message object
 * @param {Object} client - The Discord client
 * @returns {Promise<Object|null>} The created channel or null if failed
 */
async function createTicket(message, client) {
  try {
    // Get all guilds where both the bot and the user are members
    const guildConfigs = await Config.find({});
    
    if (guildConfigs.length === 0) {
      return message.author.send('Error: Bot is not set up in any server yet. Please ask an administrator to run the /setup command.');
    }
    
    // Filter guilds where the user is a member
    const userGuilds = [];
    
    for (const guildConfig of guildConfigs) {
      const guild = client.guilds.cache.get(guildConfig.guildId);
      
      if (!guild) continue;
      
      try {
        // Check if user is a member of this guild
        const guildMember = await guild.members.fetch(message.author.id).catch(() => null);
        
        if (guildMember) {
          userGuilds.push({
            id: guild.id,
            name: guild.name,
            iconURL: guild.iconURL({ dynamic: true }),
            config: guildConfig
          });
        }
      } catch (error) {
        logger.error(`Error fetching member in guild ${guild.id}:`, error);
      }
    }
    
    if (userGuilds.length === 0) {
      return message.author.send('Error: You are not a member of any server where this bot is configured.');
    }
    
    let guild, guildConfig;
    
    // If user is only in one configured guild, use that
    if (userGuilds.length === 1) {
      guild = client.guilds.cache.get(userGuilds[0].id);
      guildConfig = userGuilds[0].config;
    } else {
      // If user is in multiple guilds, let them choose
      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('server_select')
            .setPlaceholder('Select a server')
            .addOptions(userGuilds.map(g => ({
              label: g.name,
              value: g.id,
              description: `Create a ModMail ticket in ${g.name}`,
              emoji: '📩'
            })))
        );
      
      // Get the configured embed color or use default
      const embedColor = await ConfigManager.getSetting(
        userGuilds[0].config.guildId, 
        'settings.appearance.embedColor',
        config.embedColor
      );
      
      const serverSelectEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Create a ModMail Ticket')
        .setDescription('Please select which server you want to create a ticket in:')
        .setFooter({ text: config.footer })
        .setTimestamp();
      
      const selectMessage = await message.author.send({
        embeds: [serverSelectEmbed],
        components: [row]
      });
      
      try {
        // Wait for user selection
        const response = await selectMessage.awaitMessageComponent({ 
          componentType: ComponentType.StringSelect,
          time: 60000 
        });
        
        const selectedGuildId = response.values[0];
        guild = client.guilds.cache.get(selectedGuildId);
        guildConfig = userGuilds.find(g => g.id === selectedGuildId).config;
        
        // Acknowledge the selection
        await response.update({
          content: `Creating your ticket in **${guild.name}**...`,
          embeds: [],
          components: []
        });
      } catch (err) {
        // If user doesn't select within timeout
        await selectMessage.edit({
          content: 'Server selection timed out. Please try again by sending a new message.',
          embeds: [],
          components: []
        });
        return null;
      }
    }
    
    if (!guild || !guildConfig) {
      logger.error(`Guild or config not found after selection`);
      return message.author.send('Error: Could not find the selected server. Please try again.');
    }

    // Check if user already has an open ticket
    const existingTicket = await Ticket.findOne({ 
      userId: message.author.id,
      guildId: guild.id,
      closed: false 
    });

    if (existingTicket) {
      return message.author.send(`You already have an open ticket in **${guild.name}**. Please use that one instead.`);
    }
    
    // Check if user has reached the maximum number of open tickets across all servers
    const maxOpenTickets = await ConfigManager.getSetting(
      guild.id, 
      'settings.tickets.maxOpenTickets',
      3
    );
    
    // If there's a limit (not set to 0/unlimited)
    if (maxOpenTickets > 0) {
      const userOpenTicketsCount = await Ticket.countDocuments({
        userId: message.author.id,
        closed: false
      });
      
      if (userOpenTicketsCount >= maxOpenTickets) {
        return message.author.send(`You have reached the maximum number of open tickets (${maxOpenTickets}). Please close some of your existing tickets before creating a new one.`);
      }
    }

    // Get the modmail category
    const category = guild.channels.cache.get(guildConfig.modmailCategoryId);
    if (!category) {
      logger.error(`Category with ID ${guildConfig.modmailCategoryId} not found`);
      return message.author.send('Error: Modmail category not found. Please contact the administrators.');
    }

    // Check if topic is required
    const requireTopic = await ConfigManager.getSetting(
      guild.id, 
      'settings.tickets.requireTopic',
      false
    );
    
    let ticketTopic = '';
    
    if (requireTopic && !message.content.trim()) {
      // Ask for a topic if none provided
      const topicRequest = await message.author.send('Please provide a topic for your ticket:');
      
      try {
        // Wait for topic message
        const collected = await message.author.dmChannel.awaitMessages({
          filter: m => m.author.id === message.author.id,
          max: 1,
          time: 60000
        });
        
        if (collected.size > 0) {
          const topicMessage = collected.first();
          ticketTopic = topicMessage.content;
        } else {
          return message.author.send('Ticket creation timed out. Please try again with a topic.');
        }
      } catch (error) {
        logger.error('Error collecting topic:', error);
        return message.author.send('There was an error processing your topic. Please try again.');
      }
    } else {
      ticketTopic = message.content || 'No topic provided';
    }

    // Get channel name format from settings
    const nameFormat = await ConfigManager.getSetting(
      guild.id, 
      'settings.tickets.nameFormat',
      'modmail-{username}'
    );
    
    // Create channel name based on format
    const channelName = nameFormat
      .replace('{username}', message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '-'))
      .replace('{userid}', message.author.id)
      .replace('{timestamp}', Date.now());
    
    // Create the channel
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: guildConfig.staffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });

    // Create a new ticket in the database
    const newTicket = new Ticket({
      userId: message.author.id,
      channelId: channel.id,
      guildId: guild.id,
      messages: []
    });

    // Save the user's first message
    newTicket.messages.push({
      content: ticketTopic,
      author: message.author.tag,
      authorId: message.author.id,
      attachments: message.attachments.map(a => a.url)
    });

    await newTicket.save();

    // Get the custom welcome message or use default
    const welcomeMessage = await ConfigManager.getSetting(
      guild.id,
      'settings.messages.welcomeMessage',
      'Thank you for creating a ticket. The staff team will respond as soon as possible.'
    );
    
    // Get the configured embed color
    const embedColor = await ConfigManager.getSetting(
      guild.id, 
      'settings.appearance.embedColor',
      config.embedColor
    );

    // Send confirmation to user
    const userEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Ticket Created')
      .setDescription(`${welcomeMessage}\n\nYour ticket has been created in **${guild.name}**.`)
      .setFooter({ text: config.footer })
      .setTimestamp();

    await message.author.send({ embeds: [userEmbed] });

    // Check if staff should be pinged
    const pingStaff = await ConfigManager.getSetting(
      guild.id,
      'settings.tickets.pingStaff',
      false
    );
    
    // Check if we should show user info
    const showUserInfo = await ConfigManager.getSetting(
      guild.id,
      'settings.appearance.showUserInfo',
      true
    );
    
    // Send information to the staff channel
    const staffEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('New ModMail Ticket')
      .setAuthor({ 
        name: message.author.tag, 
        iconURL: message.author.displayAvatarURL() 
      })
      .setDescription(`**User:** <@${message.author.id}> (${message.author.id})`)
      .setFooter({ text: `Ticket ID: ${newTicket._id} • ${config.footer}` })
      .setTimestamp();
      
    // Add user info if enabled
    if (showUserInfo) {
      staffEmbed.addFields(
        { name: 'Account Created', value: moment(message.author.createdAt).format('MMM D, YYYY [at] h:mm A'), inline: true }
      );
    }
    
    // Add the message content
    staffEmbed.addFields(
      { name: 'Message', value: ticketTopic || '*No content*' }
    );

    // Handle attachments
    if (message.attachments.size > 0) {
      staffEmbed.addFields({ 
        name: 'Attachments', 
        value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n') 
      });
    }

    // Send staff notification with or without ping
    if (pingStaff) {
      await channel.send({
        content: `<@&${guildConfig.staffRoleId}>`,
        embeds: [staffEmbed]
      });
    } else {
      await channel.send({ embeds: [staffEmbed] });
    }

    // Log to the log channel if enabled
    const logsEnabled = await ConfigManager.getSetting(
      guild.id,
      'settings.tickets.logsEnabled',
      true
    );
    
    if (logsEnabled) {
      const logChannel = guild.channels.cache.get(guildConfig.logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('New ModMail Ticket')
          .setDescription(`**User:** ${message.author.tag} (${message.author.id})
**Channel:** ${channel.toString()}
**Time:** ${moment().format('MMM D, YYYY [at] h:mm A')}`)
          .setFooter({ text: config.footer })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    logger.info(`New ticket created by ${message.author.tag} (${message.author.id}) in guild ${guild.name} (${guild.id})`);
    return channel;
  } catch (error) {
    logger.error('Error creating ticket:', error);
    message.author.send('There was an error creating your ticket. Please try again later or contact an administrator.');
    return null;
  }
}

module.exports = createTicket; 