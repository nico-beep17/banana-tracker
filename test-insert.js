import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
  const payload = [{
    farmName: "Test Farm",
    farmCode: "TF-01",
    driverName: "John Doe",
    plateNumber: "ABC-1234",
    deliveryReceipt: "DR-0000",
    dateOfPacking: "2026-03-24",
    dateTimeArrive: "2026-03-24T10:00:00",
    brand: "TST",
    ccClass: "A",
    productSpecsCode: "TSTA4HV135",
    quantity: 10,
    id: crypto.randomUUID(),
    batchId: "BATCH-11111111",
    typeId: "classA.rha4",
    dateTimeEncoded: new Date().toISOString(),
  }];

  const { data, error } = await supabase.from('arrivals').insert(payload).select();
  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded:", data);
    // Cleanup
    await supabase.from('arrivals').delete().eq('batchId', 'BATCH-11111111');
  }
}

testInsert();
