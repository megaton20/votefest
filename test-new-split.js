const axios = require('axios');
require('dotenv').config();

// Replace this with the new split code from Step 2
const NEW_SPLIT_CODE = 'SPL_xxxxxx'; // ← Put your new code here

async function testNewSplit() {
    console.log('Testing split code:', NEW_SPLIT_CODE);
    
    try {
        // Test 1: Fetch split details
        const response = await axios.get(
            `https://api.paystack.co/split/${NEW_SPLIT_CODE}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Split is valid!');
        console.log('Split name:', response.data.data.name);
        console.log('Active:', response.data.data.active);
        console.log('Subaccounts:', response.data.data.subaccounts.length);
        
        // Test 2: Try to initialize a test transaction
        console.log('\n📝 Testing transaction initialization...');
        
        const initResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: 'test@example.com',
                amount: 500000, // ₦5,000 in kobo
                split_code: NEW_SPLIT_CODE,
                callback_url: 'http://localhost:5000/test'
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Transaction initialization successful!');
        console.log('Authorization URL:', initResponse.data.data.authorization_url);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testNewSplit();