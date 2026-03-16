const axios = require('axios');
require('dotenv').config();

async function getSubaccounts() {
    try {
        const response = await axios.get(
            'https://api.paystack.co/subaccount',
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('📋 Your Subaccounts:\n');
        
        if (response.data.data.length === 0) {
            console.log('No subaccounts found. You need to create one first.');
            return;
        }
        
        response.data.data.forEach((sub, index) => {
            console.log(`${index + 1}. ${sub.business_name}`);
            console.log(`   Code: ${sub.subaccount_code}`);
            console.log(`   Account: ${sub.account_number} (${sub.settlement_bank})`);
            console.log(`   Status: ${sub.is_verified ? '✅ Verified' : '❌ Unverified'}`);
            console.log(`   Percentage: ${sub.percentage_charge}%\n`);
        });
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

getSubaccounts();