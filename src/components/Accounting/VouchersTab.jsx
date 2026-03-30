import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';

const VouchersTab = ({ 
    exchangeRate, 
    setExchangeRate, 
    accountingPeriods, 
    localChartOfAccounts, 
    farms 
}) => {
    // Phase 12 Voucher Entry State
    const [voucherType, setVoucherType] = useState('PAYABLE');
    const [voucherForm, setVoucherForm] = useState({
        entityId: '',
        amount: '',
        referenceNo: '',
        description: '',
        currency: 'PHP'
    });

    // Dynamic Journal Lines State
    const [journalLinesForm, setJournalLinesForm] = useState([
        { accountCode: '', accountName: '', debit: '', credit: '' },
        { accountCode: '', accountName: '', debit: '', credit: '' }
    ]);

    const showToast = (msg, type) => {
        if (type === 'error') toast.error(msg);
        else if (type === 'warning') toast.warning(msg);
        else toast.success(msg);
    };

    const handlePostVoucher = async () => {
        if (!voucherForm.referenceNo) {
            showToast("Please enter a reference number.", "error");
            return;
        }

        const dateInput = document.getElementById('voucher-date');
        const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

        // 🚨 Validate Accounting Period Lock
        const activePeriod = accountingPeriods.find(p => date >= p.start_date && date <= p.end_date);
        if (activePeriod && activePeriod.is_closed) {
            showToast(`Blocked: Period "${activePeriod.period_name}" is closed.`, "error");
            return;
        }

        const baseAmount = Number(voucherForm.amount || 0);

        let phpAmount = baseAmount;
        if (voucherForm.currency === 'USD') {
            phpAmount = baseAmount * exchangeRate;
        }

        let linesToInsert = [];

        const getAccountId = (code) => {
            const acc = localChartOfAccounts.find(a => a.code === code);
            if (!acc) {
                console.error(`Account Code lookup failed for: ${code}`);
                return null;
            }
            return acc.id;
        };

        if (voucherType === 'PAYABLE') {
            if (!baseAmount) { showToast("Please enter an amount.", "error"); return; }
            linesToInsert = [
                { account_id: getAccountId('5010'), debit_amount: phpAmount, credit_amount: 0 },
                { account_id: getAccountId('2010'), debit_amount: 0, credit_amount: phpAmount }
            ];
        } else if (voucherType === 'PAYMENT') {
            if (!baseAmount) { showToast("Please enter an amount.", "error"); return; }
            linesToInsert = [
                { account_id: getAccountId('2010'), debit_amount: phpAmount, credit_amount: 0 },
                { account_id: getAccountId('1010'), debit_amount: 0, credit_amount: phpAmount }
            ];
        } else if (voucherType === 'CASH_RECEIPT') {
            if (!baseAmount) { showToast("Please enter an amount.", "error"); return; }
            linesToInsert = [
                { account_id: getAccountId('1010'), debit_amount: phpAmount, credit_amount: 0 },
                { account_id: getAccountId('4010'), debit_amount: 0, credit_amount: phpAmount }
            ];
        } else if (voucherType === 'JOURNAL') {
            const validLines = journalLinesForm.filter(l => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0));
            if (validLines.length < 2) {
                toast.warning("Journal entries require at least two lines.");
                return;
            }
            const totalDebit = validLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
            const totalCredit = validLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

            // Simple floating point check
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                toast.warning(`Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)}).`);
                return;
            }

            linesToInsert = validLines.map(l => ({
                account_id: getAccountId(l.accountCode),
                debit_amount: Number(l.debit || 0),
                credit_amount: Number(l.credit || 0)
            }));
        }

        // Validate that all lines resolved to a valid account ID
        const missingAccounts = linesToInsert.filter(l => !l.account_id);
        if (missingAccounts.length > 0) {
            showToast("One or more accounts not found in COA. Please seed the Chart of Accounts first.", "error");
            return;
        }

        try {
            // 1. Create Journal Entry
            const { data: jeData, error: jeError } = await supabase
                .from('journal_entries')
                .insert([{
                    reference_no: voucherForm.referenceNo,
                    date_posted: date,
                    description: voucherForm.description,
                    currency: voucherForm.currency,
                    exchange_rate: voucherForm.currency === 'USD' ? exchangeRate : 1.00
                }])
                .select()
                .single();

            if (jeError) throw jeError;

            // 2. Insert Journal Lines
            const linesWithId = linesToInsert.map(l => ({
                ...l,
                entry_id: jeData.id
            }));

            const { error: jlError } = await supabase
                .from('journal_lines')
                .insert(linesWithId);

            if (jlError) throw jlError;

            // 3. Create Voucher Record
            if (voucherType !== 'JOURNAL') {
                const { error: vError } = await supabase
                    .from('vouchers')
                    .insert([{
                        voucher_no: voucherForm.referenceNo,
                        type: voucherType,
                        entity_id: voucherForm.entityId || null,
                        total_amount: baseAmount,
                        currency: voucherForm.currency,
                        entry_id: jeData.id,
                        status: 'POSTED'
                    }]);
                if (vError) throw vError;
            }

            showToast("✅ Voucher posted to General Ledger!", "success");

            // Reset form
            setVoucherForm({ entityId: '', amount: '', referenceNo: '', description: '', currency: 'PHP' });
            setJournalLinesForm([
                { accountCode: '', accountName: '', debit: '', credit: '' },
                { accountCode: '', accountName: '', debit: '', credit: '' }
            ]);
        } catch (error) {
            console.error("Error posting voucher:", error);
            showToast("Error posting voucher: " + error.message, "error");
        }
    };

    return (
        <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary-dark)' }}>Voucher & Journal Entry</h3>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Generate and post automated double-entry records to the General Ledger.</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Global USD/PHP Rate</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600 }}>$1.00 = ₱</span>
                            <input
                                type="number"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(Number(e.target.value))}
                                style={{ width: '80px', padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* Left Side: Type Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>1. Select Voucher Type</h4>

                    <button
                        className={`tab-btn ${voucherType === 'PAYABLE' ? 'active' : ''}`}
                        onClick={() => setVoucherType('PAYABLE')}
                        style={{ textAlign: 'left', margin: 0, borderRadius: '6px', border: voucherType === 'PAYABLE' ? '2px solid var(--color-primary-main)' : '1px solid #cbd5e1' }}
                    >
                        <strong>Payable Voucher (AP)</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 'normal' }}>Record a liability owed to a Grower.</div>
                    </button>

                    <button
                        className={`tab-btn ${voucherType === 'PAYMENT' ? 'active' : ''}`}
                        onClick={() => setVoucherType('PAYMENT')}
                        style={{ textAlign: 'left', margin: 0, borderRadius: '6px', border: voucherType === 'PAYMENT' ? '2px solid var(--color-primary-main)' : '1px solid #cbd5e1' }}
                    >
                        <strong>Payment Voucher</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 'normal' }}>Record cash paid outwards (e.g. paying Growers).</div>
                    </button>

                    <button
                        className={`tab-btn ${voucherType === 'CASH_RECEIPT' ? 'active' : ''}`}
                        onClick={() => setVoucherType('CASH_RECEIPT')}
                        style={{ textAlign: 'left', margin: 0, borderRadius: '6px', border: voucherType === 'CASH_RECEIPT' ? '2px solid var(--color-primary-main)' : '1px solid #cbd5e1' }}
                    >
                        <strong>Cash Receipt (CR)</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 'normal' }}>Record cash received inwards (e.g. from Buyers).</div>
                    </button>

                    <button
                        className={`tab-btn ${voucherType === 'JOURNAL' ? 'active' : ''}`}
                        onClick={() => setVoucherType('JOURNAL')}
                        style={{ textAlign: 'left', margin: 0, borderRadius: '6px', border: voucherType === 'JOURNAL' ? '2px solid var(--color-primary-main)' : '1px solid #cbd5e1' }}
                    >
                        <strong>General Journal (JV)</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 'normal' }}>Manual multi-line adjusting entries.</div>
                    </button>
                </div>

                {/* Right Side: Data Entry Form */}
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)' }}>2. Enter Details</h4>

                    <div className="input-group">
                        <label>Date</label>
                        <input type="date" id="voucher-date" className="input-field" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>

                    {voucherType === 'PAYABLE' && (
                        <>
                            <div className="input-group">
                                <label>Select Grower (Creditor)</label>
                                <select className="input-field" value={voucherForm.entityId} onChange={e => setVoucherForm({ ...voucherForm, entityId: e.target.value })}>
                                    <option value="">-- Select Farm --</option>
                                    {farms.map(f => (
                                        <option key={f.id} value={f.id}>{f.name} ({f.farmCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                <div>
                                    <label>Currency</label>
                                    <select className="input-field" value={voucherForm.currency} onChange={e => setVoucherForm({ ...voucherForm, currency: e.target.value })}>
                                        <option value="PHP">PHP</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Total Amount</label>
                                    <input type="number" step="0.01" className="input-field" placeholder="0.00" value={voucherForm.amount} onChange={e => setVoucherForm({ ...voucherForm, amount: e.target.value })} />
                                </div>
                            </div>
                            {voucherForm.currency === 'USD' && (
                                <div style={{ padding: '0.75rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                    <strong>Exchange Conversion:</strong> ${Number(voucherForm.amount || 0).toLocaleString()} USD x ₱{exchangeRate} = <strong>₱{(Number(voucherForm.amount || 0) * exchangeRate).toLocaleString()} PHP</strong>
                                </div>
                            )}
                            <div className="input-group">
                                <label>Reference No. / Particulars</label>
                                <input type="text" className="input-field" placeholder="e.g. Inv# 12345" value={voucherForm.referenceNo} onChange={e => setVoucherForm({ ...voucherForm, referenceNo: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Description / Notes</label>
                                <textarea className="input-field" rows="3" value={voucherForm.description} onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}></textarea>
                            </div>

                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderLeft: '4px solid var(--color-primary-main)', borderRadius: '4px' }}>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Automated GL Posting Preview</h5>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    <span>Dr. Cost of Goods - Grower Payments (5010)</span>
                                    <span>₱{(Number(voucherForm.amount || 0) * (voucherForm.currency === 'USD' ? exchangeRate : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ paddingLeft: '2rem' }}>Cr. Accounts Payable - Growers (2010)</span>
                                    <span>₱{(Number(voucherForm.amount || 0) * (voucherForm.currency === 'USD' ? exchangeRate : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {voucherType === 'PAYMENT' && (
                        <>
                            <div className="input-group">
                                <label>Pay To (Grower / Vendor)</label>
                                <select className="input-field" value={voucherForm.entityId} onChange={e => setVoucherForm({ ...voucherForm, entityId: e.target.value })}>
                                    <option value="">-- Select Farm --</option>
                                    {farms.map(f => (
                                        <option key={f.id} value={f.id}>{f.name} ({f.farmCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Amount Paid (PHP)</label>
                                <input type="number" step="0.01" className="input-field" placeholder="0.00" value={voucherForm.amount} onChange={e => setVoucherForm({ ...voucherForm, amount: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Check No. / Reference</label>
                                <input type="text" className="input-field" placeholder="e.g. Check# 000123" value={voucherForm.referenceNo} onChange={e => setVoucherForm({ ...voucherForm, referenceNo: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Description</label>
                                <textarea className="input-field" rows="3" value={voucherForm.description} onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}></textarea>
                            </div>
                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderLeft: '4px solid var(--color-primary-main)', borderRadius: '4px' }}>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Automated GL Posting Preview</h5>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    <span>Dr. Accounts Payable - Growers (2010)</span>
                                    <span>₱{Number(voucherForm.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ paddingLeft: '2rem' }}>Cr. Cash in Bank - PHP (1010)</span>
                                    <span>₱{Number(voucherForm.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {voucherType === 'CASH_RECEIPT' && (
                        <>
                            <div className="input-group">
                                <label>Received From (Buyer)</label>
                                <input type="text" className="input-field" placeholder="e.g. Kawasaki Trading" value={voucherForm.entityId} onChange={e => setVoucherForm({ ...voucherForm, entityId: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                <div>
                                    <label>Currency Received</label>
                                    <select className="input-field" value={voucherForm.currency} onChange={e => setVoucherForm({ ...voucherForm, currency: e.target.value })}>
                                        <option value="USD">USD</option>
                                        <option value="PHP">PHP</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Amount Received</label>
                                    <input type="number" step="0.01" className="input-field" placeholder="0.00" value={voucherForm.amount} onChange={e => setVoucherForm({ ...voucherForm, amount: e.target.value })} />
                                </div>
                            </div>
                            {voucherForm.currency === 'USD' && (
                                <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                    <strong>Exchange Conversion:</strong> ${Number(voucherForm.amount || 0).toLocaleString()} USD x ₱{exchangeRate} = <strong>₱{(Number(voucherForm.amount || 0) * exchangeRate).toLocaleString()} PHP</strong>
                                </div>
                            )}
                            <div className="input-group">
                                <label>Wire Transfer Ref / Particulars</label>
                                <input type="text" className="input-field" placeholder="e.g. TT# 987654" value={voucherForm.referenceNo} onChange={e => setVoucherForm({ ...voucherForm, referenceNo: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Description</label>
                                <textarea className="input-field" rows="3" value={voucherForm.description} onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}></textarea>
                            </div>
                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderLeft: '4px solid #10b981', borderRadius: '4px' }}>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Automated GL Posting Preview</h5>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    <span>Dr. Cash in Bank - {voucherForm.currency === 'USD' ? 'USD (1011)' : 'PHP (1010)'}</span>
                                    <span>₱{(Number(voucherForm.amount || 0) * (voucherForm.currency === 'USD' ? exchangeRate : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ paddingLeft: '2rem' }}>Cr. Export Sales Revenue - Banana (4010)</span>
                                    <span>₱{(Number(voucherForm.amount || 0) * (voucherForm.currency === 'USD' ? exchangeRate : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {voucherType === 'JOURNAL' && (
                        <>
                            <div className="input-group">
                                <label>Reference No.</label>
                                <input type="text" className="input-field" placeholder="e.g. JV-2026-001" value={voucherForm.referenceNo} onChange={e => setVoucherForm({ ...voucherForm, referenceNo: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Description / Reason</label>
                                <textarea className="input-field" rows="2" value={voucherForm.description} onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}></textarea>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Journal Lines</label>
                                <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Account</th>
                                            <th className="text-right">Debit</th>
                                            <th className="text-right">Credit</th>
                                            <th className="text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {journalLinesForm.map((line, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <select
                                                        className="input-field"
                                                        style={{ padding: '0.2rem', height: 'auto', fontSize: '0.8rem' }}
                                                        value={line.accountCode}
                                                        onChange={(e) => {
                                                            const code = e.target.value;
                                                            const acc = localChartOfAccounts.find(a => a.code === code);
                                                            const newLines = [...journalLinesForm];
                                                            newLines[idx].accountCode = code;
                                                            newLines[idx].accountName = acc ? acc.name : '';
                                                            setJournalLinesForm(newLines);
                                                        }}
                                                    >
                                                        <option value="">Select Account</option>
                                                        {localChartOfAccounts.map(acc => (
                                                            <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input-field"
                                                        style={{ padding: '0.2rem', height: 'auto', textAlign: 'right', fontSize: '0.8rem' }}
                                                        placeholder="0.00"
                                                        value={line.debit}
                                                        onChange={e => {
                                                            const newLines = [...journalLinesForm];
                                                            newLines[idx].debit = e.target.value;
                                                            newLines[idx].credit = ''; // Clear other side
                                                            setJournalLinesForm(newLines);
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input-field"
                                                        style={{ padding: '0.2rem', height: 'auto', textAlign: 'right', fontSize: '0.8rem' }}
                                                        placeholder="0.00"
                                                        value={line.credit}
                                                        onChange={e => {
                                                            const newLines = [...journalLinesForm];
                                                            newLines[idx].credit = e.target.value;
                                                            newLines[idx].debit = ''; // Clear other side
                                                            setJournalLinesForm(newLines);
                                                        }}
                                                    />
                                                </td>
                                                <td className="text-center">
                                                    {journalLinesForm.length > 2 && (
                                                        <button style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                                                            setJournalLinesForm(journalLinesForm.filter((_, i) => i !== idx));
                                                        }}>X</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button
                                    className="btn-secondary"
                                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.25rem', fontSize: '0.75rem' }}
                                    onClick={() => setJournalLinesForm([...journalLinesForm, { accountCode: '', accountName: '', debit: '', credit: '' }])}
                                >
                                    + Add Row
                                </button>
                            </div>
                        </>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button className="btn-secondary" onClick={() => setVoucherForm({ entityId: '', amount: '', referenceNo: '', description: '', currency: 'PHP' })}>Clear</button>
                        <button className="btn-primary" onClick={handlePostVoucher}>
                            Generate & Post Voucher
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VouchersTab;
