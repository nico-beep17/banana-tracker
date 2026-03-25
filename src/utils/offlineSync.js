import { supabase } from '../supabaseClient';

/**
 * Offline Sync Engine
 * 
 * Queues mutations (insert, update, delete) in localStorage when the device
 * is offline or Supabase calls fail due to network errors. Automatically
 * replays the queue when connectivity is restored.
 * 
 * Usage:
 *   import { offlineSync } from '../utils/offlineSync';
 * 
 *   // Instead of direct Supabase calls:
 *   await offlineSync.mutate('insert', 'arrivals', newArrivalData);
 *   await offlineSync.mutate('update', 'containers', updateData, { id: containerId });
 *   await offlineSync.mutate('delete', 'arrivals', null, { id: arrivalId });
 */

const QUEUE_KEY = 'lavc_offline_queue';
const SYNC_STATUS_KEY = 'lavc_sync_status';

class OfflineSyncEngine {
  constructor() {
    this._syncing = false;
    this._listeners = new Set();

    // Auto-sync when connectivity is restored
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineSync] Network restored — flushing queue...');
        this.flush();
      });

      // Try flushing on app start
      if (navigator.onLine) {
        setTimeout(() => this.flush(), 3000);
      }
    }
  }

  /**
   * Check if we're online.
   */
  get isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Get the current offline queue.
   */
  get queue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Get the number of pending operations.
   */
  get pendingCount() {
    return this.queue.length;
  }

  /**
   * Subscribe to sync status changes.
   * @param {Function} listener - called with { syncing, pendingCount, lastError }
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify(status) {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
    this._listeners.forEach(fn => {
      try { fn(status); } catch (e) { /* swallow */ }
    });
  }

  /**
   * Enqueue an operation.
   */
  _enqueue(operation, table, data, filter = null) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      operation,
      table,
      data,
      filter,
      created_at: new Date().toISOString(),
      retries: 0
    };

    const queue = this.queue;
    queue.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    this._notify({ syncing: false, pendingCount: queue.length, lastError: null });
    return entry;
  }

  /**
   * Execute a Supabase mutation — or queue it if offline / on network error.
   * @param {'insert'|'update'|'delete'} operation
   * @param {string} table - Supabase table name
   * @param {object|null} data - Data for insert/update
   * @param {object|null} filter - Filter for update/delete (e.g. { id: '...' })
   * @returns {{ success: boolean, data: any, queued: boolean }}
   */
  async mutate(operation, table, data = null, filter = null) {
    // If offline, queue immediately
    if (!this.isOnline) {
      this._enqueue(operation, table, data, filter);
      return { success: true, data: null, queued: true };
    }

    // Try the operation
    try {
      const result = await this._execute(operation, table, data, filter);
      return { success: true, data: result, queued: false };
    } catch (error) {
      // Network-type errors get queued
      if (this._isNetworkError(error)) {
        this._enqueue(operation, table, data, filter);
        return { success: true, data: null, queued: true };
      }
      // Other errors (e.g., RLS violations) bubble up
      throw error;
    }
  }

  /**
   * Flush the offline queue — replay all pending operations.
   */
  async flush() {
    if (this._syncing || !this.isOnline) return;

    const queue = this.queue;
    if (queue.length === 0) return;

    this._syncing = true;
    this._notify({ syncing: true, pendingCount: queue.length, lastError: null });

    const remaining = [];
    let lastError = null;

    for (const entry of queue) {
      try {
        await this._execute(entry.operation, entry.table, entry.data, entry.filter);
        // Success — don't re-add to queue
      } catch (error) {
        if (this._isNetworkError(error) || entry.retries < 3) {
          // Retry later
          remaining.push({ ...entry, retries: entry.retries + 1 });
          lastError = error.message;
        } else {
          // Max retries exceeded — drop (log it)
          console.error(`[OfflineSync] Dropping failed operation after ${entry.retries} retries:`, entry, error);
          lastError = `Dropped: ${error.message}`;
        }
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    this._syncing = false;
    this._notify({ syncing: false, pendingCount: remaining.length, lastError });
  }

  /**
   * Execute a single Supabase operation.
   */
  async _execute(operation, table, data, filter) {
    let query;

    switch (operation) {
      case 'insert':
        query = supabase.from(table).insert(Array.isArray(data) ? data : [data]);
        break;
      case 'update':
        query = supabase.from(table).update(data);
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        break;
      case 'delete':
        query = supabase.from(table).delete();
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const { data: result, error } = await query.select();
    if (error) throw error;
    return result;
  }

  /**
   * Detect if an error is a network/connectivity error.
   */
  _isNetworkError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('aborted') ||
      error.code === 'PGRST301' // Supabase timeout
    );
  }

  /**
   * Clear the queue (for admin/debug use).
   */
  clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    this._notify({ syncing: false, pendingCount: 0, lastError: null });
  }
}

// Singleton
export const offlineSync = new OfflineSyncEngine();
export default offlineSync;
