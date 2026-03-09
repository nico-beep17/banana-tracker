-- ERP Accounting Schema (Phase 12)
-- Double-Entry Bookkeeping and Multi-Currency System

-- 1. Chart of Accounts
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., '1010', '2010', '5010'
    name VARCHAR(255) NOT NULL,       -- e.g., 'Cash in Bank', 'Accounts Payable - Growers'
    type VARCHAR(50) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: Balances are calculated dynamically from Journal Lines to ensure absolute double-entry integrity.

-- 2. Journal Entries (Headers)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'JV-2026-0001', 'PV-2026-0050'
    date_posted DATE NOT NULL,
    description TEXT,
    currency VARCHAR(10) DEFAULT 'PHP' CHECK (currency IN ('PHP', 'USD')),
    exchange_rate NUMERIC(15, 4) DEFAULT 1.0000,
    created_by UUID, -- References auth.users (Optional for now)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Journal Lines (Details - The core of Double Entry)
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.chart_of_accounts(id),
    debit_amount NUMERIC(15, 2) DEFAULT 0.00,
    credit_amount NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    -- Constraint to ensure a line is either a debit OR a credit, not both simultaneously on the same line (though mathematically possible, this is cleaner for UI/reporting)
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0) OR (debit_amount = 0 AND credit_amount = 0)) 
);

-- 4. Vouchers (UI Workflow wrappers around Journal Entries)
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('PAYABLE', 'PAYMENT', 'CASH_RECEIPT', 'JOURNAL')),
    voucher_no VARCHAR(100) UNIQUE NOT NULL,
    entity_id VARCHAR(255), -- Can refer to a Farm (Grower) or a Buyer depending on context (Mock farms use '1', '2')
    entry_id UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    currency VARCHAR(10) DEFAULT 'PHP' CHECK (currency IN ('PHP', 'USD')),
    exchange_rate NUMERIC(15, 4) DEFAULT 1.0000, -- e.g., 56.50 for USD -> PHP
    total_amount NUMERIC(15, 2) NOT NULL, -- The total in the source currency 
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'VOIDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Inventory Valuations (Periodic snapshots)
CREATE TABLE IF NOT EXISTS public.inventory_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    valuation_date DATE UNIQUE NOT NULL,
    total_value_php NUMERIC(15, 2) NOT NULL,
    total_stock_count INTEGER NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

    
-- =========================================================================
-- PATCHES FOR EXISTING TABLES
-- =========================================================================
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PHP' CHECK (currency IN ('PHP', 'USD')),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 4) DEFAULT 1.0000;

ALTER TABLE public.vouchers 
ALTER COLUMN entity_id TYPE VARCHAR(255);

-- =========================================================================
-- DEBUG RLS PERMISSIONS (For Dev/Bypass Mode)
-- =========================================================================
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Allow 'anon' role to insert items so the "Skip Login" UI works in development
CREATE POLICY "Allow anon select to chart_of_accounts" ON public.chart_of_accounts FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert to journal_entries" ON public.journal_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select to journal_entries" ON public.journal_entries FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update to journal_entries" ON public.journal_entries FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon insert to journal_lines" ON public.journal_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select to journal_lines" ON public.journal_lines FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update to journal_lines" ON public.journal_lines FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon insert to vouchers" ON public.vouchers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select to vouchers" ON public.vouchers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update to vouchers" ON public.vouchers FOR UPDATE TO anon USING (true);


-- =========================================================================
-- PHASE 13: ACCOUNTING PERIODS & PAYROLL MODULE
-- =========================================================================

-- Accounting Enhancements
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name VARCHAR(50) NOT NULL, -- e.g., 'Jan-2026', 'Q1-2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_by UUID,
    closed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to accounting_periods" ON public.accounting_periods FOR ALL TO anon USING (true) WITH CHECK (true);

-- Payroll System Database Schema
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    role VARCHAR(100),
    employment_status VARCHAR(50) DEFAULT 'ACTIVE',
    basic_rate NUMERIC(15, 2) DEFAULT 0.00,
    rate_type VARCHAR(20) DEFAULT 'DAILY' CHECK (rate_type IN ('DAILY', 'MONTHLY')),
    bank_account_no VARCHAR(50),
    sss_no VARCHAR(50),
    phic_no VARCHAR(50),
    hdmf_no VARCHAR(50),
    tin_no VARCHAR(50)
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to employees" ON public.employees FOR ALL TO anon USING (true) WITH CHECK (true);

-- Attendance & Geofencing
CREATE TABLE IF NOT EXISTS public.attendance_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    radius_meters INTEGER DEFAULT 100
);

ALTER TABLE public.attendance_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to attendance_locations" ON public.attendance_locations FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.dtr_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    record_date DATE NOT NULL,
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    regular_hours NUMERIC(4, 2) DEFAULT 0,
    overtime_hours NUMERIC(4, 2) DEFAULT 0,
    latitude_in NUMERIC(10, 8),
    longitude_in NUMERIC(11, 8),
    latitude_out NUMERIC(10, 8),
    longitude_out NUMERIC(11, 8),
    location_id_in UUID REFERENCES public.attendance_locations(id),
    location_id_out UUID REFERENCES public.attendance_locations(id),
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY', 'OUTSIDE_GEOFENCE')),
    UNIQUE(employee_id, record_date)
);

ALTER TABLE public.dtr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to dtr_records" ON public.dtr_records FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payroll_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'POSTED_TO_GL')),
    total_gross NUMERIC(15, 2) DEFAULT 0.00,
    total_deductions NUMERIC(15, 2) DEFAULT 0.00,
    total_net NUMERIC(15, 2) DEFAULT 0.00
);

ALTER TABLE public.payroll_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to payroll_registers" ON public.payroll_registers FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_id UUID REFERENCES public.payroll_registers(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id),
    gross_pay NUMERIC(15, 2) DEFAULT 0.00,
    sss_deduction NUMERIC(15, 2) DEFAULT 0.00,
    phic_deduction NUMERIC(15, 2) DEFAULT 0.00,
    hdmf_deduction NUMERIC(15, 2) DEFAULT 0.00,
    tax_deduction NUMERIC(15, 2) DEFAULT 0.00,
    other_deductions NUMERIC(15, 2) DEFAULT 0.00,
    net_pay NUMERIC(15, 2) DEFAULT 0.00
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all to payslips" ON public.payslips FOR ALL TO anon USING (true) WITH CHECK (true);
