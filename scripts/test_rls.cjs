const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvecwhgoazibobebfbvo.supabase.co';
const supabaseKey = 'sb_publishable_JfmFfRv9iGZs1cPjhrislA_zh0E62rw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLS() {
    console.log('Testing RLS Bypass...');
    // Try to update a non-existent record or just do a generic query 
    // Wait, the best way to check is to try inserted a dummy row into 'consignees' and see if it returns data.
    const { data: insertData, error: insertError } = await supabase
        .from('consignees')
        .insert([{ company_name: 'RLS_TEST_DUMMY', contact_person: 'Test' }])
        .select();

    if (insertError) {
        console.error('Insert Error:', insertError);
    } else {
        console.log('Inserted Data (if empty, RLS is still blocking):', insertData);
        // Clean up
        if (insertData && insertData.length > 0) {
            const { data: delData, error: delError } = await supabase
                .from('consignees')
                .delete()
                .eq('id', insertData[0].id)
                .select();
            console.log('Cleanup Delete:', delData ? 'Success' : delError);
        }
    }
}

testRLS();
