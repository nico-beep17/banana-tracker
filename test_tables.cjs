const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Test with SERVICE ROLE key
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
// Test with ANON key (what the app uses)
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function test() {
    console.log('=== Testing with SERVICE ROLE key ===');
    const { data: d1, error: e1 } = await supabaseAdmin.from('employees').select('*');
    console.log('employees:', d1 ? `${d1.length} rows` : 'null', e1 ? `ERROR: ${e1.message}` : 'OK');

    console.log('\n=== Testing with ANON key (what the app uses) ===');
    const { data: d2, error: e2 } = await supabaseAnon.from('employees').select('*');
    console.log('employees:', d2 ? `${d2.length} rows` : 'null', e2 ? `ERROR: ${e2.message}` : 'OK');

    const { data: d3, error: e3 } = await supabaseAnon.from('dtr_records').select('*');
    console.log('dtr_records:', d3 ? `${d3.length} rows` : 'null', e3 ? `ERROR: ${e3.message}` : 'OK');

    const { data: d4, error: e4 } = await supabaseAnon.from('attendance_locations').select('*');
    console.log('attendance_locations:', d4 ? `${d4.length} rows` : 'null', e4 ? `ERROR: ${e4.message}` : 'OK');

    const { data: d5, error: e5 } = await supabaseAnon.from('accounting_periods').select('*');
    console.log('accounting_periods:', d5 ? `${d5.length} rows` : 'null', e5 ? `ERROR: ${e5.message}` : 'OK');
}

test().catch(console.error);
