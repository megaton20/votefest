const express = require('express');
const router = express.Router();
const ScannerController = require('../controllers/ScannerController');
const { ensureAuthenticated, ensureAdmin } = require('../config/auth');

const scannerController = new ScannerController();

// Scanner interface (protected - only event staff)
router.get('/', ensureAuthenticated, ensureAdmin, (req, res) => scannerController.getScannerPage(req, res));

// API endpoints for scanner
router.post('/validate', ensureAuthenticated, ensureAdmin, (req, res) => scannerController.validateTicket(req, res));
router.post('/scan', ensureAuthenticated, ensureAdmin, (req, res) => scannerController.scanTicket(req, res));
router.get('/history', ensureAuthenticated, ensureAdmin, (req, res) => scannerController.getScanHistory(req, res));
router.get('/stats', ensureAuthenticated, ensureAdmin, (req, res) => scannerController.getStats(req, res));

module.exports = router;