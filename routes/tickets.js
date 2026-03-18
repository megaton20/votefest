const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require("../config/auth");
const pool = require('../config/db');

// This will be initialized with socketService from app.locals
let ticketController;

// Middleware to initialize controller
router.use((req, res, next) => {
  if (!ticketController) {
    const TicketController = require('../controllers/ticketController');
    ticketController = new TicketController(req.app.locals.socketService);
  }
  next();
});

// ============= USER ROUTES =============
router.get('/', ensureAuthenticated, (req, res) => ticketController.getTickets(req, res));
router.post('/purchase', ensureAuthenticated, (req, res) => ticketController.purchaseTicket(req, res));
router.get('/verify', ensureAuthenticated, (req, res) => ticketController.verifyTicketPurchase(req, res));

// ============= TICKET TRANSFER ROUTES =============
router.post('/transfer', ensureAuthenticated, (req, res) => ticketController.transferTicket(req, res));
router.get('/transfer/verify', ensureAuthenticated, (req, res) => ticketController.verifyTransferPayment(req, res));
router.get('/transfer/history', ensureAuthenticated, (req, res) => ticketController.getTransferHistory(req, res));

// ============= API ROUTES =============
router.get('/api/my',ensureAuthenticated, (req, res) => ticketController.getMyTickets(req, res));
router.get('/api/:ticketId',ensureAuthenticated, (req, res) => ticketController.getTicketDetails(req, res));


// ============= ADMIN ROUTES =============
router.get('/admin/scanner', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.getAdminDashboard(req, res));
router.post('/admin/verify', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.verifyAttendee(req, res));
router.post('/admin/checkin', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.checkInAttendee(req, res));
router.get('/admin/history', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.getScanHistory(req, res));
router.get('/admin/stats', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.getAdminStats(req, res));
router.get('/admin/valid', ensureAuthenticated, ensureAdmin, (req, res) => ticketController.getValidTickets(req, res));

module.exports = router;