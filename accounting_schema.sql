-- Accounting & Billing Module Schema Update

-- 1. Snapshot Rates on Arrivals
-- This ensures that historical accounting data doesn't change when a farm updates its contract rate.
ALTER TABLE public.arrivals
ADD COLUMN IF NOT EXISTS locked_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;

-- Remove the static rates matrix from Farms as pricing is now temporal (Weekly)
ALTER TABLE public.farms
DROP COLUMN IF EXISTS rates_matrix;

-- Create Weekly Rates Table
CREATE TABLE IF NOT EXISTS public.weekly_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id),
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    rates_matrix JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(farm_id, year, week_number)
);

-- 2. Grower Payables Table
-- Tracks how much money is owed to each farm based on Approved Arrivals minus Rejected Sampling
CREATE TABLE IF NOT EXISTS public.grower_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arrival_id UUID REFERENCES public.arrivals(id),
    farm_code TEXT,
    gross_amount NUMERIC DEFAULT 0,
    deductions_total NUMERIC DEFAULT 0,
    net_amount_due NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    payment_reference TEXT,
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: We can either manage the payables manually or via trigger. 
-- Since we are doing logic in React, we don't strictly need a Postgres function, 
-- but creating the table is required.

-- 3. Buyer & Receivables Tracking (Revenue)
-- Tracks how much money a buyer owes for a specific shipment directly on the container record.
ALTER TABLE public.containers
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS agreed_rate NUMERIC DEFAULT 0, -- Weekly fluctuating rate applied per box
ADD COLUMN IF NOT EXISTS amount_paid_partial NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS receivables_status TEXT DEFAULT 'UNPAID'; -- UNPAID, PARTIAL, FULLY_PAID
