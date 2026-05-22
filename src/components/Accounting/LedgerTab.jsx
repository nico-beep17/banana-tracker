import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { logAudit } from '../../utils/auditLog';

const LedgerTab = ({ journalLines, journalEntries, localChartOfAccounts, accountingPeriods = [] }) => {
    const queryClient = useQueryClient();

    // State for Editing Journal Entry
    const [editingEntry, setEditingEntry] = useState(null); // { id, date_posted, reference_no, description, currency, exchange_rate, lines: [...] }

    // Helper: Check if a date falls within a closed accounting period
    const isPeriodLocked = (dateString) => {
        if (!dateString) return false;
        const date = dateString.split('T')[0];
        const period = accountingPeriods.find(p => date >= p.start_date && date <= p.end_date);
        return period ? period.is_closed : false;
    };

    // Computed Ledger Data
    const ledgerData = useMemo(() => {
        return journalLines.map(line => {
            const entry = journalEntries.find(je => je.id === line.entry_id) || {};
            const account = localChartOfAccounts.find(coa => coa.id === line.account_id) || {};
            return {
                id: line.id,
                date: entry.date_posted || new Date().toISOString(),
                reference: entry.reference_no || 'N/A',
                description: entry.description || '',
                accountCode: account.code || '?',
                accountName: account.name || 'Unknown Account',
                debit: Number(line.debit_amount || 0),
                credit: Number(line.credit_amount || 0),
                entryId: entry.id
            };
        }).sort((a, b) => new Date(b.date) - new Date(a.date) || b.reference.localeCompare(a.reference));
    }, [journalLines, journalEntries, localChartOfAccounts]);

    const [accountFilter, setAccountFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filtered = useMemo(() => {
        return ledgerData.filter(row => {
            if (accountFilter && row.accountCode !== accountFilter) return false;
            if (dateFrom && row.date < dateFrom) return false;
            if (dateTo && row.date > dateTo) return false;
            return true;
        });
    }, [ledgerData, accountFilter, dateFrom, dateTo]);

    const totalDebit = filtered.reduce((s, r) => s + r.debit, 0);
    const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);

    const uniqueAccounts = useMemo(() => {
        return [...new Map(ledgerData.map(r => [r.accountCode, r])).values()]
            .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    }, [ledgerData]);

    // Initialize editing workspace with full entry details
    const startEditEntry = (entryId) => {
        const entry = journalEntries.find(je => je.id === entryId);
        if (!entry) {
            toast.error("Could not find journal entry details.");
            return;
        }

        // Check if original entry is in a locked period
        if (isPeriodLocked(entry.date_posted)) {
            toast.error(`Blocked: This transaction falls within a closed accounting period and cannot be edited.`);
            return;
        }

        const lines = journalLines.filter(jl => jl.entry_id === entryId).map(jl => {
            const account = localChartOfAccounts.find(coa => coa.id === jl.account_id) || {};
            return {
                id: jl.id,
                account_id: jl.account_id,
                accountCode: account.code || '',
                accountName: account.name || '',
                debit: jl.debit_amount ? String(jl.debit_amount) : '',
                credit: jl.credit_amount ? String(jl.credit_amount) : ''
            };
        });

        setEditingEntry({
            id: entry.id,
            date_posted: entry.date_posted ? entry.date_posted.split('T')[0] : '',
            reference_no: entry.reference_no || '',
            description: entry.description || '',
            currency: entry.currency || 'PHP',
            exchange_rate: entry.exchange_rate || 1.00,
            lines: lines
        });
    };

    // Live validation for edited entry
    const validation = useMemo(() => {
        if (!editingEntry) return { balanced: true, totalDebit: 0, totalCredit: 0, diff: 0 };
        const totalDebit = editingEntry.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        const totalCredit = editingEntry.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        const diff = Math.abs(totalDebit - totalCredit);
        const balanced = diff < 0.01;
        return { balanced, totalDebit, totalCredit, diff };
    }, [editingEntry]);

    const handleSaveEdit = async () => {
        if (!editingEntry) return;

        if (!editingEntry.reference_no) {
            toast.error("Reference number is required.");
            return;
        }

        // Validate Period Lock
        const originalEntry = journalEntries.find(je => je.id === editingEntry.id) || {};
        if (isPeriodLocked(originalEntry.date_posted)) {
            toast.error(`Cannot save changes: Original transaction date (${originalEntry.date_posted}) falls within a closed period.`);
            return;
        }
        if (isPeriodLocked(editingEntry.date_posted)) {
            toast.error(`Cannot save changes: Target transaction date (${editingEntry.date_posted}) falls within a closed period.`);
            return;
        }

        // Validate double-entry line count and balance
        const validLines = editingEntry.lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
        if (validLines.length < 2) {
            toast.warning("Journal entries require at least two lines.");
            return;
        }

        if (!validation.balanced) {
            toast.warning(`Debits and credits must balance. Current discrepancy: ₱${validation.diff.toFixed(2)}`);
            return;
        }

        // Capture original lines for audit logging
        const originalLines = journalLines.filter(jl => jl.entry_id === editingEntry.id).map(jl => {
            const account = localChartOfAccounts.find(coa => coa.id === jl.account_id) || {};
            return {
                accountCode: account.code || '',
                accountName: account.name || '',
                debit: Number(jl.debit_amount || 0),
                credit: Number(jl.credit_amount || 0)
            };
        });

        try {
            // 1. Update Journal Entry Header
            const { error: jeError } = await supabase
                .from('journal_entries')
                .update({
                    reference_no: editingEntry.reference_no,
                    date_posted: editingEntry.date_posted,
                    description: editingEntry.description,
                    currency: editingEntry.currency,
                    exchange_rate: Number(editingEntry.exchange_rate) || 1.00
                })
                .eq('id', editingEntry.id);

            if (jeError) throw jeError;

            // 2. Clear old lines for this entry
            const { error: delLinesError } = await supabase
                .from('journal_lines')
                .delete()
                .eq('entry_id', editingEntry.id);

            if (delLinesError) throw delLinesError;

            // 3. Insert new lines
            const linesToInsert = validLines.map(l => ({
                entry_id: editingEntry.id,
                account_id: l.account_id,
                debit_amount: Number(l.debit || 0),
                credit_amount: Number(l.credit || 0)
            }));

            const { error: insLinesError } = await supabase
                .from('journal_lines')
                .insert(linesToInsert);

            if (insLinesError) throw insLinesError;

            // 4. Update linked voucher if exists
            const { data: voucher } = await supabase
                .from('vouchers')
                .select('*')
                .eq('entry_id', editingEntry.id)
                .maybeSingle();

            if (voucher) {
                let newTotalAmount = validation.totalDebit;
                if (voucher.currency === 'USD') {
                    newTotalAmount = validation.totalDebit / (Number(editingEntry.exchange_rate) || 1.00);
                }
                const { error: vError } = await supabase
                    .from('vouchers')
                    .update({
                        voucher_no: editingEntry.reference_no,
                        total_amount: Number(newTotalAmount.toFixed(2))
                    })
                    .eq('id', voucher.id);

                if (vError) throw vError;
            }

            // Write audit log entry
            await logAudit('EDIT_JOURNAL_ENTRY', 'journal_entry', editingEntry.id, {
                reference_no: editingEntry.reference_no,
                before: {
                    date_posted: originalEntry.date_posted,
                    reference_no: originalEntry.reference_no,
                    description: originalEntry.description,
                    currency: originalEntry.currency,
                    exchange_rate: originalEntry.exchange_rate,
                    lines: originalLines
                },
                after: {
                    date_posted: editingEntry.date_posted,
                    reference_no: editingEntry.reference_no,
                    description: editingEntry.description,
                    currency: editingEntry.currency,
                    exchange_rate: Number(editingEntry.exchange_rate) || 1.00,
                    lines: validLines.map(l => ({
                        accountCode: l.accountCode,
                        accountName: l.accountName,
                        debit: Number(l.debit || 0),
                        credit: Number(l.credit || 0)
                    }))
                }
            });

            toast.success("Journal entry updated successfully.");
            setEditingEntry(null);

            // Invalidate React Query cache
            queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
            queryClient.invalidateQueries({ queryKey: ['journal_lines'] });
            queryClient.invalidateQueries({ queryKey: ['vouchers'] });
        } catch (error) {
            console.error("Error updating GL entry:", error);
            toast.error("Failed to update GL entry: " + error.message);
        }
    };

    const handleDeleteEntry = async (entryId) => {
        if (!entryId) {
            toast.error("Invalid entry ID.");
            return;
        }

        // Validate Period Lock for deletion
        const entry = journalEntries.find(je => je.id === entryId);
        if (entry && isPeriodLocked(entry.date_posted)) {
            toast.error(`Blocked: Transaction falls within a closed accounting period and cannot be deleted.`);
            return;
        }

        if (!window.confirm("Are you sure you want to delete this journal entry? This will permanently remove all associated lines and vouchers.")) return;

        // Capture original lines for audit logging
        const originalLines = journalLines.filter(jl => jl.entry_id === entryId).map(jl => {
            const account = localChartOfAccounts.find(coa => coa.id === jl.account_id) || {};
            return {
                accountCode: account.code || '',
                accountName: account.name || '',
                debit: Number(jl.debit_amount || 0),
                credit: Number(jl.credit_amount || 0)
            };
        });

        try {
            // Delete child records first to avoid foreign key constraints
            await supabase.from('vouchers').delete().eq('entry_id', entryId);
            await supabase.from('journal_lines').delete().eq('entry_id', entryId);
            const { error } = await supabase.from('journal_entries').delete().eq('id', entryId);
            
            if (error) throw error;
            
            // Write audit log entry
            if (entry) {
                await logAudit('DELETE_JOURNAL_ENTRY', 'journal_entry', entryId, {
                    reference_no: entry.reference_no,
                    date_posted: entry.date_posted,
                    description: entry.description,
                    currency: entry.currency,
                    exchange_rate: entry.exchange_rate,
                    lines: originalLines
                });
            }

            toast.success("Journal entry deleted successfully.");
            queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
            queryClient.invalidateQueries({ queryKey: ['journal_lines'] });
            queryClient.invalidateQueries({ queryKey: ['vouchers'] });
        } catch (error) {
            console.error("Error deleting entry:", error);
            toast.error("Failed to delete entry: " + error.message);
        }
    };

    return (
        <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--color-primary-dark)' }}>General Ledger Transactions</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Comprehensive log of all posted double-entry journal lines.</p>
            
            <div>
                {/* Inline filters (self-contained) */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Filter by Account</label>
                        <select className="input-field" style={{ fontSize: '0.82rem' }} value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
                            <option value="">All Accounts</option>
                            {uniqueAccounts.map(r => (
                                <option key={r.accountCode} value={r.accountCode}>{r.accountCode} - {r.accountName}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>From Date</label>
                        <input type="date" className="input-field" style={{ fontSize: '0.82rem' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>To Date</label>
                        <input type="date" className="input-field" style={{ fontSize: '0.82rem' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    {(accountFilter || dateFrom || dateTo) && (
                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                onClick={() => { setAccountFilter(''); setDateFrom(''); setDateTo(''); }}>
                                ✕ Clear Filters
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Reference</th>
                                <th>Description</th>
                                <th>Account</th>
                                <th className="text-right">Debit (PHP)</th>
                                <th className="text-right">Credit (PHP)</th>
                                <th className="text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--text-tertiary)' }}>No journal lines match the current filters.</td></tr>
                            ) : (
                                filtered.map((row, idx) => (
                                    <tr key={row.id} style={{
                                        background: row.credit > 0 ? '#fafafa' : 'transparent',
                                        borderBottom: (idx < filtered.length - 1 && filtered[idx + 1]?.reference !== row.reference) ? '2px solid #e2e8f0' : undefined
                                    }}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(row.date).toLocaleDateString()}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--color-primary-main)', fontSize: '0.82rem' }}>{row.reference}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                                        <td>
                                            <span style={{ color: 'var(--text-tertiary)', marginRight: '0.4rem', fontSize: '0.78rem' }}>{row.accountCode}</span>
                                            <strong style={{ fontSize: '0.83rem' }}>{row.accountName}</strong>
                                        </td>
                                        <td className="text-right" style={{ fontWeight: row.debit > 0 ? 700 : 400, color: row.debit > 0 ? '#0f4c26' : '#cbd5e1' }}>
                                            {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}
                                        </td>
                                        <td className="text-right" style={{ fontWeight: row.credit > 0 ? 700 : 400, color: row.credit > 0 ? '#b45309' : '#cbd5e1' }}>
                                            {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}
                                        </td>
                                        <td className="text-center">
                                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn-secondary" 
                                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', color: 'var(--color-primary-dark)', borderColor: 'var(--color-primary-soft)' }}
                                                    onClick={() => startEditEntry(row.entryId)}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    className="btn-secondary" 
                                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                                                    onClick={() => handleDeleteEntry(row.entryId)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                                    <td colSpan="4" style={{ padding: '0.6rem 1rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>TOTALS ({filtered.length} lines)</td>
                                    <td className="text-right" style={{ color: '#0f4c26', padding: '0.6rem 1rem' }}>{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="text-right" style={{ color: '#b45309', padding: '0.6rem 1rem' }}>{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                                <tr style={{ background: Math.abs(totalDebit - totalCredit) < 0.01 ? '#dcfce7' : '#fef2f2' }}>
                                    <td colSpan="7" style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', fontWeight: 600, color: Math.abs(totalDebit - totalCredit) < 0.01 ? '#166534' : '#dc2626', textAlign: 'right' }}>
                                        {Math.abs(totalDebit - totalCredit) < 0.01
                                            ? '✓ Balanced — Debits equal Credits'
                                            : `⚠ Out of Balance by ₱${Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Premium Glassmorphic Edit Entry Modal */}
            {editingEntry && (
                <div className="audit-modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="ledger-modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>Edit Journal Entry</h3>
                            <button
                                type="button"
                                onClick={() => setEditingEntry(null)}
                                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="ledger-modal-grid-2col">
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Posted</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={editingEntry.date_posted}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, date_posted: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reference No.</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editingEntry.reference_no}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, reference_no: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                            <textarea
                                className="input-field"
                                rows="2"
                                value={editingEntry.description}
                                onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                            />
                        </div>

                        <div className="ledger-modal-grid-2col" style={{ marginBottom: '1.5rem' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Currency</label>
                                <select
                                    className="input-field"
                                    value={editingEntry.currency}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, currency: e.target.value })}
                                >
                                    <option value="PHP">PHP</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                            {editingEntry.currency === 'USD' && (
                                <div className="input-group">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>USD/PHP Exchange Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input-field"
                                        value={editingEntry.exchange_rate}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, exchange_rate: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)' }}>Journal Lines</h4>
                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <table className="banana-table" style={{ fontSize: '0.85rem', margin: 0 }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th>Account</th>
                                            <th className="text-right" style={{ width: '140px' }}>Debit (PHP)</th>
                                            <th className="text-right" style={{ width: '140px' }}>Credit (PHP)</th>
                                            <th className="text-center" style={{ width: '50px' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editingEntry.lines.map((line, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <select
                                                        className="input-field"
                                                        style={{ padding: '0.35rem', height: 'auto', fontSize: '0.82rem' }}
                                                        value={line.account_id}
                                                        onChange={(e) => {
                                                            const accId = e.target.value;
                                                            const acc = localChartOfAccounts.find(a => a.id === accId);
                                                            const newLines = [...editingEntry.lines];
                                                            newLines[idx].account_id = accId;
                                                            newLines[idx].accountCode = acc ? acc.code : '';
                                                            newLines[idx].accountName = acc ? acc.name : '';
                                                            setEditingEntry({ ...editingEntry, lines: newLines });
                                                        }}
                                                    >
                                                        <option value="">Select Account</option>
                                                        {localChartOfAccounts.map(coa => (
                                                            <option key={coa.id} value={coa.id}>{coa.code} - {coa.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="input-field text-right"
                                                        style={{ padding: '0.35rem', height: 'auto', fontSize: '0.82rem' }}
                                                        placeholder="0.00"
                                                        value={line.debit}
                                                        onChange={(e) => {
                                                            const newLines = [...editingEntry.lines];
                                                            newLines[idx].debit = e.target.value;
                                                            if (e.target.value !== '') {
                                                                newLines[idx].credit = '';
                                                            }
                                                            setEditingEntry({ ...editingEntry, lines: newLines });
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="input-field text-right"
                                                        style={{ padding: '0.35rem', height: 'auto', fontSize: '0.82rem' }}
                                                        placeholder="0.00"
                                                        value={line.credit}
                                                        onChange={(e) => {
                                                            const newLines = [...editingEntry.lines];
                                                            newLines[idx].credit = e.target.value;
                                                            if (e.target.value !== '') {
                                                                newLines[idx].debit = '';
                                                            }
                                                            setEditingEntry({ ...editingEntry, lines: newLines });
                                                        }}
                                                    />
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem' }}
                                                        onClick={() => {
                                                            const newLines = editingEntry.lines.filter((_, i) => i !== idx);
                                                            setEditingEntry({ ...editingEntry, lines: newLines });
                                                        }}
                                                        disabled={editingEntry.lines.length <= 2}
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ width: '100%', marginTop: '0.75rem', padding: '0.4rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                    setEditingEntry({
                                        ...editingEntry,
                                        lines: [...editingEntry.lines, { account_id: '', accountCode: '', accountName: '', debit: '', credit: '' }]
                                    });
                                }}
                            >
                                + Add Row
                            </button>
                        </div>

                        {/* Totals & Live Balance Validation */}
                        <div className="ledger-modal-validation-bar" style={{
                            background: validation.balanced ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${validation.balanced ? '#bbf7d0' : '#fecaca'}`
                        }}>
                            <div>
                                <span style={{ marginRight: '1.5rem', color: '#334155' }}>Total Debits: <strong>₱{validation.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                                <span style={{ color: '#334155' }}>Total Credits: <strong>₱{validation.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                            </div>
                            <div style={{ fontWeight: 600, color: validation.balanced ? '#166534' : '#dc2626' }}>
                                {validation.balanced 
                                    ? '✓ Balanced' 
                                    : `⚠ Out of Balance by ₱${validation.diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                }
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setEditingEntry(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleSaveEdit}
                                disabled={!validation.balanced || editingEntry.lines.length < 2 || !editingEntry.reference_no}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LedgerTab;
