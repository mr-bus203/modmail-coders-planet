const Ticket = require('../../schemas/Ticket');
const Config = require('../../schemas/Config');
const logger = require('../logger');

/**
 * Checks for and closes any tickets whose channels are orphaned or invalid
 * @param {Object} client - Discord client
 * @returns {Promise<Object>} Status and count of closed tickets
 */
async function cleanupOrphanedTickets(client) {
  try {
    logger.info('Running cleanup for orphaned ticket channels...');
    
    // Find all active tickets
    const activeTickets = await Ticket.find({ closed: false });
    
    if (activeTickets.length === 0) {
      return { 
        success: true, 
        message: 'No active tickets to check for orphaned channels' 
      };
    }
    
    let closedCount = 0;
    
    // Check each ticket
    for (const ticket of activeTickets) {
      try {
        const guild = client.guilds.cache.get(ticket.guildId);
        
        // Skip if guild is not available (bot might have been removed)
        if (!guild) continue;
        
        // Check if channel exists
        const channel = guild.channels.cache.get(ticket.channelId);
        
        // If channel doesn't exist, mark ticket as closed
        if (!channel) {
          await closeOrphanedTicket(ticket, 'Channel no longer exists', client);
          closedCount++;
          continue;
        }
        
        // Get guild config
        const guildConfig = await Config.findOne({ guildId: guild.id });
        if (!guildConfig) continue;
        
        // Check if the ModMail category still exists
        const category = guild.channels.cache.get(guildConfig.modmailCategoryId);
        
        // If category doesn't exist or channel is not in the correct category
        if (!category || channel.parentId !== category.id) {
          await closeOrphanedTicket(ticket, 'Channel is no longer in the ModMail category', client);
          closedCount++;
        }
      } catch (ticketError) {
        logger.error(`Error checking ticket ${ticket._id}:`, ticketError);
      }
    }
    
    return {
      success: true,
      message: `Cleanup complete. Closed ${closedCount} orphaned tickets.`
    };
  } catch (error) {
    logger.error('Error in orphaned ticket cleanup:', error);
    return {
      success: false,
      message: `Error during cleanup: ${error.message}`
    };
  }
}

/**
 * Closes an orphaned ticket and notifies the user
 * @param {Object} ticket - The ticket to close
 * @param {string} reason - Reason for closure
 * @param {Object} client - Discord client
 */
async function closeOrphanedTicket(ticket, reason, client) {
  try {
    // Mark ticket as closed
    ticket.closed = true;
    ticket.closedAt = Date.now();
    ticket.closedBy = {
      id: 'system',
      tag: 'System (Cleanup)'
    };
    ticket.closeReason = reason;
    
    await ticket.save();
    
    logger.info(`Closed orphaned ticket ${ticket._id}: ${reason}`);
    
    // Try to notify the user
    try {
      const user = await client.users.fetch(ticket.userId).catch(() => null);
      
      if (user) {
        const guild = client.guilds.cache.get(ticket.guildId);
        const guildName = guild ? guild.name : 'a server';
        
        await user.send({
          content: `Your ModMail ticket in **${guildName}** has been closed automatically. If you need further assistance, please create a new ticket.`
        }).catch(err => {
          logger.warn(`Could not notify user ${ticket.userId} about ticket closure: ${err.message}`);
        });
      }
    } catch (notifyError) {
      logger.warn(`Error notifying user about orphaned ticket closure: ${notifyError.message}`);
    }
  } catch (error) {
    logger.error(`Error closing orphaned ticket ${ticket._id}:`, error);
    throw error;
  }
}

module.exports = cleanupOrphanedTickets; 