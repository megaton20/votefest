const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class ScannerController {
  async getScannerPage(req, res) {
    try {
      // Get today's scan stats
      const today = new Date().toISOString().split('T')[0];
      
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_scanned_today,
          COUNT(DISTINCT user_id) as unique_attendees,
          SUM(CASE WHEN ticket_type = 'vvip' THEN 1 ELSE 0 END) as vvip_count,
          SUM(CASE WHEN ticket_type = 'vip' THEN 1 ELSE 0 END) as vip_count,
          SUM(CASE WHEN ticket_type = 'regular' THEN 1 ELSE 0 END) as regular_count
        FROM tickets 
        WHERE DATE(used_at) = $1 AND is_used = true
      `, [today]);

      // Get recent scans
      const recentScans = await pool.query(`
        SELECT t.*, u.username, u.email 
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.is_used = true
        ORDER BY t.used_at DESC
        LIMIT 20
      `);

      // Get all valid tickets (not used)
      const validTickets = await pool.query(`
        SELECT t.*, u.username, u.email 
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.is_used = false
        ORDER BY t.created_at DESC
      `);

      res.render('scanner', {
        user: req.user,
        stats: stats.rows[0] || {
          total_scanned_today: 0,
          unique_attendees: 0,
          vvip_count: 0,
          vip_count: 0,
          regular_count: 0
        },
        recentScans: recentScans.rows,
        validTickets: validTickets.rows
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

      const ticketId = ticketInfo.ticketId || ticketData;

      // Look up ticket
      const ticket = await pool.query(`
        SELECT t.*, u.username, u.email, u.wallet_account
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.paystack_reference = $1 OR t.id = $1
      `, [ticketId]);

      if (ticket.rows.length === 0) {
        return res.json({
          valid: false,
          message: '❌ Ticket not found in system'
        });
      }

      const ticketData_result = ticket.rows[0];

      // Check if already used
      if (ticketData_result.is_used) {
        return res.json({
          valid: false,
          message: `❌ Ticket already used at ${new Date(ticketData_result.used_at).toLocaleString()}`,
          ticket: ticketData_result
        });
      }

      // Check if ticket is expired (optional - if event has date)
      const eventDate = new Date('2024-12-31'); // Set your event date
      if (new Date() > eventDate) {
        return res.json({
          valid: false,
          message: '❌ Event has already ended',
          ticket: ticketData_result
        });
      }

      // Valid ticket
      res.json({
        valid: true,
        message: '✅ Valid ticket',
        ticket: {
          id: ticketData_result.id,
          type: ticketData_result.ticket_type,
          amount: ticketData_result.amount,
          username: ticketData_result.username,
          email: ticketData_result.email,
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

  async scanTicket(req, res) {
    const { ticketId, action } = req.body; // action: 'entry' or 'exit'
    const scannerId = req.user.id;

    try {
      // Start transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Get ticket
        const ticket = await client.query(`
          SELECT t.*, u.username 
          FROM tickets t
          JOIN users u ON u.id = t.user_id
          WHERE t.paystack_reference = $1 OR t.id = $1
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
        if (ticketData.is_used) {
          await client.query('ROLLBACK');
          return res.json({
            success: false,
            message: `Ticket already scanned at ${new Date(ticketData.used_at).toLocaleString()}`,
            ticket: ticketData
          });
        }

        // Mark as used
        await client.query(`
          UPDATE tickets 
          SET is_used = true, 
              used_at = NOW(),
              scanned_by = $1,
              scan_action = $2
          WHERE id = $3
        `, [scannerId, action || 'entry', ticketData.id]);

        // Log scan activity
        await client.query(`
          INSERT INTO scan_logs (id, ticket_id, scanner_id, action, scanned_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [uuidv4(), ticketData.id, scannerId, action || 'entry']);

        await client.query('COMMIT');

        res.json({
          success: true,
          message: `✅ ${ticketData.ticket_type.toUpperCase()} ticket for ${ticketData.username} validated successfully`,
          ticket: {
            id: ticketData.id,
            type: ticketData.ticket_type,
            username: ticketData.username,
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
        SELECT sl.*, t.ticket_type, t.amount, u.username as ticket_owner, 
               sc.username as scanner_name
        FROM scan_logs sl
        JOIN tickets t ON t.id = sl.ticket_id
        JOIN users u ON u.id = t.user_id
        JOIN users sc ON sc.id = sl.scanner_id
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
        COUNT(DISTINCT user_id) as unique_attendees,
        SUM(CASE WHEN ticket_type = 'vvip' THEN 1 ELSE 0 END) as vvip_count,
        SUM(CASE WHEN ticket_type = 'vip' THEN 1 ELSE 0 END) as vip_count
      FROM tickets 
      WHERE DATE(used_at) = $1 AND is_used = true
    `, [today]);

    res.json({
      success: true,
      stats: stats.rows[0] || {
        total_scanned_today: 0,
        unique_attendees: 0,
        vvip_count: 0,
        vip_count: 0
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false });
  }
}


}

module.exports = ScannerController;