-- Create consignees table
CREATE TABLE IF NOT EXISTS public.consignees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    country text,
    default_port text,
    payment_terms text DEFAULT 'TT',
    currency text DEFAULT 'USD',
    status text DEFAULT 'ACTIVE',
    notes text,
    preferred_banana_types jsonb DEFAULT '[]'::jsonb,
    sgrt_tolerance text DEFAULT '3%',
    spec_piw text,
    spec_packaging text,
    spec_requirement text,
    spec_temperature text,
    spec_ventilation text,
    payment_percentage text,
    last_modified timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Create consignee_weekly_rates table
CREATE TABLE IF NOT EXISTS public.consignee_weekly_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    consignee_id uuid REFERENCES public.consignees(id) ON DELETE CASCADE,
    year integer NOT NULL,
    week_number integer NOT NULL,
    rates_matrix jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(consignee_id, year, week_number)
);

-- Enable RLS
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignee_weekly_rates ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all for authenticated and anon users)
DROP POLICY IF EXISTS "Allow all on consignees" ON public.consignees;
CREATE POLICY "Allow all on consignees" ON public.consignees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on consignee_weekly_rates" ON public.consignee_weekly_rates;
CREATE POLICY "Allow all on consignee_weekly_rates" ON public.consignee_weekly_rates FOR ALL USING (true) WITH CHECK (true);
