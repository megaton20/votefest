const pool = require('../config/db');
const PaymentService = require('../services/PaymentService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class TicketController {
  constructor(socketService) {
    this.paymentService = new PaymentService();
    this.socketService = socketService;

    // Transfer fee configuration - REAL MONEY via Paystack
  this.transferFee = 100; // ₦100 in naira
  this.transferFeeKobo = 100 * 100;

    this.ticketPrices = {
      regular: { name: 'Regular', price: 2000, capacity: 1, type: 'single' },
      vip: { name: 'VIP', price: 10000, capacity: 1, type: 'single' },
      table5: { name: 'Table for 5', price: 15000, capacity: 5, type: 'table' },
      table10: { name: 'Table for 10', price: 25000, capacity: 10, type: 'table' },
      table15: { name: 'Table for 15', price: 35000, capacity: 15, type: 'table' }
    };

    // ============= ENVIRONMENT DETECTION =============
    this.isLive = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_');
    this.environment = this.isLive ? 'LIVE' : 'TEST';
    
  }

  // ============= USER TICKET PAGES =============

  async getTickets(req, res) {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const userId = req.user.id;
    const userEmail = req.user.email;

    try {
      // Get tickets this user purchased
      const purchasedTickets = await pool.query(`
        SELECT t.*, 
               COUNT(it.id) as total_attendees,
               SUM(CASE WHEN it.is_checked_in THEN 1 ELSE 0 END) as checked_in_count
        FROM tickets t
        LEFT JOIN individual_tickets it ON it.parent_ticket_id = t.id
        WHERE t.purchaser_id = $1
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `, [userId]);

      // Get individual tickets assigned to this user
      const myTickets = await pool.query(`
        SELECT it.*, t.ticket_category, t.purchaser_id,
               u.username as purchaser_name,
               u.email as purchaser_email,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.user_id = $1 OR it.attendee_email = $2
        ORDER BY it.created_at DESC
      `, [userId, userEmail]);

      const success = req.query.success || null;
      const error = req.query.error || null;

      res.render('tickets', {
        user: req.user,
        purchasedTickets: purchasedTickets.rows,
        myTickets: myTickets.rows,
        ticketPrices: this.ticketPrices,
        success,
        error
      });

    } catch (error) {
      console.error('Ticket page error:', error);
      res.status(500).render('error', { error: 'Failed to load tickets' });
    }
  }

  async purchaseTicket(req, res) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { ticketCategory, attendees } = req.body;
    const purchaserId = req.user.id;
    const purchaserEmail = req.user.email;
    const purchaserName = req.user.username;

    const category = this.ticketPrices[ticketCategory];
    if (!category) {
      return res.status(400).json({ success: false, error: 'Invalid ticket category' });
    }

    // ===== SINGLE TICKET PURCHASE =====
    if (category.type === 'single') {
      const totalAmount = category.price;

      try {
        // PaymentService now handles split codes automatically based on environment
        let callback= `tickets?verify=1`
        const payment = await this.paymentService.initializeTransaction(
          purchaserEmail,
          totalAmount,
          {
            purchaserId,
            type: 'ticket_purchase',
            ticketCategory,
            isSingle: true,
            environment: this.environment
          },
          callback
        );

        req.session.pendingTicket = {
          reference: payment.data.reference,
          ticketCategory,
          totalAmount,
          purchaserId,
          purchaserName,
          isSingle: true
        };

        return res.json({
          success: true,
          authorization_url: payment.data.authorization_url,
          reference: payment.data.reference,
          message: 'Payment initialized successfully'
        });

      } catch (error) {
        console.error('Single ticket purchase error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to initiate ticket purchase'
        });
      }
    }

    // ===== TABLE TICKET PURCHASE =====
    if (!attendees || !Array.isArray(attendees) || attendees.length !== category.capacity) {
      return res.status(400).json({
        success: false,
        error: `Please provide details for all ${category.capacity} attendees`
      });
    }

    const verifiedAttendees = [];
    const errors = [];

    for (let i = 0; i < attendees.length; i++) {
      const attendee = attendees[i];

      if (!attendee.fullName || !attendee.fullName.trim()) {
        errors.push(`Attendee ${i + 1}: Name is required`);
        continue;
      }

      if (!attendee.email || !attendee.email.trim()) {
        errors.push(`Attendee ${i + 1}: Email is required`);
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(attendee.email)) {
        errors.push(`Attendee ${i + 1}: Invalid email format`);
        continue;
      }

      let userId = null;
      let user = null;

      if (attendee.walletAccount && attendee.walletAccount.trim()) {
        const wallet = attendee.walletAccount.trim();

        if (!wallet.match(/^ACC\d{6}$/)) {
          errors.push(`Attendee ${i + 1}: Invalid wallet format. Should be ACC followed by 6 digits`);
          continue;
        }

        const userResult = await pool.query(
          'SELECT id, username, email FROM users WHERE wallet_account = $1',
          [wallet]
        );

        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          user = userResult.rows[0];
        }
      }

      verifiedAttendees.push({
        fullName: attendee.fullName.trim(),
        email: attendee.email.trim().toLowerCase(),
        walletAccount: attendee.walletAccount ? attendee.walletAccount.trim() : null,
        userId,
        user
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors,
        message: 'Please fix the following errors:'
      });
    }

    const totalAmount = category.price;

    try {
      // PaymentService handles split automatically
      const payment = await this.paymentService.initializeTransaction(
        purchaserEmail,
        totalAmount,
        {
          purchaserId,
          type: 'ticket_purchase',
          ticketCategory,
          capacity: category.capacity,
          attendees: verifiedAttendees.map(a => ({
            name: a.fullName,
            email: a.email,
            wallet: a.walletAccount,
            userId: a.userId
          })),
          environment: this.environment
        }
      );

      req.session.pendingTicket = {
        reference: payment.data.reference,
        ticketCategory,
        attendees: verifiedAttendees,
        totalAmount,
        purchaserId,
        purchaserName,
        capacity: category.capacity,
        isTable: true
      };

      res.json({
        success: true,
        authorization_url: payment.data.authorization_url,
        reference: payment.data.reference,
        message: 'Payment initialized successfully'
      });

    } catch (error) {
      console.error('Table ticket purchase error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate ticket purchase'
      });
    }
  }

  async verifyTicketPurchase(req, res) {


    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'No payment reference provided' });
    }

    const pendingTicket = req.session.pendingTicket;

    if (!pendingTicket || pendingTicket.reference !== reference) {
      return res.status(400).json({
        success: false,
        error: 'Session expired. Please try again.'
      });
    }

    try {
      const verification = await this.paymentService.verifyTransaction(reference);

      if (verification.data && verification.data.status === 'success') {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          const existing = await client.query(
            'SELECT * FROM tickets WHERE paystack_reference = $1',
            [reference]
          );

          if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.json({ success: false, error: 'Ticket already processed' });
          }

          const ticketId = uuidv4();
          const { ticketCategory, totalAmount, purchaserId, purchaserName } = pendingTicket;
          const category = this.ticketPrices[ticketCategory];

          // Create main ticket record
          await client.query(
            `INSERT INTO tickets 
             (id, purchaser_id, ticket_category, quantity, total_amount, paystack_reference, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [ticketId, purchaserId, ticketCategory, category.capacity, totalAmount, reference]
          );

          // Store split information if available (from verification)
          if (verification.data.split) {

            await client.query(
              `INSERT INTO payment_splits 
               (payment_reference, split_config, environment, created_at)
               VALUES ($1, $2, $3, NOW())`,
              [reference, JSON.stringify(verification.data.split), this.environment]
            );
          }

          const individualTickets = [];

          // ===== SINGLE TICKET VERIFICATION =====
          if (pendingTicket.isSingle) {
            const individualId = uuidv4();

            const qrData = JSON.stringify({
              ticketId: individualId,
              parentId: ticketId,
              name: req.user.username,
              email: req.user.email,
              type: ticketCategory,
              event: 'VoteFest 2024'
            });

            // Create scan URL for external scanner
            const scanUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/scanner/verify/${individualId}`;
            const qrCodeUrl = await this.paymentService.generateQRCode(scanUrl);
            const qrCodeHash = crypto.createHash('md5').update(scanUrl).digest('hex');

            await client.query(
              `INSERT INTO individual_tickets 
               (id, parent_ticket_id, user_id, wallet_account, attendee_name, attendee_email, 
                ticket_type, qr_code_url, qr_code_hash, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
              [
                individualId,
                ticketId,
                purchaserId,
                req.user.wallet_account,
                req.user.username,
                req.user.email,
                ticketCategory,
                qrCodeUrl,
                qrCodeHash
              ]
            );

            individualTickets.push({
              id: individualId,
              email: req.user.email,
              userId: purchaserId,
              name: req.user.username,
              isRegistered: true
            });

          // ===== TABLE TICKET VERIFICATION =====
          } else if (pendingTicket.isTable) {
            for (let i = 0; i < pendingTicket.attendees.length; i++) {
              const attendee = pendingTicket.attendees[i];
              const individualId = uuidv4();

              const qrData = JSON.stringify({
                ticketId: individualId,
                parentId: ticketId,
                name: attendee.fullName,
                email: attendee.email,
                type: ticketCategory,
                event: 'VoteFest 2024'
              });

              // Create scan URL for external scanner
              const scanUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/scanner/verify/${individualId}`;
              const qrCodeUrl = await this.paymentService.generateQRCode(scanUrl);
              const qrCodeHash = crypto.createHash('md5').update(scanUrl).digest('hex');

              await client.query(
                `INSERT INTO individual_tickets 
                 (id, parent_ticket_id, user_id, wallet_account, attendee_name, attendee_email, 
                  ticket_type, qr_code_url, qr_code_hash, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                [
                  individualId,
                  ticketId,
                  attendee.userId,
                  attendee.walletAccount,
                  attendee.fullName,
                  attendee.email,
                  ticketCategory,
                  qrCodeUrl,
                  qrCodeHash
                ]
              );

              individualTickets.push({
                id: individualId,
                email: attendee.email,
                userId: attendee.userId,
                name: attendee.fullName,
                isRegistered: !!attendee.userId
              });

              // Create notification for registered users
              if (attendee.userId && this.socketService) {
                const notificationId = uuidv4();
                await client.query(
                  `INSERT INTO notifications 
                   (id, user_id, type, title, message, data, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                  [
                    notificationId,
                    attendee.userId,
                    'ticket_received',
                    '🎫 You received a ticket!',
                    `${purchaserName} added you to a ${category.name} ticket`,
                    JSON.stringify({
                      ticketId: individualId,
                      parentTicketId: ticketId,
                      purchaserName,
                      ticketType: ticketCategory
                    })
                  ]
                );

                this.socketService.sendToUser(attendee.userId, 'ticket_received', {
                  ticketId: individualId,
                  purchaserName: purchaserName,
                  ticketType: category.name,
                  message: `${purchaserName} added you to a ${category.name} ticket`,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
 
          await client.query('COMMIT');

          // Notify purchaser
          if (this.socketService) {
            this.socketService.sendToUser(purchaserId, 'tickets_distributed', {
              count: individualTickets.length,
              registeredCount: individualTickets.filter(t => t.isRegistered).length,
              emailCount: individualTickets.filter(t => !t.isRegistered).length,
              message: `Your ${category.name} ticket${individualTickets.length > 1 ? 's have' : ' has'} been created`,
              timestamp: new Date().toISOString()
            });
          }

          delete req.session.pendingTicket;

          // Log split information from verification
          const splitInfo = this.paymentService.getSplitInfo(verification);
          if (splitInfo) {
            console.log(`[${this.environment}] Payment split details:`, splitInfo);
          }

          return res.json({
            success: true,
            message: `${category.name} purchased successfully!`,
            ticketId,
            ticketCategory: category.name,
            recipientCount: individualTickets.length,
            registeredCount: individualTickets.filter(t => t.isRegistered).length,
            emailCount: individualTickets.filter(t => !t.isRegistered).length
          });

        } catch (dbError) {
          await client.query('ROLLBACK');
          throw dbError;
        } finally {
          client.release();
        }

      } else {
        return res.json({ success: false, error: 'Payment verification failed' });
      }

    } catch (error) {
      console.error('Ticket verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Verification failed: ' + error.message
      });
    }
  }

  // ============= API METHODS =============

  async getMyTickets(req, res) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
      const userId = req.user.id;
      const userEmail = req.user.email;

      const tickets = await pool.query(`
        SELECT it.*, t.ticket_category, t.purchaser_id,
               u.username as purchaser_name,
               u.email as purchaser_email,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.user_id = $1 OR it.attendee_email = $2
        ORDER BY it.created_at DESC
      `, [userId, userEmail]);

      res.json({
        success: true,
        tickets: tickets.rows
      });
    } catch (error) {
      console.error('Get my tickets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tickets'
      });
    }
  }

  async getTicketDetails(req, res) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
      const { ticketId } = req.params;
      const userId = req.user.id;
      const userEmail = req.user.email;

      const ticket = await pool.query(`
        SELECT it.*, t.ticket_category, t.purchaser_id,
               u.username as purchaser_name,
               (SELECT COUNT(*) FROM individual_tickets WHERE parent_ticket_id = t.id) as group_size,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.id = $1 AND (it.user_id = $2 OR it.attendee_email = $3)
      `, [ticketId, userId, userEmail]);

      if (ticket.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }

      res.json({
        success: true,
        ticket: ticket.rows[0]
      });
    } catch (error) {
      console.error('Get ticket error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket'
      });
    }
  }

  // ============= ADMIN VERIFICATION METHODS =============
  async getAdminDashboard(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).render('error', { error: 'Access denied' });
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT t.id) as total_tickets_sold,
          COUNT(DISTINCT it.id) as total_attendees,
          SUM(CASE WHEN DATE(it.checked_in_at) = $1 THEN 1 ELSE 0 END) as checked_in_today,
          SUM(t.total_amount) as total_revenue
        FROM tickets t
        JOIN individual_tickets it ON it.parent_ticket_id = t.id
        WHERE DATE(t.created_at) = $1
      `, [today]);

      const recentCheckins = await pool.query(`
        SELECT sl.*, it.attendee_name, it.ticket_type, u.username as scanner_name
        FROM scan_logs sl
        JOIN individual_tickets it ON it.id = sl.ticket_id
        JOIN users u ON u.id = sl.scanner_id
        ORDER BY sl.scanned_at DESC
        LIMIT 20
      `);

      const validTickets = await pool.query(`
        SELECT it.*, t.ticket_category, u.username as purchaser_name,
               u.username as username,
               t.paystack_reference,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.is_checked_in = false
        ORDER BY it.created_at DESC
      `);

      res.render('admin/dashboard', {
        user: req.user,
        stats: stats.rows[0] || {
          total_tickets_sold: 0,
          total_attendees: 0,
          checked_in_today: 0,
          total_revenue: 0
        },
        recentCheckins: recentCheckins.rows,
        validTickets: validTickets.rows
      });

    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).render('error', { error: 'Failed to load admin dashboard' });
    }
  }

  async verifyAttendee(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { identifier } = req.body;

    try {
      let query = '';
      let params = [];

      if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        query = `
          SELECT it.*, t.ticket_category, t.purchaser_id,
                 u.username as purchaser_name, u.email as purchaser_email,
                 CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
          FROM individual_tickets it
          JOIN tickets t ON t.id = it.parent_ticket_id
          JOIN users u ON u.id = t.purchaser_id
          WHERE it.id = $1
        `;
        params = [identifier];
      } else if (identifier.match(/^ACC\d{6}$/)) {
        query = `
          SELECT it.*, t.ticket_category, t.purchaser_id,
                 u.username as purchaser_name, u.email as purchaser_email,
                 CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
          FROM individual_tickets it
          JOIN tickets t ON t.id = it.parent_ticket_id
          JOIN users u ON u.id = t.purchaser_id
          WHERE it.wallet_account = $1 AND it.is_checked_in = false
        `;
        params = [identifier];
      } else if (identifier.includes('@')) {
        query = `
          SELECT it.*, t.ticket_category, t.purchaser_id,
                 u.username as purchaser_name, u.email as purchaser_email,
                 CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
          FROM individual_tickets it
          JOIN tickets t ON t.id = it.parent_ticket_id
          JOIN users u ON u.id = t.purchaser_id
          WHERE it.attendee_email = $1 AND it.is_checked_in = false
        `;
        params = [identifier.toLowerCase()];
      } else {
        query = `
          SELECT it.*, t.ticket_category, t.purchaser_id,
                 u.username as purchaser_name, u.email as purchaser_email,
                 CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
          FROM individual_tickets it
          JOIN tickets t ON t.id = it.parent_ticket_id
          JOIN users u ON u.id = t.purchaser_id
          WHERE it.attendee_name ILIKE $1 AND it.is_checked_in = false
          LIMIT 10
        `;
        params = [`%${identifier}%`];
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.json({
          success: false,
          message: 'No valid attendee found with this identifier'
        });
      }

      if (result.rows.length > 1) {
        return res.json({
          success: true,
          multiple: true,
          attendees: result.rows.map(a => ({
            id: a.id,
            name: a.attendee_name,
            email: a.attendee_email,
            wallet: a.wallet_account,
            ticketType: a.ticket_type,
            purchaser: a.purchaser_name,
            isRegistered: a.is_registered
          }))
        });
      }

      const attendee = result.rows[0];

      res.json({
        success: true,
        multiple: false,
        attendee: {
          id: attendee.id,
          name: attendee.attendee_name,
          email: attendee.attendee_email,
          wallet: attendee.wallet_account,
          ticketType: attendee.ticket_type,
          ticketCategory: attendee.ticket_category,
          purchaserName: attendee.purchaser_name,
          purchaserEmail: attendee.purchaser_email,
          qrCode: attendee.qr_code_url,
          isRegistered: attendee.is_registered
        }
      });

    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ success: false, error: 'Verification failed' });
    }
  }

  async checkInAttendee(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { attendeeId } = req.body;
    const scannerId = req.user.id;

    try {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const attendee = await client.query(
          'SELECT * FROM individual_tickets WHERE id = $1 FOR UPDATE',
          [attendeeId]
        );

        if (attendee.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Attendee not found' });
        }

        if (attendee.rows[0].is_checked_in) {
          await client.query('ROLLBACK');
          return res.json({
            success: false,
            message: 'Already checked in',
            checkedInAt: attendee.rows[0].checked_in_at
          });
        }

        await client.query(
          `UPDATE individual_tickets 
           SET is_checked_in = true, 
               checked_in_at = NOW(), 
               checked_in_by = $1 
           WHERE id = $2`,
          [scannerId, attendeeId]
        );

        const logId = uuidv4();
        await client.query(
          `INSERT INTO scan_logs 
           (id, ticket_id, scanner_id, attendee_name, ticket_type, scanned_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            logId,
            attendeeId,
            scannerId,
            attendee.rows[0].attendee_name,
            attendee.rows[0].ticket_type
          ]
        );

        const parentCheck = await client.query(`
          SELECT COUNT(*) as total, 
                 SUM(CASE WHEN is_checked_in THEN 1 ELSE 0 END) as checked
          FROM individual_tickets 
          WHERE parent_ticket_id = $1
        `, [attendee.rows[0].parent_ticket_id]);

        const { total, checked } = parentCheck.rows[0];

        if (parseInt(checked) === parseInt(total)) {
          await client.query(
            'UPDATE tickets SET is_fully_used = true WHERE id = $1',
            [attendee.rows[0].parent_ticket_id]
          );
        }

        await client.query('COMMIT');

        if (attendee.rows[0].user_id && this.socketService) {
          this.socketService.sendToUser(attendee.rows[0].user_id, 'ticket_checked_in', {
            ticketId: attendeeId,
            checkedInAt: new Date().toISOString()
          });
        }

        res.json({
          success: true,
          message: `✅ ${attendee.rows[0].attendee_name} checked in successfully`,
          attendee: {
            id: attendee.rows[0].id,
            name: attendee.rows[0].attendee_name,
            ticketType: attendee.rows[0].ticket_type,
            isRegistered: !!attendee.rows[0].user_id
          },
          progress: {
            checked: parseInt(checked) + 1,
            total: parseInt(total)
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ success: false, error: 'Failed to check in attendee' });
    }
  }

  async getScanHistory(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { date, limit = 100 } = req.query;

    try {
      let query = `
        SELECT sl.*, it.attendee_name, it.ticket_type, 
               u.username as scanner_name,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM scan_logs sl
        JOIN individual_tickets it ON it.id = sl.ticket_id
        JOIN users u ON u.id = sl.scanner_id
      `;

      const params = [];

      if (date) {
        query += ` WHERE DATE(sl.scanned_at) = $1`;
        params.push(date);
      }

      query += ` ORDER BY sl.scanned_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const history = await pool.query(query, params);

      res.json({
        success: true,
        scans: history.rows
      });

    } catch (error) {
      console.error('Scan history error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch scan history' });
    }
  }

  async getAdminStats(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT t.id) as total_tickets_sold,
          COUNT(DISTINCT it.id) as total_attendees,
          SUM(CASE WHEN DATE(it.checked_in_at) = $1 THEN 1 ELSE 0 END) as checked_in_today,
          SUM(t.total_amount) as total_revenue,
          SUM(CASE WHEN it.ticket_type = 'vip' THEN 1 ELSE 0 END) as vip_count,
          SUM(CASE WHEN it.ticket_type = 'regular' THEN 1 ELSE 0 END) as regular_count,
          SUM(CASE WHEN it.ticket_type = 'table5' THEN 1 ELSE 0 END) as table5_count,
          SUM(CASE WHEN it.ticket_type = 'table10' THEN 1 ELSE 0 END) as table10_count,
          SUM(CASE WHEN it.ticket_type = 'table15' THEN 1 ELSE 0 END) as table15_count
        FROM tickets t
        JOIN individual_tickets it ON it.parent_ticket_id = t.id
      `, [today]);

      res.json({
        success: true,
        stats: stats.rows[0]
      });

    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  }

  async getValidTickets(req, res) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    try {
      const tickets = await pool.query(`
        SELECT it.*, t.ticket_category, u.username as purchaser_name,
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.is_checked_in = false
        ORDER BY it.created_at DESC
      `);

      res.json({
        success: true,
        tickets: tickets.rows
      });

    } catch (error) {
      console.error('Get valid tickets error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
  }
  
  
  /**
 * Initiate and complete ticket transfer in one flow
 */

async transferTicket(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const { ticketId, receiverWallet } = req.body;
  const fromUserId = req.user.id;
  const fromUserEmail = req.user.email;

  if (!ticketId || !receiverWallet) {
    return res.status(400).json({ 
      success: false, 
      error: 'Ticket ID and receiver wallet are required' 
    });
  }

  // Validate receiver wallet format
  if (!receiverWallet.match(/^ACC\d{6}$/)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid wallet format. Should be ACC followed by 6 digits' 
    });
  }

  const client = await pool.connect();
 console.log("init Transfer Payment...")
  try {
    await client.query('BEGIN');

    // 1. Check if ticket exists and belongs to user
    const ticketCheck = await client.query(`
      SELECT it.*, t.ticket_category, t.purchaser_id 
      FROM individual_tickets it
      JOIN tickets t ON t.id = it.parent_ticket_id
      WHERE it.id = $1 AND it.user_id = $2 AND it.is_checked_in = false
      FOR UPDATE
    `, [ticketId, fromUserId]);

    if (ticketCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found, already checked in, or does not belong to you' 
      });
    }

    const ticket = ticketCheck.rows[0];

    // 2. Check if receiver exists
    const receiverCheck = await client.query(
      'SELECT id, username, email FROM users WHERE wallet_account = $1',
      [receiverWallet]
    );

    if (receiverCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Receiver not found with this wallet account' 
      });
    }

    const receiver = receiverCheck.rows[0];

    // 3. Check if user is trying to transfer to themselves
    if (receiver.id === fromUserId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot transfer a ticket to yourself' 
      });
    }

    // 4. Check for existing pending transfers
    const existingTransfer = await client.query(`
      SELECT id FROM ticket_transfers 
      WHERE ticket_id = $1 AND status = 'pending'
    `, [ticketId]);

    if (existingTransfer.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'This ticket already has a pending transfer' 
      });
    }

    // 5. Create transfer record
    const transferId = uuidv4();
    await client.query(`
      INSERT INTO ticket_transfers 
      (id, ticket_id, from_user_id, to_user_id, to_wallet_account, status, fee_amount, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
    `, [transferId, ticketId, fromUserId, receiver.id, receiverWallet, this.transferFee]);

    await client.query('COMMIT');

    // 6. Initialize Paystack payment for fee with CORRECT callback URL
   let callback=  `tickets/transfer/verify`
    const payment = await this.paymentService.initializeTransaction(
      fromUserEmail,
      this.transferFee,
      {
        type: 'transfer_fee',
        transferId,
        ticketId,
        fromUserId,
        toUserId: receiver.id,
        ticketType: ticket.ticket_type,
        attendeeName: ticket.attendee_name,
        purpose: 'Ticket transfer fee'
      },
      callback 
      // Note: No splitConfig needed - this is just a fee payment
    );

    // Update transfer with payment reference
    await pool.query(`
      UPDATE ticket_transfers 
      SET fee_reference = $1
      WHERE id = $2
    `, [payment.data.reference, transferId]);

    res.json({
      success: true,
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
      message: `Proceed to pay ₦${this.transferFee} transfer fee`,
      transferId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transfer initiation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to initiate transfer' 
    });
  } finally {
    client.release();
  }
}

