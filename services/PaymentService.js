const axios = require('axios');
const QRCode = require('qrcode');

class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.baseUrl = 'https://api.paystack.co';
    
    // Auto-detect environment
    this.isLive = this.secretKey?.startsWith('sk_live_');
    this.environment = this.isLive ? 'LIVE' : 'TEST';
    
    // Live mode needs split code, test mode doesn't
    this.liveSplitCode = process.env.LIVE_TICKET_SPLIT_CODE;
    
    console.log(`🎫 PaymentService initialized in ${this.environment} mode`);
    
    if (this.isLive) {
      console.log(`📋 Using live ticket split code: ${this.liveSplitCode}`);
      if (!this.liveSplitCode) {
        console.warn('⚠️ WARNING: LIVE_TICKET_SPLIT_CODE not configured! Live ticket sales will fail.');
      }
    } else {
      console.log('🧪 Test mode: No split code needed - ticket transactions will be simulated');
    }
  }

  /**
   * Initialize ticket payment with split configuration
   */
  async initializeTransaction(email, amount, metadata = {}) {
    try {
      const payload = {
        email,
        amount: amount * 100,
        metadata: {
          ...metadata,
          payment_type: 'ticket_purchase',
          environment: this.environment
        },
        callback_url: `${process.env.CLIENT_URL}/tickets?verify=1`
      };

      // ✅ ONLY add split_code in LIVE mode
      if (this.isLive) {
        if (!this.liveSplitCode) {
          throw new Error('LIVE_TICKET_SPLIT_CODE is not configured for live ticket sales');
        }
        payload.split_code = this.liveSplitCode;
        console.log('💰 Live ticket transaction with split:', this.liveSplitCode);
      } else {
        console.log('🧪 Test ticket transaction - no split code needed');
      }

      console.log(`📤 ${this.environment} ticket payload:`, JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
      
    } catch (error) {
      console.error(`❌ ${this.environment} ticket payment error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ticket payment initialization failed');
    }
  }

  /**
   * Verify transaction
   */
  async verifyTransaction(reference) {
    try {
      console.log(`🔍 Verifying ${this.environment} ticket payment:`, reference);
      
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      // In test mode, split info will be simulated
      if (!this.isLive) {
        console.log('🧪 Test mode verification - split is simulated');
      }

      return response.data;
      
    } catch (error) {
      console.error(`❌ ${this.environment} ticket verification error:`, error.response?.data || error.message);
      throw new Error('Ticket payment verification failed');
    }
  }

  /**
   * Generate QR code for ticket check-in
   */
  async generateQRCode(text) {
    try {
      const url = await QRCode.toDataURL(text);
      return url;
    } catch (error) {
      console.error('QR code generation error:', error);
      throw new Error('QR code generation failed');
    }
  }

  /**
   * Extract split information from verification response
   */
  getSplitInfo(verificationData) {
    if (verificationData.data?.split) {
      return {
        splitId: verificationData.data.split.id,
        splitCode: verificationData.data.split.split_code,
        // 70% to your main account (Parallel Bank)
        mainShare: verificationData.data.split.shares?.integration / 100 || 0,
        // 30% to Michael (OPay)
        subaccountShares: verificationData.data.split.shares?.subaccounts?.map(share => share / 100) || []
      };
    }
    return null;
  }

  /**
   * Helper to check if we're in test mode
   */
  isTestMode() {
    return !this.isLive;
  }

  /**
   * Helper to get current environment
   */
  getEnvironment() {
    return this.environment;
  }
}

module.exports = PaymentService;