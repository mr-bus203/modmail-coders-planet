const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows help information for the ModMail bot'),
  
  async execute(interaction) {
    // Create the main help embed
    const helpEmbed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('ModMail Bot Help')
      .setDescription('This bot provides a modmail system for users to contact server staff privately.')
      .addFields(
        { 
          name: '📩 For Users', 
          value: `Send a direct message to this bot to create a support ticket. Your message will be forwarded to the server staff who will respond through the bot.
          
All messages are kept private and logged for administrative purposes.` 
        },
        { 
          name: '👮‍♂️ For Staff', 
          value: `When a user creates a ticket, a new channel will be created in the ModMail category. 
          
Type messages in this channel to reply to the user.

Use slash commands for additional functionality.`
        },
        { 
          name: '🛠️ Commands', 
          value: `
**/help** - Shows this help message
**/close [reason]** - Closes the current ticket (Staff only)
**/setup** - Sets up the ModMail system (Admin only)
**/stats** - Shows ModMail statistics (Staff only)`
        }
      )
      .setFooter({ text: config.footer })
      .setTimestamp();

    // Check if the command is used in a guild or DM
    if (interaction.guild) {
      // Send help message in the guild
      await interaction.reply({ embeds: [helpEmbed] });
    } else {
      // Send help message in DM
      await interaction.reply({ embeds: [helpEmbed] });
      
      // Also add user-specific instructions
      const dmHelpEmbed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('How to Use ModMail')
        .setDescription(`To create a ticket, simply send a message to me (this bot). 
        
Your message will be forwarded to the server staff who will respond to you through me.

Every message you send (except commands) will be forwarded to your ticket.

The ticket will remain open until staff closes it.`)
        .setFooter({ text: config.footer })
        .setTimestamp();
        
      await interaction.followUp({ embeds: [dmHelpEmbed] });
    }
  }
}; 