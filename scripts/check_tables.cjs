const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvecwhgoazibobebfbvo.supabase.co';
const supabaseKey = 'sb_publishable_JfmFfRv9iGZs1cPjhrislA_zh0E62rw';
const supabase = createClient(supabaseUrl, supabaseKey);

const allTables = [
    'audit_log',
    'employees',
    'dtr_records',
    'attendance_locations',
    'materials_inventory',
    'material_deliveries',
    'samplings',
    'profiles',
    'weekly_rates',
    'farms',
    'consignee_weekly_rates',
    'consignees',
    'override_audit_logs',
    'arrivals',
    'chart_of_accounts',
    'accounting_periods',
    'journal_entries',
    'journal_lines',
    'containers'
];

async function run() {
    console.log('--- DB TABLE HEALTH & DEAD TABLE ANALYSIS ---');
    console.log('Analyzing tables to find empty/dead tables or connection issues...\n');
    
    const results = [];
    
    for (const table of allTables) {
        try {
            // Use count to get accurate sizing without downloading the whole table
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
                
            if (error) {
                results.push({ table, status: 'ERROR', count: null, message: error.message });
            } else {
                results.push({ table, status: 'OK', count: count || 0 });
            }
        } catch (err) {
            results.push({ table, status: 'EXCEPTION', count: null, message: err.message });
        }
    }
    
    console.table(results);
    
    const deadTables = results.filter(r => r.count === 0 && r.status === 'OK');
    const liveTables = results.filter(r => r.count > 0 && r.status === 'OK');
    const errors = results.filter(r => r.status !== 'OK');
    
    console.log('\n--- ANALYSIS SUMMARY ---');
    console.log(`Live Tables (With Data): ${liveTables.length}`);
    console.log(`Dead/Empty Tables: ${deadTables.length}`);
    if (errors.length > 0) console.log(`Tables with Errors: ${errors.length}`);
    
    if (deadTables.length > 0) {
        console.log('\nPotential Dead Tables (Currently 0 rows):');
        deadTables.forEach(t => console.log(`- ${t.table}`));
    }
}

run();
