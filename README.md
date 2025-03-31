# ModMail Discord Bot

A professional Discord ModMail bot that allows users to privately message staff through direct messages.

## Features

- 📨 **Direct Message Support**: Users can create tickets by sending a direct message to the bot
- 📝 **Logging**: Complete message logs for administrative purposes
- 📊 **Statistics**: Track ticket metrics and usage
- 🛠️ **Easy Setup**: Simple setup process with automatic configuration
- 🔄 **MongoDB Integration**: Persistent ticket storage
- 🌐 **Multi-Server Support**: Supports multiple servers with server selection for users
- 🎫 **Multi-Ticket Management**: Allows users with tickets in multiple servers to select where to send messages

## Setup Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.11.0 or higher)
- [MongoDB](https://www.mongodb.com/) account and database
- [Discord Bot Token](https://discord.com/developers/applications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/IzzyTheBuilder/modmail-coders-planet
   cd modmail-coders-planet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy the `.env.example` file to a new file called `.env` and fill in the required information:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your details:
   ```
   TOKEN=your_discord_bot_token_here
   MONGODB_URI=your_mongodb_connection_uri_here
   CLIENT_ID=your_bot_client_id_here
   PREFIX=!
   ```

4. **Deploy slash commands**
   ```bash
   npm run deploy
   ```
   This will register your commands with Discord and automatically remove any old commands that no longer exist in your code.

5. **Start the bot**
   ```bash
   npm start
   ```
   Running `npm start` will automatically deploy commands before starting the bot, ensuring your commands are always up to date.

   You can also enable automatic command deployment on startup by setting `AUTO_DEPLOY_COMMANDS=true` in your `.env` file.

### In-Server Setup

1. Invite the bot to your server with the proper permissions
2. Run the `/setup` command in your server (admin only)
3. The bot will automatically:
   - Create a MODMAIL category (or use existing one)
   - Create a log channel (or use existing one)
   - Set up or use an existing Staff role
   - Save all configuration to the database

## Usage

### For Users

1. Send a direct message to the bot to create a ticket
2. If you're in multiple servers with this bot, you'll be prompted to select which server to create a ticket in
3. Continue sending messages to communicate with the staff
4. If you have tickets in multiple servers, you'll be prompted to choose which ticket to reply to

### For Staff

1. When a user creates a ticket, a channel will be created in the ModMail category
2. Type in the channel to respond to the user
3. Use slash commands for additional functionality:
   - `/close [reason]` - Close the current ticket
   - `/stats` - View ticket statistics
   - `/help` - Get help information

## Configuration

The bot's behavior can be customized by editing the `src/config/config.js` file:

- Change the embed colors
- Modify message footer text
- Adjust cooldown periods
- Toggle ticket features

All server-specific configuration (like channels, roles, etc.) is automatically managed in the database, so you don't need to manually configure IDs in environment variables.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

This Discord ModMail bot was created by **Izzy | Coders Planet**

Join our Discord community: [Coders Planet](https://discord.gg/codersplanet)

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.

---

Made with ❤️ by Izzy | Coders Planet 
