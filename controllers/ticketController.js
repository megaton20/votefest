const pool  = require('../config/db');
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
    const userId = req.session.userId;
    
    try {
      const userTickets = await pool.query(
        'SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      
      res.render('tickets', {
        user: req.session.user,
        tickets: userTickets.rows,
        prices: this.ticketPrices
      });
    } catch (error) {
      console.error('Ticket page error:', error);
      res.status(500).render('error', { error: 'Failed to load tickets' });
    }
  }
  
  async purchaseTicket(req, res) {
    const { ticketType } = req.body;
    const userId = req.session.userId;
    const userEmail = req.session.user.email;
    
    if (!this.ticketPrices[ticketType]) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }
    
    const amount = this.ticketPrices[ticketType];
    const finalAmount = amount; // Platform fee already included
    
    try {
      const payment = await this.paymentService.initializeTransaction(
        userEmail,
        finalAmount,
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
    const { reference } = req.query;
    const userId = req.session.userId;
    
    try {
      const verification = await this.paymentService.verifyTransaction(reference);
      
      if (verification.data.status === 'success') {
        const metadata = verification.data.metadata;
        const ticketType = metadata.ticketType;
        const amount = verification.data.amount / 100;
        
        // Generate QR code
        const qrData = JSON.stringify({
          ticketId: reference,
          type: ticketType,
          userId,
          event: 'VoteFest 2024',
          timestamp: Date.now()
        });
        
        const qrCodeUrl = await this.paymentService.generateQRCode(qrData);
        
        // Save ticket to database
        await pool.query(
          `INSERT INTO tickets 
           (id, user_id, ticket_type, amount, qr_code_url, paystack_reference)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), userId, ticketType, amount, qrCodeUrl, reference]
        );
        
        res.redirect('/tickets?success=Ticket purchased successfully');
      } else {
        res.redirect('/tickets?error=Payment failed');
      }
      
    } catch (error) {
      console.error('Ticket verification error:', error);
      res.redirect('/tickets?error=Verification failed');
    }
  }
}

module.exports = TicketController;
