const { EmbedBuilder } = require('discord.js');
const Ticket = require('../../schemas/Ticket');
const Config = require('../../schemas/Config');
const ConfigManager = require('../configManager');
const config = require('../../config/config');
const logger = require('../logger');
const moment = require('moment');

/**
 * Close a ticket
 * @param {Object} channel - The channel object representing the ticket
 * @param {Object} client - The Discord client
 * @param {Object} closer - The user that closed the ticket
 * @param {string} reason - The reason for closing the ticket
 * @returns {Promise<boolean>} Success status
 */
async function closeTicket(channel, client, closer, reason = '') {
  try {
    // Get the ticket from database
    const ticket = await Ticket.findOne({
      channelId: channel.id,
      closed: false
    });
    
    if (!ticket) {
      // Try to find if the ticket exists but was already closed
      const closedTicket = await Ticket.findOne({
        channelId: channel.id,
        closed: true
      });
      
      if (closedTicket) {
        // Check if it was closed by the same user - this is a duplicate close attempt
        if (closedTicket.closedBy === closer.id) {
          return {
            success: true,
            ticket: closedTicket,
            duplicateClose: true
          };
        }
        
        return {
          success: false,
          error: 'This ticket has already been closed by someone else.',
          alreadyClosed: true
        };
      }
      
      return {
        success: false,
        error: 'This channel is not an active ticket or the ticket could not be found in the database.'
      };
    }
    
    // Get the user and guild
    const user = await client.users.fetch(ticket.userId).catch(() => null);
    const guild = client.guilds.cache.get(ticket.guildId);
    
    if (!guild) {
      return {
        success: false,
        error: 'The guild associated with this ticket could not be found.'
      };
    }
    
    // Get guild configuration
    const guildConfig = await Config.findOne({ guildId: guild.id });
    if (!guildConfig) {
      return {
        success: false,
        error: 'Could not find configuration for this guild.'
      };
    }
    
    // Update ticket status to closed
    ticket.closed = true;
    ticket.closedAt = Date.now();
    ticket.closedBy = closer.id;
    ticket.closeReason = reason;
    
    await ticket.save();
    
    // Get the custom close message or use default
    const closeMessage = await ConfigManager.getSetting(
      guild.id,
      'settings.messages.closeMessage',
      'Your ticket has been closed. If you need further assistance, feel free to create a new ticket.'
    );
    
    // Get the configured embed color
    const embedColor = await ConfigManager.getSetting(
      guild.id, 
      'settings.appearance.embedColor',
      config.embedColor
    );
    
    // Notify the user about ticket closure
    if (user) {
      const userEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Ticket Closed')
        .setDescription(`${closeMessage}${reason ? `\n\n**Reason:** ${reason}` : ''}`)
        .setFooter({ text: `${guild.name} • ${config.footer}` })
        .setTimestamp();
      
      await user.send({ embeds: [userEmbed] }).catch(error => {
        logger.error(`Error sending closure message to user ${user.tag}:`, error);
      });
    }
    
    // Log ticket closure if logs are enabled
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
          .setTitle('Ticket Closed')
          .setDescription(`**Ticket:** ${channel.name} (${channel.id})
**User:** ${user ? `${user.tag} (${user.id})` : 'Unknown User'}
**Closed by:** ${closer.tag} (${closer.id})
**Time:** ${moment().format('MMM D, YYYY [at] h:mm A')}${reason ? `\n**Reason:** ${reason}` : ''}`)
          .setFooter({ text: config.footer })
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
    
    // Should we generate a transcript?
    const transcripts = await ConfigManager.getSetting(
      guild.id,
      'settings.tickets.transcripts',
      false
    );
    
    if (transcripts) {
      // Send a message in the channel about generating a transcript
      await channel.send('Generating transcript...');
      
      // Get all messages from the ticket
      const messages = ticket.messages;
      
      if (messages.length > 0) {
        // Create a simple text-based transcript
        let transcript = `# Ticket Transcript\n`;
        transcript += `Ticket ID: ${ticket._id}\n`;
        transcript += `User: ${user ? user.tag : 'Unknown'} (${ticket.userId})\n`;
        transcript += `Created: ${moment(ticket.createdAt).format('MMM D, YYYY [at] h:mm A')}\n`;
        transcript += `Closed: ${moment(ticket.closedAt).format('MMM D, YYYY [at] h:mm A')}\n`;
        transcript += `Closed by: ${closer.tag} (${closer.id})\n`;
        transcript += `Reason: ${reason || 'No reason provided'}\n\n`;
        transcript += `## Messages\n`;
        
        messages.forEach((msg, index) => {
          const timestamp = msg.timestamp 
            ? moment(msg.timestamp).format('MMM D, YYYY [at] h:mm A') 
            : 'Unknown time';
          
          transcript += `### ${index + 1}. ${msg.author} ${msg.isStaff ? '(Staff)' : ''} - ${timestamp}\n`;
          transcript += `${msg.content || '*No content*'}\n`;
          
          if (msg.attachments && msg.attachments.length > 0) {
            transcript += `Attachments: ${msg.attachments.join(', ')}\n`;
          }
          
          transcript += '\n';
        });
        
        // Create a buffer from the transcript
        const buffer = Buffer.from(transcript, 'utf-8');
        
        // Send the transcript to the log channel if it exists
        const logChannel = guild.channels.cache.get(guildConfig.logChannelId);
        if (logChannel) {
          await logChannel.send({
            content: `Transcript for ticket #${channel.name} (${ticket._id})`,
            files: [{
              attachment: buffer,
              name: `transcript-${channel.name}-${Date.now()}.txt`
            }]
          });
        } else {
          logger.warn(`Could not send transcript for ticket ${ticket._id} - log channel not found`);
        }
      }
    }
    
    // Send a closure message
    const closureEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Ticket Closed')
      .setDescription(`This ticket has been closed by ${closer.tag}${reason ? `\n\n**Reason:** ${reason}` : ''}`)
      .setFooter({ text: `The channel will be deleted in a few seconds • ${config.footer}` })
      .setTimestamp();
    
    try {
      await channel.send({ embeds: [closureEmbed] });
    } catch (error) {
      logger.error(`Error sending closure message to channel ${channel.id}:`, error);
    }
    
    // Delete the channel after a short delay, regardless of confirmation setting
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket closed by ${closer.tag}`);
        logger.info(`Ticket channel ${channel.id} deleted after closure`);
      } catch (error) {
        logger.error(`Error deleting ticket channel ${channel.id}:`, error);
      }
    }, 5000);
    
    logger.info(`Ticket ${ticket._id} closed by ${closer.tag} (${closer.id})`);
    
    return {
      success: true,
      ticket: ticket
    };
  } catch (error) {
    logger.error('Error closing ticket:', error);
    return {
      success: false,
      error: 'An error occurred while closing the ticket.'
    };
  }
}

module.exports = closeTicket; 