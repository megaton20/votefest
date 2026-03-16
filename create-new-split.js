 const axios = require('axios');
require('dotenv').config();

async function createNewSplit() {
    try {
        // First, get Michael's subaccount code
        const subaccountsResponse = await axios.get(
            'https://api.paystack.co/subaccount',
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // Find Michael's subaccount (30% share)
        const michaelSubaccount = subaccountsResponse.data.data.find(sub => 
            sub.account_number === '9160209475' || 
            sub.business_name?.includes('MICHAEL')
        );
        
        if (!michaelSubaccount) {
            console.log('❌ Could not find Michael\'s subaccount');
            console.log('Available subaccounts:', subaccountsResponse.data.data.map(s => s.business_name));
            return;
        }
        
        console.log('✅ Found Michael\'s subaccount:');
        console.log('   Code:', michaelSubaccount.subaccount_code);
        console.log('   Verified:', michaelSubaccount.is_verified);
        console.log('   Default %:', michaelSubaccount.percentage_charge);
        
        // Create the split
        // IMPORTANT: The main account (Parallel Bank) does NOT need to be in subaccounts array
        // Paystack automatically gives the remainder to your main account
        const splitData = {
            name: 'TCQ - Mega Essentials 70/30 Split',
            type: 'percentage',
            currency: 'NGN',
            subaccounts: [
                {
                    subaccount: michaelSubaccount.subaccount_code,
                    share: 30  // Michael gets 30%
                }
                // Your main account (Parallel Bank) automatically gets the remaining 70%
            ],
            bearer_type: 'all-proportional'
        };
        
        console.log('\n📝 Creating split with:');
        console.log(JSON.stringify(splitData, null, 2));
        
        const response = await axios.post(
            'https://api.paystack.co/split',
            splitData,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\n✅ SPLIT CREATED SUCCESSFULLY!');
        console.log('====================================');
        console.log('Split Code:', response.data.data.split_code);
        console.log('Split Name:', response.data.data.name);
        console.log('Active:', response.data.data.active);
        console.log('====================================');
        console.log('\n📝 Add this to your .env file:');
        console.log(`WALLET_SPLIT_CODE=${response.data.data.split_code}`);
        console.log(`TICKET_SPLIT_CODE=${response.data.data.split_code}`);
        
    } catch (error) {
        console.error('❌ Error creating split:', error.response?.data || error.message);
        
        if (error.response?.data) {
            console.log('\n🔍 Error details:', error.response.data);
        }
    }
}

createNewSplit();