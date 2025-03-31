const Ticket = require('../schemas/Ticket');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildDelete',
  async execute(guild, client) {
    try {
      logger.info(`Bot was removed from guild or guild was deleted: ${guild.name} (${guild.id})`);
      
      // Find all active tickets for this guild
      const tickets = await Ticket.find({
        guildId: guild.id,
        closed: false
      });
      
      if (tickets.length === 0) {
        logger.info(`No active tickets found for guild ${guild.id}`);
        return;
      }
      
      logger.info(`Closing ${tickets.length} active tickets for removed guild ${guild.id}`);
      
      // Close all tickets
      const closedAt = Date.now();
      const closedBy = {
        id: 'system',
        tag: 'System (Guild Removed)'
      };
      const closeReason = 'Bot was removed from the server or the server was deleted';
      
      // Update all tickets
      await Ticket.updateMany(
        { guildId: guild.id, closed: false },
        { 
          $set: { 
            closed: true,
            closedAt,
            closedBy,
            closeReason
          } 
        }
      );
      
      // Notify users about ticket closure
      for (const ticket of tickets) {
        try {
          const user = await client.users.fetch(ticket.userId).catch(() => null);
          
          if (user) {
            await user.send({
              content: `Your ModMail ticket in **${guild.name}** has been closed because the server is no longer available or the ModMail bot was removed.`
            }).catch(err => {
              logger.warn(`Could not notify user ${ticket.userId} about ticket closure: ${err.message}`);
            });
          }
        } catch (notifyError) {
          logger.warn(`Error notifying user ${ticket.userId} about ticket closure: ${notifyError.message}`);
        }
      }
      
      logger.info(`Successfully closed all tickets for guild ${guild.id}`);
    } catch (error) {
      logger.error(`Error handling guild deletion for guild ${guild.id}:`, error);
    }
  }
}; 