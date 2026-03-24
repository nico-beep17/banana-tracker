-- Run this inside the Supabase SQL Editor to enable true cloud syncing for the Materials Inventory Deliveries!

CREATE TABLE IF NOT EXISTS material_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TEXT NOT NULL,
    "farmCode" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    "referenceNo" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE material_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read material_deliveries" 
ON material_deliveries FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert material_deliveries" 
ON material_deliveries FOR INSERT 
TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated update material_deliveries" 
ON material_deliveries FOR UPDATE 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete material_deliveries" 
ON material_deliveries FOR DELETE 
TO authenticated USING (true);