/**
 * Verify transfer payment and complete transfer immediately
 */

async verifyTransferPayment(req, res) {
  if (!req.user) {
    return res.redirect('/auth/login?returnTo=' + encodeURIComponent(req.originalUrl));
  }

    console.log("verify Transfer Payment...")

  const { reference } = req.query;
  const userId = req.user.id;

  if (!reference) {
    return res.redirect('/tickets?error=No payment reference provided');
  }

  try {
    // First verify payment with Paystack
    const verification = await this.paymentService.verifyTransaction(reference);

    if (!verification.data || verification.data.status !== 'success') {
      return res.redirect('/tickets?error=Payment verification failed');
    }

    console.log(`Payment verified for reference: ${reference}`);

    // Get transfer associated with this payment - removed the from_user_id filter
    // because the payment reference is unique and should identify the transfer
    const transferResult = await pool.query(`
      SELECT t.*, it.attendee_name, it.ticket_type, it.qr_code_url,
             u_from.username as sender_name,
             u_to.username as receiver_name,
             u_from.email as sender_email,
             u_to.email as receiver_email
      FROM ticket_transfers t
      JOIN individual_tickets it ON it.id = t.ticket_id
      JOIN users u_from ON u_from.id = t.from_user_id
      JOIN users u_to ON u_to.id = t.to_user_id
      WHERE t.fee_reference = $1
    `, [reference]);

    if (transferResult.rows.length === 0) {
      console.error(`❌ No transfer found for reference: ${reference}`);
      return res.redirect('/tickets?error=Transfer not found');
    }

    const transfer = transferResult.rows[0];

    // Verify that the current user is the sender (security check)
    if (transfer.from_user_id !== userId) {
      console.error(`❌ User mismatch: transfer owner ${transfer.from_user_id} vs current user ${userId}`);
      return res.redirect('/tickets?error=Unauthorized access');
    }

    // Check if transfer is already completed
    if (transfer.status === 'completed') {
      return res.redirect('/tickets?success=Ticket already transferred');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update ticket ownership - IMMEDIATE transfer
      const updateResult = await client.query(`
        UPDATE individual_tickets 
        SET user_id = $1, wallet_account = $2
        WHERE id = $3
        RETURNING id
      `, [transfer.to_user_id, transfer.to_wallet_account, transfer.ticket_id]);

      if (updateResult.rows.length === 0) {
        throw new Error('Failed to update ticket ownership');
      }

      // Update transfer status
      await client.query(`
        UPDATE ticket_transfers 
        SET status = 'completed', fee_paid_at = NOW(), completed_at = NOW()
        WHERE id = $1
      `, [transfer.id]);

      // Create notification for receiver (ticket received)
      const receiverNotifId = uuidv4();
      await client.query(`
        INSERT INTO notifications 
        (id, user_id, type, title, message, data, created_at)
        VALUES ($1, $2, 'ticket_received', '🎫 Ticket Received!',
                $3, $4, NOW())
      `, [
        receiverNotifId,
        transfer.to_user_id,
        `${transfer.sender_name} transferred a ${transfer.ticket_type} ticket to you`,
        JSON.stringify({
          ticketId: transfer.ticket_id,
          transferId: transfer.id,
          fromUser: transfer.sender_name,
          ticketType: transfer.ticket_type,
          attendeeName: transfer.attendee_name,
          qrCodeUrl: transfer.qr_code_url
        })
      ]);

      // Create notification for sender (transfer completed)
      const senderNotifId = uuidv4();
      await client.query(`
        INSERT INTO notifications 
        (id, user_id, type, title, message, data, created_at)
        VALUES ($1, $2, 'transfer_completed', '✅ Transfer Completed',
                $3, $4, NOW())
      `, [
        senderNotifId,
        userId,
        `Ticket transferred to ${transfer.receiver_name}. ₦${this.transferFee} fee paid.`,
        JSON.stringify({
          ticketId: transfer.ticket_id,
          transferId: transfer.id,
          toUser: transfer.receiver_name,
          ticketType: transfer.ticket_type,
          fee: this.transferFee
        })
      ]);

      await client.query('COMMIT');

      // Send real-time notifications via Socket.IO
      if (this.socketService) {
        this.socketService.sendToUser(transfer.to_user_id, 'ticket_received', {
          ticketId: transfer.ticket_id,
          fromUser: transfer.sender_name,
          ticketType: transfer.ticket_type,
          attendeeName: transfer.attendee_name,
          message: `${transfer.sender_name} transferred a ${transfer.ticket_type} ticket to you`,
          qrCodeUrl: transfer.qr_code_url
        });

        this.socketService.sendToUser(userId, 'transfer_completed', {
          transferId: transfer.id,
          toUser: transfer.receiver_name,
          message: `Ticket transferred to ${transfer.receiver_name}. ₦${this.transferFee} fee paid.`
        });
      }

      // Log the split information for the fee payment
      const splitInfo = this.paymentService.getSplitInfo(verification);
      // if (splitInfo) {
      //   console.log(`Transfer fee split [${this.environment}]:`, splitInfo);
      // }

      res.redirect('/tickets?success=Ticket transferred successfully!');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transfer completion error:', error);
      res.redirect('/tickets?error=Transfer failed: ' + error.message);
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Transfer verification error:', error);
    res.redirect('/tickets?error=Transfer verification failed');
  }
}

/**
 * Get transfer history
 */
async getTransferHistory(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const userId = req.user.id;

  try {
    // Transfers sent by user
    const sentTransfers = await pool.query(`
      SELECT t.*, it.attendee_name, it.ticket_type,
             u.username as receiver_name,
             to_char(t.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted,
             to_char(t.completed_at, 'YYYY-MM-DD HH24:MI:SS') as completed_at_formatted
      FROM ticket_transfers t
      JOIN individual_tickets it ON it.id = t.ticket_id
      LEFT JOIN users u ON u.id = t.to_user_id
      WHERE t.from_user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [userId]);

    // Transfers received by user
    const receivedTransfers = await pool.query(`
      SELECT t.*, it.attendee_name, it.ticket_type,
             u.username as sender_name,
             to_char(t.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted,
             to_char(t.completed_at, 'YYYY-MM-DD HH24:MI:SS') as completed_at_formatted
      FROM ticket_transfers t
      JOIN individual_tickets it ON it.id = t.ticket_id
      JOIN users u ON u.id = t.from_user_id
      WHERE t.to_user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      sent: sentTransfers.rows,
      received: receivedTransfers.rows,
      fee: this.transferFee
    });

  } catch (error) {
    console.error('Transfer history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch transfer history' 
    });
  }
}



}

module.exports = TicketController;



