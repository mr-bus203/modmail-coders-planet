const Ticket = require('../schemas/Ticket');
const logger = require('../utils/logger');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    try {
      // Check if the deleted channel was a ticket channel
      if (!channel.name.startsWith('modmail-')) {
        return; // Not a ticket channel, ignore
      }
      
      logger.info(`Detected deletion of ModMail channel: ${channel.name} (${channel.id})`);
      
      // Find the ticket in the database
      const ticket = await Ticket.findOne({
        channelId: channel.id,
        closed: false
      });
      
      if (!ticket) {
        logger.debug(`No active ticket found for deleted channel ${channel.id}`);
        return;
      }
      
      // Mark the ticket as closed
      ticket.closed = true;
      ticket.closedAt = Date.now();
      ticket.closedBy = {
        id: 'system',
        tag: 'System (Channel Deleted)'
      };
      ticket.closeReason = 'Channel was deleted';
      
      await ticket.save();
      
      logger.info(`Marked ticket ${ticket._id} as closed due to channel deletion`);
      
      // Try to notify the user if possible
      try {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        
        if (user) {
          await user.send({
            content: `Your ModMail ticket in **${channel.guild.name}** has been closed. If you need further assistance, please create a new ticket.`
          }).catch(err => {
            logger.warn(`Could not notify user ${ticket.userId} about ticket closure: ${err.message}`);
          });
        }
      } catch (notifyError) {
        logger.warn(`Error notifying user about ticket closure: ${notifyError.message}`);
      }
    } catch (error) {
      logger.error(`Error handling channel deletion for possible ticket:`, error);
    }
  }
}; 