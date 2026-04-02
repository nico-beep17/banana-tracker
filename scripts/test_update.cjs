const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvecwhgoazibobebfbvo.supabase.co';
const supabaseKey = 'sb_publishable_JfmFfRv9iGZs1cPjhrislA_zh0E62rw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log('Testing Update with ID present in payload...');
    
    // 1. Fetch one consignee
    const { data: consignees, error: fetchErr } = await supabase.from('consignees').select('*').limit(1);
    
    if (fetchErr || consignees.length === 0) {
        console.error('Cannot fetch consignee', fetchErr);
        return;
    }
    
    const consignee = consignees[0];
    
    // 2. Try to update it passing the entire object including id
    const payload = { ...consignee, notes: consignee.notes + ' ' }; // minor change
    
    const { data: updated, error: updateErr } = await supabase
        .from('consignees')
        .update(payload)
        .eq('id', consignee.id)
        .select();
        
    if (updateErr) {
        console.error('❌ Update failed because of payload structure:', updateErr);
    } else {
        console.log('✅ Update succeeded even with ID in payload:', updated);
    }
}

testUpdate();
