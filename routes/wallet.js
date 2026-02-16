const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');

let walletController;

router.use((req, res, next) => {
  // console.log(req.app.locals);
  if (!walletController) {
    walletController = new WalletController(req.app.locals.socketService);
  }
  next();
});



router.get('/',  (req, res) => walletController.getWallet(req, res));
router.post('/fund',  (req, res) => walletController.fundWallet(req, res));
router.post('/transfer',  (req, res) => walletController.transferCoins(req, res));
router.get('/verify',  (req, res) => walletController.verifyPayment(req, res));
// Add this to your wallet routes
router.get('/balance', async (req, res) => {
    try {
        const Wallet = require('../models/Wallet');
        const wallet = new Wallet(req.user.id);
        const balance = await wallet.getBalance();
        res.json({ balance });
    } catch (error) {
        console.error('Balance fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

module.exports = router;
