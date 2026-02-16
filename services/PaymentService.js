const axios = require('axios');

class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.baseUrl = 'https://api.paystack.co';
  }

  async initializeTransaction(email, amount, metadata = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100,
          metadata,
          callback_url: `${process.env.CLIENT_URL}/payment/verify`
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Payment initialization error:', error.response?.data || error.message);
      throw new Error('Payment initialization failed');
    }
  }

  async verifyTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Payment verification error:', error.response?.data || error.message);
      throw new Error('Payment verification failed');
    }
  }

  async generateQRCode(text) {
    const QRCode = require('qrcode');
    try {
      const url = await QRCode.toDataURL(text);
      return url;
    } catch (error) {
      console.error('QR code generation error:', error);
      throw new Error('QR code generation failed');
    }
  }
}

module.exports = PaymentService;
