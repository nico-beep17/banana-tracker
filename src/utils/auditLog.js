import { supabase } from '../supabaseClient';

/**
 * Audit Log — Logs key user actions for accountability.
 * Falls back to localStorage if Supabase table doesn't exist.
 * 
 * To enable server-side logging, create this table in Supabase SQL Editor:
 * 
 *   CREATE TABLE IF NOT EXISTS audit_log (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id UUID REFERENCES auth.users(id),
 *     user_email TEXT,
 *     action TEXT NOT NULL,
 *     target_type TEXT,
 *     target_id TEXT,
 *     details JSONB DEFAULT '{}',
 *     ip_address TEXT,
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *   
 *   ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Admins can read audit log" ON audit_log FOR SELECT
 *     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin / Developer'));
 *   CREATE POLICY "Any auth user can insert" ON audit_log FOR INSERT
 *     WITH CHECK (auth.uid() = user_id);
 */

const LOG_STORAGE_KEY = 'lavc_audit_log';
const MAX_LOCAL_ENTRIES = 200;

/**
 * Log an auditable event.
 * @param {string} action - e.g. 'DELETE_USER', 'SEAL_CONTAINER', 'APPROVE_ARRIVAL'
 * @param {string} targetType - e.g. 'profile', 'container', 'arrival'
 * @param {string} targetId - ID of the affected record
 * @param {object} details - Additional metadata
 */
export const logAudit = async (action, targetType = null, targetId = null, details = {}) => {
  const timestamp = new Date().toISOString();
  
  // Get current user
  let userId = null, userEmail = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    userEmail = user?.email;
  } catch (e) {
    // silent
  }

  const entry = {
    user_id: userId,
    user_email: userEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    created_at: timestamp
  };

  // Try Supabase first
  try {
    const { error } = await supabase.from('audit_log').insert([entry]);
    if (!error) return; // Success
  } catch (e) {
    // Table likely doesn't exist — fall through to localStorage
  }

  // Fallback: localStorage
  try {
    const existing = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    existing.unshift(entry);
    if (existing.length > MAX_LOCAL_ENTRIES) existing.length = MAX_LOCAL_ENTRIES;
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Audit log fallback failed:', e);
  }
};

/**
 * Read the local audit log (for display in admin panels).
 */
export const getLocalAuditLog = () => {
  try {
    return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export default logAudit;
