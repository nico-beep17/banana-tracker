-- =============================================
-- ERP Accounting Seed Script: Chart of Accounts
-- =============================================
-- Run this in the Supabase SQL Editor to populate the Chart of Accounts.
-- This will enable the General Journal 'Accounts' dropdown to function.

INSERT INTO public.chart_of_accounts (code, name, type, is_active) VALUES
-- ASSETS
('1010', 'Cash on Hand', 'ASSET', true),
('1020', 'Cash in Bank (PHP)', 'ASSET', true),
('1021', 'Cash in Bank (USD)', 'ASSET', true),
('1100', 'Accounts Receivable - Buyers', 'ASSET', true),
('1110', 'Advances to Growers', 'ASSET', true),
('1200', 'Inventory - Raw Materials', 'ASSET', true),
('1210', 'Inventory - Finished Goods (Bananas)', 'ASSET', true),
('1300', 'Prepaid Expenses', 'ASSET', true),
('1500', 'Property, Plant and Equipment', 'ASSET', true),

-- LIABILITIES
('2010', 'Accounts Payable - Trade', 'LIABILITY', true),
('2020', 'Accounts Payable - Growers', 'LIABILITY', true),
('2100', 'Accrued Expenses Payable', 'LIABILITY', true),
('2200', 'Bank Loans Payable', 'LIABILITY', true),

-- EQUITY
('3010', 'Owners Capital', 'EQUITY', true),
('3020', 'Retained Earnings', 'EQUITY', true),

-- REVENUE
('4010', 'Export Sales - Cavendish', 'REVENUE', true),
('4020', 'Export Sales - Cardava', 'REVENUE', true),
('4100', 'Other Income', 'REVENUE', true),

-- EXPENSES
('5010', 'Cost of Goods Sold - Bananas', 'EXPENSE', true),
('5020', 'Cost of Goods Sold - Packing Materials', 'EXPENSE', true),
('5100', 'Freight, Shipping & Logistics', 'EXPENSE', true),
('5200', 'Salaries & Wages', 'EXPENSE', true),
('5210', 'Rent Expense', 'EXPENSE', true),
('5220', 'Utilities (Power/Water)', 'EXPENSE', true),
('5230', 'Office Supplies', 'EXPENSE', true),
('5240', 'Bank Charges & Forex Loss', 'EXPENSE', true),
('5250', 'Miscellaneous Expense', 'EXPENSE', true)

ON CONFLICT (code) DO NOTHING;
