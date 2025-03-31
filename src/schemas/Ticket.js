const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true,
    unique: true
  },
  guildId: {
    type: String,
    required: true
  },
  closed: {
    type: Boolean,
    default: false
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMessage: {
    type: Date,
    default: Date.now
  },
  messages: [{
    content: String,
    author: String,
    authorId: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    attachments: [String]
  }]
});

module.exports = mongoose.model('Ticket', ticketSchema); 