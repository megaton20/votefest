const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/TicketController');

// Middleware to initialize controller with socketService from app.locals
router.use((req, res, next) => {
  // Create controller instance with socketService from app.locals
  if (!req.app.locals.ticketController) {
    req.app.locals.ticketController = new TicketController(req.app.locals.socketService);
  }
  next();
});

// User routes
router.get('/', (req, res) => req.app.locals.ticketController.getTickets(req, res));
router.post('/purchase', (req, res) => req.app.locals.ticketController.purchaseTicket(req, res));
router.get('/verify', (req, res) => req.app.locals.ticketController.verifyTicketPurchase(req, res));

// API routes
router.get('/api/my', (req, res) => req.app.locals.ticketController.getMyTickets(req, res));
router.get('/api/:ticketId', (req, res) => req.app.locals.ticketController.getTicketDetails(req, res));

// Admin routes
router.get('/admin/scanner', (req, res) => req.app.locals.ticketController.getAdminDashboard(req, res));
router.post('/admin/verify', (req, res) => req.app.locals.ticketController.verifyAttendee(req, res));
router.post('/admin/checkin', (req, res) => req.app.locals.ticketController.checkInAttendee(req, res));
router.get('/admin/history', (req, res) => req.app.locals.ticketController.getScanHistory(req, res));
router.get('/admin/stats', (req, res) => req.app.locals.ticketController.getAdminStats(req, res));
router.get('/admin/valid', (req, res) => req.app.locals.ticketController.getValidTickets(req, res));

module.exports = router;