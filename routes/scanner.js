const express = require('express');
const router = express.Router();
const ScannerController = require('../controllers/ScannerController');
const { ensureAuthenticated } = require('../config/auth');
const { ensureAdmin, ensureSecurity } = require('../middleware/auth');

let scannerController 

router.use((req, res, next) => {
  if (!scannerController) {
    scannerController = new ScannerController(req.app.locals.socketService);
  }
  next();
});

// Scanner interface (protected - only event staff)
router.get('/', ensureAuthenticated,ensureSecurity,  (req, res) => scannerController.getScannerPage(req, res));

// External scanner redirect endpoint - this will be in the QR code
router.get('/verify/:ticketId', ensureAuthenticated, ensureSecurity, (req, res) => scannerController.verifyExternalScan(req, res));
// Success page after check-in
router.get('/success', ensureAuthenticated,ensureSecurity,  (req, res) => {
    const { name } = req.query;
    res.render('scanner/external-success', { 
        user: req.user,
        name: name || 'Attendee'
    });
}); 
// API endpoints for scanner
router.post('/validate', ensureAuthenticated, ensureSecurity, (req, res) => scannerController.validateTicket(req, res));
router.post('/scan', ensureAuthenticated, ensureSecurity, (req, res) => scannerController.scanTicket(req, res));
router.get('/history', ensureAuthenticated, ensureSecurity, (req, res) => scannerController.getScanHistory(req, res));
// router.get('/stats', ensureAuthenticated, ensureSecurity, (req, res) => scannerController.getStats(req, res));

module.exports = router;