const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvecwhgoazibobebfbvo.supabase.co';
// Using the actual Anon key used by the application frontend
const supabaseKey = 'sb_publishable_JfmFfRv9iGZs1cPjhrislA_zh0E62rw';
const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToCheck = [
    'profiles',
    'consignees',
    'consignee_weekly_rates',
    'containers',
    'arrivals',
    'samplings',
    'farms',
    'weekly_rates',
    'accounting_periods',
    'chart_of_accounts',
    'journal_entries'
];

async function checkConnections() {
    console.log('--- STARTING COMPREHENSIVE RLS CONNECTION CHECK ---');
    console.log('Connecting via App Anon Key (simulating frontend)...\n');

    let allPassed = true;

    for (const table of tablesToCheck) {
        try {
            // First, check basic SELECT access
            const { data, error } = await supabase.from(table).select('id').limit(1);
            
            if (error) {
                console.error(`❌ [${table}]: READ FAILED - ${error.message}`);
                allPassed = false;
                continue;
            }
            
            console.log(`✅ [${table}]: READ connection successful. Data visible: ${data.length > 0 ? 'Yes' : 'No (table empty)'}`);

        } catch (err) {
            console.error(`❌ [${table}]: Unexpected connection error -`, err.message);
            allPassed = false;
        }
    }

    console.log('\n--- CONNECTION CHECK SUMMARY ---');
    if (allPassed) {
        console.log('🟢 ALL TABLES CONNECTED SUCCESSFULLY. RLS is allowing access.');
    } else {
        console.log('🔴 SOME TABLES FAILED SECURE CONNECTION. Check errors above.');
    }
}

checkConnections();
