-- Employee CV / My Profile table
-- Stores employee curriculum vitae data as JSONB for flexibility
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS employee_cv (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    cv_data JSONB DEFAULT '{}'::jsonb,
    completion_pct INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE employee_cv ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own CV
CREATE POLICY "Users can view own CV" ON employee_cv
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CV" ON employee_cv
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CV" ON employee_cv
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins can read all CVs (for HR purposes)
CREATE POLICY "Admins can view all CVs" ON employee_cv
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('Administrator', 'Admin / Developer', 'HR Manager')
        )
    );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_employee_cv_user_id ON employee_cv(user_id);

-- Grant access
GRANT ALL ON employee_cv TO authenticated;
