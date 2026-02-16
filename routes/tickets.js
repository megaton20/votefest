const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');

const ticketController = new TicketController();



router.get('/', (req, res) => ticketController.getTickets(req, res));
router.post('/purchase', (req, res) => ticketController.purchaseTicket(req, res));
router.get('/verify', (req, res) => ticketController.verifyTicketPurchase(req, res));

module.exports = router;
