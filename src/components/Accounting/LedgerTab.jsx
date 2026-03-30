import React, { useState, useMemo } from 'react';

const LedgerTab = ({ journalLines, journalEntries, localChartOfAccounts }) => {
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
                credit: Number(line.credit_amount || 0)
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
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--text-tertiary)' }}>No journal lines match the current filters.</td></tr>
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
                                </tr>
                                <tr style={{ background: Math.abs(totalDebit - totalCredit) < 0.01 ? '#dcfce7' : '#fef2f2' }}>
                                    <td colSpan="6" style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', fontWeight: 600, color: Math.abs(totalDebit - totalCredit) < 0.01 ? '#166534' : '#dc2626', textAlign: 'right' }}>
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
        </div>
    );
};

export default LedgerTab;
