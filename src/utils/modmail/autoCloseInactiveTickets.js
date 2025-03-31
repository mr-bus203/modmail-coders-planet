const Ticket = require('../../schemas/Ticket');
const Config = require('../../schemas/Config');
const ConfigManager = require('../configManager');
const closeTicket = require('./closeTicket');
const logger = require('../logger');
const moment = require('moment');

/**
 * Auto-close inactive tickets
 * @param {Object} client - The Discord client
 * @returns {Promise<Array>} Array of closed tickets
 */
async function autoCloseInactiveTickets(client) {
  try {
    logger.info(`Starting automatic ticket closure check...`);
    const closedTickets = [];
    
    // Get all guild configurations
    const guildConfigs = await Config.find({});
    
    for (const guildConfig of guildConfigs) {
      try {
        // Check if auto-close is enabled for this guild
        const autoCloseEnabled = await ConfigManager.getSetting(
          guildConfig.guildId,
          'settings.tickets.autoClose',
          true
        );
        
        if (!autoCloseEnabled) {
          logger.info(`Auto-close is disabled for guild ${guildConfig.guildId}, skipping.`);
          continue;
        }
        
        // Get the auto-close time in hours
        const autoCloseTime = await ConfigManager.getSetting(
          guildConfig.guildId,
          'settings.tickets.autoCloseTime',
          48
        );
        
        if (autoCloseTime <= 0) {
          logger.info(`Auto-close time is set to ${autoCloseTime} for guild ${guildConfig.guildId}, skipping.`);
          continue;
        }
        
        const guild = client.guilds.cache.get(guildConfig.guildId);
        if (!guild) {
          logger.warn(`Guild ${guildConfig.guildId} not found, skipping auto-close check.`);
          continue;
        }
        
        // Get all active tickets in this guild
        const activeTickets = await Ticket.find({
          guildId: guildConfig.guildId,
          closed: false
        });
        
        logger.info(`Found ${activeTickets.length} active tickets in guild ${guild.name} (${guild.id})`);
        
        // Get current time
        const now = Date.now();
        
        // Check each ticket for inactivity
        for (const ticket of activeTickets) {
          // Calculate inactivity time
          const lastActivity = ticket.lastMessage || ticket.createdAt;
          const inactiveTime = now - lastActivity;
          const inactiveHours = inactiveTime / (1000 * 60 * 60);
          
          if (inactiveHours >= autoCloseTime) {
            logger.info(`Ticket ${ticket._id} has been inactive for ${inactiveHours.toFixed(2)} hours, auto-closing...`);
            
            // Get the ticket channel
            const channel = guild.channels.cache.get(ticket.channelId);
            
            if (channel) {
              // Create a client user object for the bot
              const botUser = {
                id: client.user.id,
                tag: client.user.tag
              };
              
              // Close the ticket
              const result = await closeTicket(
                channel, 
                client, 
                botUser, 
                `Auto-closed due to inactivity (${autoCloseTime} hours)`
              );
              
              if (result.success) {
                closedTickets.push(ticket._id);
                logger.info(`Successfully auto-closed ticket ${ticket._id}`);
              } else {
                logger.error(`Failed to auto-close ticket ${ticket._id}: ${result.error}`);
              }
            } else {
              logger.warn(`Channel for ticket ${ticket._id} not found, marking as closed in database only.`);
              
              // Update ticket status directly
              ticket.closed = true;
              ticket.closedAt = now;
              ticket.closedBy = {
                id: client.user.id,
                tag: client.user.tag
              };
              ticket.closeReason = `Auto-closed due to inactivity (${autoCloseTime} hours) - Channel not found`;
              await ticket.save();
              
              closedTickets.push(ticket._id);
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing auto-close for guild ${guildConfig.guildId}:`, error);
      }
    }
    
    logger.info(`Auto-close check completed, closed ${closedTickets.length} tickets.`);
    return closedTickets;
  } catch (error) {
    logger.error('Error in autoCloseInactiveTickets:', error);
    return [];
  }
}

module.exports = autoCloseInactiveTickets; 