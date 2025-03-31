require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

// Import command deployment function (optional use)
const deployCommands = require('./deploy-commands');
const { autoCloseInactiveTickets, cleanupOrphanedTickets } = require('./utils/modmail');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

// Initialize collections for commands
client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB database!');
    
    // Check if we should auto-deploy commands on startup (based on environment variable)
    const shouldDeployCommands = process.env.AUTO_DEPLOY_COMMANDS === 'true';
    
    if (shouldDeployCommands) {
      logger.info('Auto-deploying commands on startup...');
      deployCommands()
        .then(result => {
          if (result.success) {
            logger.info(`Command deployment completed: ${result.added} commands added, ${result.removed} commands removed`);
          } else {
            logger.error('Command deployment failed:', result.error);
          }
        });
    }
  })
  .catch((error) => {
    logger.error('Error connecting to MongoDB database:', error.message);
  });

// Error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.TOKEN)
  .then(() => {
    logger.info(`Logged in as ${client.user.tag}`);
    
    // Set up auto-close interval
    const autoCloseIntervalHours = 1; // Check every hour
    const autoCloseInterval = autoCloseIntervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      logger.info('Running auto-close check for inactive tickets...');
      try {
        const result = await autoCloseInactiveTickets(client);
        if (result.success) {
          logger.info(result.message);
        } else {
          logger.error('Auto-close check failed:', result.message);
        }
      } catch (error) {
        logger.error('Error running auto-close check:', error);
      }
    }, autoCloseInterval);
    
    logger.info(`Auto-close check scheduled to run every ${autoCloseIntervalHours} hour(s)`);
    
    // Set up orphaned ticket cleanup interval (runs every 2 hours)
    const cleanupIntervalHours = 2;
    const cleanupInterval = cleanupIntervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      logger.info('Running orphaned ticket cleanup check...');
      try {
        const result = await cleanupOrphanedTickets(client);
        if (result.success) {
          logger.info(result.message);
        } else {
          logger.error('Orphaned ticket cleanup failed:', result.message);
        }
      } catch (error) {
        logger.error('Error running orphaned ticket cleanup:', error);
      }
    }, cleanupInterval);
    
    logger.info(`Orphaned ticket cleanup scheduled to run every ${cleanupIntervalHours} hour(s)`);
  })
  .catch(error => {
    logger.error('Error logging in to Discord:', error);
  }); 