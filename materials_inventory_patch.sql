-- Materials Inventory Schema
CREATE TABLE IF NOT EXISTS public.materials_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    supplier_details TEXT,
    pricing_details TEXT,
    stock_in INTEGER DEFAULT 0,
    stock_out INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.materials_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on materials_inventory" ON public.materials_inventory;
CREATE POLICY "Allow anon all on materials_inventory" ON public.materials_inventory FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed Initial Data
INSERT INTO public.materials_inventory (item_code, item_name, supplier_details, pricing_details, stock_in, stock_out) VALUES
('0001', 'LFJ BOX COVER WHITE 13kg', 'Default Supplier', '0.00', 0, 0),
('0002', 'LFJ BOX COVER BROWN 13kg', 'Default Supplier', '0.00', 0, 0),
('0003', 'LFJ BODY BOX 13kg', 'Default Supplier', '0.00', 0, 0),
('0004', 'LFJ LABEL', 'Default Supplier', '0.00', 0, 0),
('0005', 'PADS', 'Default Supplier', '0.00', 0, 0),
('0006', 'P.E FOAM 12x18', 'Default Supplier', '0.00', 0, 0),
('0007', 'VACCUMBAG 13kg', 'Default Supplier', '0.00', 0, 0),
('0008', 'ETHYLENE ABSORBER', 'Default Supplier', '0.00', 0, 0),
('0009', 'RUBBER BAND', 'Default Supplier', '0.00', 0, 0),
('0010', 'GLUE ADHESIVE', 'Default Supplier', '0.00', 0, 0)
ON CONFLICT (item_code) DO NOTHING;
