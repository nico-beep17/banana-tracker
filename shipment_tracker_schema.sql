-- Run this in the Supabase SQL Editor to update the containers table for the Shipment Tracker

ALTER TABLE containers
ADD COLUMN IF NOT EXISTS transit_status TEXT DEFAULT 'HUB',
ADD COLUMN IF NOT EXISTS eta TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transit_updated_at TIMESTAMP WITH TIME ZONE;
