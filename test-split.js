const axios = require('axios');
require('dotenv').config();

async function testSplitCode() {
    const splitCode = 'SPL_nKL99WmTn4';
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    console.log('🔍 Testing Split Code:', splitCode);
    console.log('Using Secret Key:', secretKey ? '✓ Loaded' : '✗ Missing');
    
    try {
        // Test 1: Fetch split details
        console.log('\n📡 Fetching split details...');
        const splitResponse = await axios.get(
            `https://api.paystack.co/split/${splitCode}`,
            {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Split found!');
        console.log('Split Details:', JSON.stringify(splitResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error fetching split:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 The split code does not exist in your integration');
            console.log('Possible reasons:');
            console.log('1. Split code is from a different environment (test vs live)');
            console.log('2. Split code has been deleted');
            console.log('3. Typo in the split code');
        }
    }
    
    // Test 2: Try to initialize a transaction with the split
    console.log('\n📡 Testing transaction initialization with split...');
    try {
        const initResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: 'test@example.com',
                amount: 10000, // ₦100 in kobo
                split_code: splitCode,
                callback_url: 'http://localhost:5000/test'
            },
            {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Transaction initialization successful!');
        console.log('Response:', JSON.stringify(initResponse.data, null, 2));
    } catch (error) {
        console.error('❌ Transaction initialization failed:', error.response?.data || error.message);
    }
}

testSplitCode();