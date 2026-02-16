class PaystackService {
    constructor() {
        this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    }

    initializePayment(email, amount, metadata = {}) {
        return new Promise((resolve, reject) => {
            // Check if Paystack is loaded
            if (typeof PaystackPop === 'undefined') {
                console.error('PaystackPop is not loaded');
                reject(new Error('Payment gateway not loaded. Please refresh the page.'));
                return;
            }

            try {
                const handler = PaystackPop.setup({
                    key: this.publicKey,
                    email: email,
                    amount: amount * 100, // Convert to kobo
                    currency: 'NGN',
                    metadata: {
                        ...metadata,
                        custom_fields: [
                            {
                                display_name: "Payment Type",
                                variable_name: "payment_type",
                                value: metadata.type || "wallet_funding"
                            }
                        ]
                    },
                    callback: (response) => {
                        // Verify payment on server
                        this.verifyPayment(response.reference)
                            .then(verification => {
                                resolve({
                                    success: true,
                                    reference: response.reference,
                                    verification
                                });
                            })
                            .catch(error => {
                                reject(error);
                            });
                    },
                    onClose: () => {
                        reject(new Error('Payment window closed'));
                    }
                });
                
                handler.openIframe();
            } catch (error) {
                console.error('Paystack initialization error:', error);
                reject(new Error('Failed to initialize payment'));
            }
        });
    }

    async verifyPayment(reference) {
        try {
            const axios = require('axios');
            const response = await axios.get(
                `https://api.paystack.co/transaction/verify/${reference}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Payment verification error:', error.response?.data || error.message);
            throw new Error('Payment verification failed');
        }
    }

    async initializeServerTransaction(email, amount, metadata = {}) {
        try {
            const axios = require('axios');
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    email,
                    amount: amount * 100,
                    metadata,
                    callback_url: `${process.env.CLIENT_URL}/wallet/verify`
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
            console.error('Server payment initialization error:', error.response?.data || error.message);
            throw new Error('Payment initialization failed');
        }
    }
}

module.exports = PaystackService;