const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class ScannerController {

    constructor(socketService) {
    this.socketService = socketService;
  }

  async getScannerPage(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's stats from individual_tickets
      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT t.id) as total_tickets_sold,
          COUNT(DISTINCT it.id) as total_attendees,
          SUM(CASE WHEN DATE(it.checked_in_at) = $1 THEN 1 ELSE 0 END) as checked_in_today,
          COALESCE(SUM(t.total_amount), 0) as total_revenue,
          SUM(CASE WHEN it.ticket_type = 'vvip' THEN 1 ELSE 0 END) as vvip_count,
          SUM(CASE WHEN it.ticket_type = 'vip' THEN 1 ELSE 0 END) as vip_count,
          SUM(CASE WHEN it.ticket_type = 'regular' THEN 1 ELSE 0 END) as regular_count
        FROM tickets t
        JOIN individual_tickets it ON it.parent_ticket_id = t.id
        WHERE DATE(t.created_at) = $1
      `, [today]);

      // Get recent check-ins from scan_logs
      const recentCheckins = await pool.query(`
        SELECT sl.*, it.attendee_name, it.ticket_type, u.username as scanner_name
        FROM scan_logs sl
        JOIN individual_tickets it ON it.id = sl.ticket_id
        JOIN users u ON u.id = sl.scanner_id
        ORDER BY sl.scanned_at DESC
        LIMIT 20
      `);

      // Format stats for template
      const formattedStats = {
        total_scanned_today: parseInt(stats.rows[0]?.checked_in_today || 0),
        unique_attendees: parseInt(stats.rows[0]?.total_attendees || 0),
        vvip_count: parseInt(stats.rows[0]?.vvip_count || 0),
        vip_count: parseInt(stats.rows[0]?.vip_count || 0),
        regular_count: parseInt(stats.rows[0]?.regular_count || 0)
      };

      res.render('scanner', {
        user: req.user,
        stats: formattedStats,
        recentCheckins: recentCheckins.rows,
      });
    } catch (error) {
      console.error('Scanner page error:', error);
      res.status(500).render('error', { error: 'Failed to load scanner' });
    }
  }

  async validateTicket(req, res) {
    const { ticketData } = req.body;
    const scannerId = req.user.id;

    try {
      // Parse ticket data (could be QR code string or ticket ID)
      let ticketInfo;
      try {
        ticketInfo = JSON.parse(ticketData);
      } catch {
        ticketInfo = { ticketId: ticketData };
      }

      const identifier = ticketInfo.ticketId || ticketData;

      // Look up individual ticket
      const ticket = await pool.query(`
        SELECT 
          it.*,
          t.ticket_category,
          t.purchaser_id,
          u.username,
          u.email,
          u.wallet_account
        FROM individual_tickets it
        JOIN tickets t ON t.id = it.parent_ticket_id
        JOIN users u ON u.id = t.purchaser_id
        WHERE it.id = $1 OR it.qr_code_hash = $1 OR it.attendee_email = $1
      `, [identifier]);

      if (ticket.rows.length === 0) {
        return res.json({
          valid: false,
          message: '❌ Ticket not found in system'
        });
      }

      const ticketData_result = ticket.rows[0];

      // Check if already used
      if (ticketData_result.is_checked_in) {
        return res.json({
          valid: false,
          message: `❌ Ticket already used at ${new Date(ticketData_result.checked_in_at).toLocaleString()}`,
          ticket: {
            id: ticketData_result.id,
            type: ticketData_result.ticket_type,
            username: ticketData_result.username,
            attendee_name: ticketData_result.attendee_name
          }
        });
      }

      // Valid ticket
      res.json({
        valid: true,
        message: '✅ Valid ticket',
        ticket: {
          id: ticketData_result.id,
          type: ticketData_result.ticket_type,
          attendee_name: ticketData_result.attendee_name,
          username: ticketData_result.username,
          email: ticketData_result.attendee_email,
          purchased: new Date(ticketData_result.created_at).toLocaleDateString()
        }
      });

    } catch (error) {
      console.error('Ticket validation error:', error);
      res.status(500).json({
        valid: false,
        message: '❌ Error validating ticket'
      });
    }
  }
  
async verifyExternalScan(req, res) {
  try {
    const { ticketId } = req.params;
    const scannerId = req.user.id;

    // Get ticket details
    const ticket = await pool.query(`
      SELECT 
        it.*,
        t.ticket_category,
        u.username as purchaser_name,
        u.email as purchaser_email
      FROM individual_tickets it
      JOIN tickets t ON t.id = it.parent_ticket_id
      JOIN users u ON u.id = t.purchaser_id
      WHERE it.id = $1
    `, [ticketId]);

    if (ticket.rows.length === 0) {
      return res.render('scanner/external-error', { 
        error: 'Ticket not found',
        user: req.user 
      });
    }

    const ticketData = ticket.rows[0];

    // Check if already checked in
    if (ticketData.is_checked_in) {
      return res.render('scanner/external-result', {
        success: false,
        message: 'Ticket already used',
        ticket: ticketData,
        checkedInAt: ticketData.checked_in_at,
        user: req.user
      });
    }

    // Show verification page
    res.render('scanner/external-verify', {
      ticket: ticketData,
      user: req.user
    });

  } catch (error) {
    console.error('External scan error:', error);
    res.render('scanner/external-error', { 
      error: 'Invalid ticket',
      user: req.user 
    });
  }
}

  async scanTicket(req, res) {
    const { ticketId, action } = req.body; // action: 'entry' or 'exit'
    const scannerId = req.user.id;

    try {
      // Start transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Get individual ticket
        const ticket = await client.query(`
          SELECT it.*, t.ticket_category, u.username
          FROM individual_tickets it
          JOIN tickets t ON t.id = it.parent_ticket_id
          JOIN users u ON u.id = t.purchaser_id
          WHERE it.id = $1
          FOR UPDATE
        `, [ticketId]);

        if (ticket.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            message: 'Ticket not found'
          });
        }

        const ticketData = ticket.rows[0];

        // Check if already used
        if (ticketData.is_checked_in) {
          await client.query('ROLLBACK');
          return res.json({
            success: false,
            message: `Ticket already scanned at ${new Date(ticketData.checked_in_at).toLocaleString()}`,
            ticket: {
              id: ticketData.id,
              type: ticketData.ticket_type,
              attendee_name: ticketData.attendee_name
            }
          });
        }

        // Mark as used
        await client.query(`
          UPDATE individual_tickets 
          SET is_checked_in = true, 
              checked_in_at = NOW(),
              checked_in_by = $1
          WHERE id = $2
        `, [scannerId, ticketData.id]);

        // Log scan activity
        await client.query(`
          INSERT INTO scan_logs (id, ticket_id, scanner_id, attendee_name, ticket_type, scanned_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), ticketData.id, scannerId, ticketData.attendee_name, ticketData.ticket_type]);

        // Check if all tickets for this parent are checked in
        const parentCheck = await client.query(`
          SELECT COUNT(*) as total, 
                 SUM(CASE WHEN is_checked_in THEN 1 ELSE 0 END) as checked
          FROM individual_tickets 
          WHERE parent_ticket_id = $1
        `, [ticketData.parent_ticket_id]);

        const { total, checked } = parentCheck.rows[0];

        if (parseInt(checked) === parseInt(total)) {
          await client.query(
            'UPDATE tickets SET is_fully_used = true WHERE id = $1',
            [ticketData.parent_ticket_id]
          );
        }

        await client.query('COMMIT');

         // Emit socket events
      this.socketService.io.emit('tickets_updated', {
        // contestantId,
        // newVotes,
        // voteCount,
        userId:ticketData.user_id
      });

        res.json({
          success: true,
          message: `✅ ${ticketData.ticket_type.toUpperCase()} ticket for ${ticketData.attendee_name} validated successfully`,
          ticket: {
            id: ticketData.id,
            type: ticketData.ticket_type,
            attendee_name: ticketData.attendee_name,
            scannedAt: new Date().toLocaleTimeString()
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Scan error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing scan'
      });
    }
  }

  async getScanHistory(req, res) {
    try {
      const { date } = req.query;
      
      let query = `
        SELECT sl.*, it.ticket_type, it.attendee_name, 
               u.username as scanner_name
        FROM scan_logs sl
        JOIN individual_tickets it ON it.id = sl.ticket_id
        JOIN users u ON u.id = sl.scanner_id
      `;
      
      const params = [];
      
      if (date) {
        query += ` WHERE DATE(sl.scanned_at) = $1`;
        params.push(date);
      }
      
      query += ` ORDER BY sl.scanned_at DESC LIMIT 100`;

      const history = await pool.query(query, params);

      res.json({
        success: true,
        scans: history.rows
      });

    } catch (error) {
      console.error('Scan history error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching scan history'
      });
    }
  }

  async getStats(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_scanned_today,
          COUNT(DISTINCT parent_ticket_id) as unique_attendees,
          SUM(CASE WHEN ticket_type = 'vvip' THEN 1 ELSE 0 END) as vvip_count,
          SUM(CASE WHEN ticket_type = 'vip' THEN 1 ELSE 0 END) as vip_count,
          SUM(CASE WHEN ticket_type = 'regular' THEN 1 ELSE 0 END) as regular_count
        FROM individual_tickets 
        WHERE DATE(checked_in_at) = $1 AND is_checked_in = true
      `, [today]);

      res.json({
        success: true,
        stats: stats.rows[0] || {
          total_scanned_today: 0,
          unique_attendees: 0,
          vvip_count: 0,
          vip_count: 0,
          regular_count: 0
        }
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ success: false });
    }
  }
}

module.exports = ScannerController;