const axios = require('axios');

class PaystackService {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
        this.baseUrl = 'https://api.paystack.co';
        
        // Auto-detect environment
        this.isLive = this.secretKey?.startsWith('sk_live_');
        this.environment = this.isLive ? 'LIVE' : 'TEST';
        
        // Live mode needs split code, test mode doesn't
        this.liveSplitCode = process.env.LIVE_SPLIT_CODE;
        
        console.log(`PaystackService initialized in ${this.environment} mode`);
        
        if (this.isLive) {
            console.log(`Using live split code: ${this.liveSplitCode}`);
            if (!this.liveSplitCode) {
                console.warn('WARNING: LIVE_SPLIT_CODE not configured! Live transactions will fail.');
            }
        } else {
            console.log('Test mode: No split code needed - transactions will be simulated');
        }
    }

    // ============= WALLET FUNDING =============
    async initializeWalletTransaction(email, amount, metadata = {}) {
        try {
            const payload = {
                email,
                amount: amount * 100,
                metadata: {
                    ...metadata,
                    payment_type: 'wallet_funding',
                    environment: this.environment
                },
                callback_url: `${process.env.CLIENT_URL}/wallet/verify`
            };

            // ONLY add split_code in LIVE mode
            if (this.isLive) {
                if (!this.liveSplitCode) {
                    throw new Error('LIVE_SPLIT_CODE is not configured for live transactions');
                }
                payload.split_code = this.liveSplitCode;
                console.log('Live transaction with split:');
            } else {
                console.log('Test transaction - no split code needed');
            }


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
            console.error(`${this.environment} payment error:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Payment initialization failed');
        }
    }

    // ============= VERIFY PAYMENT =============
    async verifyPayment(reference) {
        try {
            console.log(`Verifying ${this.environment} payment:`, reference);
            
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
                console.log('Test mode verification - split is simulated');
            }

            return response.data;
        } catch (error) {
            console.error(`${this.environment} verification error:`, error.response?.data || error.message);
            throw new Error('Payment verification failed');
        }
    }

    // ============= CLIENT-SIDE PAYMENT =============
    initializePayment(email, amount, metadata = {}) {
        return new Promise((resolve, reject) => {
            if (typeof PaystackPop === 'undefined') {
                console.error('PaystackPop is not loaded');
                reject(new Error('Payment gateway not loaded. Please refresh the page.'));
                return;
            }

            try {
                const handler = PaystackPop.setup({
                    key: this.publicKey,
                    email: email,
                    amount: amount * 100,
                    currency: 'NGN',
                    metadata: {
                        ...metadata,
                        environment: this.environment,
                        custom_fields: [
                            {
                                display_name: "Payment Type",
                                variable_name: "payment_type",
                                value: metadata.type || "wallet_funding"
                            }
                        ]
                    },
                    callback: (response) => {
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

    // Helper to check if we're in test mode
    isTestMode() {
        return !this.isLive;
    }

    // Helper to get current environment
    getEnvironment() {
        return this.environment;
    }
}

module.exports = PaystackService;