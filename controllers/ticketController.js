const pool = require('../config/db');
const PaymentService = require('../services/PaymentService');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class TicketController {
  constructor(socketService) {
    this.paymentService = new PaymentService();
    this.socketService = socketService;
    this.ticketPrices = {
      regular: { name: 'Regular', price: 2000, capacity: 1, type: 'single' },
      vip: { name: 'VIP', price: 10000, capacity: 1, type: 'single' },
      table5: { name: 'Table for 5', price: 15000, capacity: 5, type: 'table' },
      table10: { name: 'Table for 10', price: 25000, capacity: 10, type: 'table' },
      table15: { name: 'Table for 15', price: 35000, capacity: 15, type: 'table' }
    };
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

      // Get individual tickets assigned to this user (by user_id OR email)
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
        const payment = await this.paymentService.initializeTransaction(
          purchaserEmail,
          totalAmount,
          {
            purchaserId,
            type: 'ticket_purchase',
            ticketCategory,
            isSingle: true
          }
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
          }))
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
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

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

            const qrCodeUrl = await this.paymentService.generateQRCode(qrData);
            const qrCodeHash = crypto.createHash('md5').update(qrData).digest('hex');

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

              const qrCodeUrl = await this.paymentService.generateQRCode(qrData);
              const qrCodeHash = crypto.createHash('md5').update(qrData).digest('hex');

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

                  
          return res.json({
            success: true,
            message: `${category.name} purchased successfully!`,
            ticketId,
            ticketCategory: category.name, // Add this line
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

  async getMyTickets(req, res) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;

    try {
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
      res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
  }

  async getTicketDetails(req, res) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { ticketId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    try {
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
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      res.json({
        success: true,
        ticket: ticket.rows[0]
      });

    } catch (error) {
      console.error('Get ticket error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
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
               CASE WHEN it.user_id IS NOT NULL THEN true ELSE false END as is_registered
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.is_checked_in = false
        ORDER BY it.created_at DESC
      `);

      res.render('admin/scanner', {
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
}

module.exports = TicketController;