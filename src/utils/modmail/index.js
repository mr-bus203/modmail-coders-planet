/**
 * ModMail utility functions
 * 
 * This module exports all the utility functions needed for the ModMail system.
 * These functions handle ticket creation, message handling, and ticket closing.
 */

const createTicket = require('./createTicket');
const addMessageToTicket = require('./addMessageToTicket');
const closeTicket = require('./closeTicket');
const autoCloseInactiveTickets = require('./autoCloseInactiveTickets');
const cleanupOrphanedTickets = require('./cleanupOrphanedTickets');

module.exports = {
  createTicket,
  addMessageToTicket,
  closeTicket,
  autoCloseInactiveTickets,
  cleanupOrphanedTickets
}; 