-- =============================================
-- Consignee Module: Supabase Migration
-- =============================================

-- 1. Consignees Registry
CREATE TABLE IF NOT EXISTS consignees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    country TEXT,
    default_port TEXT,
    payment_terms TEXT DEFAULT 'TT',
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    preferred_banana_types JSONB DEFAULT '[]'::jsonb,
    sgrt_tolerance TEXT DEFAULT '3%',
    spec_piw TEXT,
    spec_packaging TEXT,
    spec_requirement TEXT,
    spec_temperature TEXT,
    spec_ventilation TEXT,
    payment_percentage NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    last_modified TIMESTAMPTZ DEFAULT now()
);

-- Safely add new columns in case the table already exists
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS preferred_banana_types JSONB DEFAULT '[]'::jsonb;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS sgrt_tolerance TEXT DEFAULT '3%';
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS spec_piw TEXT;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS spec_packaging TEXT;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS spec_requirement TEXT;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS spec_temperature TEXT;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS spec_ventilation TEXT;
ALTER TABLE consignees ADD COLUMN IF NOT EXISTS payment_percentage NUMERIC(5,2);

-- 2. Consignee Weekly Buying Rates (temporal pricing)
CREATE TABLE IF NOT EXISTS consignee_weekly_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consignee_id UUID NOT NULL REFERENCES consignees(id) ON DELETE CASCADE,
    year INT NOT NULL,
    week_number INT NOT NULL,
    rates_matrix JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (consignee_id, year, week_number)
);

-- 3. RLS policies (optional, match your existing pattern)
ALTER TABLE consignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignee_weekly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON consignees
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON consignee_weekly_rates
    FOR ALL USING (auth.role() = 'authenticated');

-- Additional policy for development / Skip Login mode
CREATE POLICY "Allow all for anon users setup" ON consignees
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users rates setup" ON consignee_weekly_rates
    FOR ALL USING (true) WITH CHECK (true);
