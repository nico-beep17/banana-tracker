const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvecwhgoazibobebfbvo.supabase.co';
const supabaseKey = 'sb_publishable_JfmFfRv9iGZs1cPjhrislA_zh0E62rw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUpsertConstraint() {
    console.log('--- CHECKING UNIQUE CONSTRAINTS FOR UPSERT ---');
    
    // 1. Fetch one farm to test with
    const { data: farms, error: fetchErr } = await supabase.from('farms').select('*').limit(1);
    
    if (fetchErr || farms.length === 0) {
        console.error('Cannot fetch farm', fetchErr);
        return;
    }
    
    const farm = farms[0];
    const testPayload = {
        farm_id: farm.id,
        year: 2026,
        week_number: 52, // valid week
        rates_matrix: { 'classA.cla': 100 }
    };
    
    // 2. Perform upsert
    const { data: updated, error: updateErr } = await supabase
        .from('weekly_rates')
        .upsert([testPayload], { onConflict: 'farm_id,year,week_number' })
        .select();
        
    if (updateErr) {
        console.error('❌ Upsert Loophole Detected! details:', updateErr);
    } else {
        console.log('✅ Upsert succeeded, unique constraint exists:', updated);
        
        // cleanup
        await supabase.from('weekly_rates').delete().match({ farm_id: testPayload.farm_id, year: testPayload.year, week_number: testPayload.week_number });
    }
}

checkUpsertConstraint();
