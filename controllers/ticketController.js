const pool = require('../config/db');
const PaymentService = require('../services/PaymentService');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

class TicketController {
  constructor() {
    this.paymentService = new PaymentService();
    this.ticketPrices = {
      regular: 2000,
      vip: 10000,
      vvip: 50000
    };
    this.platformFee = 30;
  }
  
  async getTickets(req, res) {
    // Check if user is authenticated
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    
    const userId = req.user.id;
    
    try {
      const userTickets = await pool.query(
        'SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      
      // Check for success/error messages in query params
      const success = req.query.success || null;
      const error = req.query.error || null;
      
      res.render('tickets', {
        user: req.user,
        tickets: userTickets.rows,
        prices: this.ticketPrices,
        success,
        error
      });
    } catch (error) {
      console.error('Ticket page error:', error);
      res.status(500).render('error', { error: 'Failed to load tickets' });
    }
  }
  
  async purchaseTicket(req, res) {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { ticketType } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    if (!this.ticketPrices[ticketType]) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }
    
    const amount = this.ticketPrices[ticketType];
    
    try {
      const payment = await this.paymentService.initializeTransaction(
        userEmail,
        amount,
        {
          userId,
          type: 'ticket_purchase',
          ticketType
        }
      );
      
      res.json({
        success: true,
        authorization_url: payment.data.authorization_url,
        reference: payment.data.reference
      });
      
    } catch (error) {
      console.error('Ticket purchase error:', error);
      res.status(500).json({ error: 'Failed to initiate ticket purchase' });
    }
  }
  
  async verifyTicketPurchase(req, res) {
    // Check if user is authenticated
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    
    const { reference } = req.query;
    const userId = req.user.id;
    
    if (!reference) {
      return res.redirect('/tickets?error=No payment reference provided');
    }
    
    try {
      const verification = await this.paymentService.verifyTransaction(reference);
      // console.log('Payment verification:', verification);
      
      if (verification.data && verification.data.status === 'success') {
        const metadata = verification.data.metadata || {};
        const ticketType = metadata.ticketType || 'regular';
        const amount = verification.data.amount / 100; // Convert from kobo to naira
        
        // Check if ticket already exists
        const existingTicket = await pool.query(
          'SELECT * FROM tickets WHERE paystack_reference = $1',
          [reference]
        );
        
        if (existingTicket.rows.length > 0) {
          return res.redirect('/tickets?error=Ticket already processed');
        }
        
        // Generate QR code
        const qrData = JSON.stringify({
          ticketId: reference,
          type: ticketType,
          userId,
          event: 'VoteFest 2024',
          purchaseDate: new Date().toISOString(),
          amount: amount
        });
        
        const qrCodeUrl = await this.paymentService.generateQRCode(qrData);
        
        // Save ticket to database
        await pool.query(
          `INSERT INTO tickets 
           (id, user_id, ticket_type, amount, qr_code_url, paystack_reference, is_used, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [uuidv4(), userId, ticketType, amount, qrCodeUrl, reference, false]
        );
        
        res.redirect('/tickets?success=Ticket purchased successfully');
      } else {
        res.redirect('/tickets?error=Payment verification failed');
      }
      
    } catch (error) {
      console.error('Ticket verification error:', error);
      res.redirect('/tickets?error=Verification failed: ' + error.message);
    }
  }
}

module.exports = TicketController;