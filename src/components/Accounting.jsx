import React, { useState, useMemo, useEffect } from 'react';
import { downloadCSV } from '../utils/exportUtils';
import { LayoutDashboard, Receipt, BookOpen, Package, LineChart, Calendar, Save, Plus, BookMarked } from 'lucide-react';
import './Accounting.css';
import { supabase } from '../supabaseClient';

const Accounting = ({ arrivals = [], samplings = [], containers = [], farms = [], userProfile, exchangeRate, setExchangeRate, chartOfAccounts = [], journalEntries = [], journalLines = [], showToast, fetchData }) => {
    const [activeTab, setActiveTab] = useState('payables');
    const [subTab, setSubTab] = useState('overview');

    // Financial Reports State
    const [reportView, setReportView] = useState('TRIAL_BALANCE');

    // Force refresh Chart of Accounts if empty (handling post-seed state sync)
    const [localChartOfAccounts, setLocalChartOfAccounts] = useState(chartOfAccounts);
    const [accountingPeriods, setAccountingPeriods] = useState([]);
    const [editingReceivable, setEditingReceivable] = useState(null); // { id, agreedRate, amountPaid, status }
    const [receivableEditForm, setReceivableEditForm] = useState({ agreed_rate: '', amount_paid_partial: '', receivables_status: 'UNPAID' });

    // Farm Carton Inventory State
    const [cartonDeliveries, setCartonDeliveries] = useState(() => {
        const saved = localStorage.getItem('cartonDeliveries');
        return saved ? JSON.parse(saved) : [];
    });
    useEffect(() => {
        localStorage.setItem('cartonDeliveries', JSON.stringify(cartonDeliveries));
    }, [cartonDeliveries]);
    const [cartonForm, setCartonForm] = useState({ date: new Date().toISOString().split('T')[0], farmCode: '', quantity: '', referenceNo: '' });

    React.useEffect(() => {
        if (chartOfAccounts && chartOfAccounts.length > 0) {
            setLocalChartOfAccounts(chartOfAccounts);
        } else {
            const fetchCOA = async () => {
                const { data } = await supabase.from('chart_of_accounts').select('*');
                if (data && data.length > 0) setLocalChartOfAccounts(data);
            };
            fetchCOA();
        }

        const fetchPeriods = async () => {
            const { data } = await supabase.from('accounting_periods').select('*').order('start_date', { ascending: false });
            if (data) setAccountingPeriods(data);
        };
        fetchPeriods();
    }, [chartOfAccounts]);

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
                alert("Journal entries require at least two lines.");
                return;
            }
            const totalDebit = validLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
            const totalCredit = validLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

            // Simple floating point check
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                alert(`Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)}).`);
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
            console.error('Error posting voucher:', error);
            showToast("Error posting voucher: " + error.message, "error");
        }
    };

    // PAYABLES LOGIC (Expenses to Growers)
    const payablesData = useMemo(() => {
        // Only look at APPROVED arrivals
        const approvedArrivals = arrivals.filter(a => a.approval_status === 'APPROVED');

        const calculatePaymentDate = (dateStr) => {
            if (!dateStr) return 'TBD';
            const dp = new Date(dateStr);
            const dayOfWeek = dp.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
            const payDate = new Date(dp);

            if (dayOfWeek >= 1 && dayOfWeek <= 3) {
                // Mon, Tue, Wed -> Pay on Friday of the SAME week
                payDate.setDate(dp.getDate() + (5 - dayOfWeek));
            } else if (dayOfWeek >= 4 && dayOfWeek <= 6) {
                // Thu, Fri, Sat -> Pay on Tuesday of the NEXT week
                const daysToNextTuesday = (9 - dayOfWeek) % 7 + (dayOfWeek <= 2 ? 0 : 7);
                payDate.setDate(dp.getDate() + (daysToNextTuesday === 0 ? 7 : daysToNextTuesday));
                // Simplified: if Thu(4), 9-4=5. if Fri(5), 9-5=4. if Sat(6), 9-6=3.
            } else if (dayOfWeek === 0) {
                // Sunday -> Pay on Friday of the NEXT week (or same week)
                payDate.setDate(dp.getDate() + 5);
            }

            return payDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };

        const grouped = approvedArrivals.reduce((acc, arrival) => {
            const batchId = arrival.batchId || arrival.id; // Fallback to id if it's an old record without batchId

            if (!acc[batchId]) {
                acc[batchId] = {
                    id: batchId, // Represents the whole delivery batch
                    dateTimeEncoded: arrival.dateTimeEncoded,
                    dateOfPacking: arrival.dateOfPacking,
                    farmName: arrival.farmName,
                    farmCode: arrival.farmCode,
                    plateNumber: arrival.plateNumber,
                    deliveryReceipt: arrival.deliveryReceipt,
                    expectedPaymentDate: calculatePaymentDate(arrival.dateOfPacking),
                    totalQuantity: 0,
                    grossAmount: 0,
                    deductionsTotal: 0,
                    rejectedCount: 0,
                    paymentStatus: 'PAID', // We will assume PAID unless we find a PENDING line item
                    classADetails: { quantity: 0, amount: 0 },
                    classBDetails: { quantity: 0, amount: 0 }
                };
            }

            // Use the specific rate snapshot locked at the time of arrival
            const rateApplied = arrival.locked_rate || 0;
            const isClassA = arrival.typeId ? arrival.typeId.startsWith('classA') : (arrival.ccClass === 'A' || arrival.ccClass === 'Class A' || arrival.ccClass === 'SH' || arrival.ccClass === 'A (Cluster)');

            const qty = arrival.quantity || 0;
            const lineGross = qty * rateApplied;

            acc[batchId].totalQuantity += qty;
            acc[batchId].grossAmount += lineGross;

            if (isClassA) {
                acc[batchId].classADetails.quantity += qty;
                acc[batchId].classADetails.amount += lineGross;
            } else {
                acc[batchId].classBDetails.quantity += qty;
                acc[batchId].classBDetails.amount += lineGross;
            }

            // If any associated line item is pending, the whole batch is pending settlement
            if (arrival.payment_status !== 'PAID') {
                acc[batchId].paymentStatus = 'PENDING';
            }

            return acc;
        }, {});

        // Now process deductions for each batch
        Object.values(grouped).forEach(batch => {
            // Find all samplings for arrivals in this batch
            const batchSamplings = samplings.filter(s => s.batchId === batch.id);

            batchSamplings.forEach(sampling => {
                if (sampling.boxes) {
                    sampling.boxes.forEach(box => {
                        if (box.decision === 'REJECTED') {
                            batch.rejectedCount++;
                            // Fallback behavior for old samplings without specific type context: Try to deduct the highest locked rate we can find for that batch/class
                            let deductionRate = 0;
                            const isSampClassA = sampling.ccClass ? (sampling.ccClass === 'A' || sampling.ccClass === 'Class A' || sampling.ccClass.startsWith('A')) : true;

                            // Find an arrival line item matching this batch and class to guess the rate
                            const matchingArrival = approvedArrivals.find(a =>
                                a.batchId === batch.id &&
                                (isSampClassA ? (a.typeId && a.typeId.startsWith('classA')) : (a.typeId && a.typeId.startsWith('classB')))
                            );

                            if (matchingArrival && matchingArrival.locked_rate) {
                                deductionRate = matchingArrival.locked_rate;
                            } else {
                                // Ultimate fallback: just find any locked rate in the batch
                                const anyArrival = approvedArrivals.find(a => a.batchId === batch.id && a.locked_rate > 0);
                                deductionRate = anyArrival ? anyArrival.locked_rate : 0;
                            }

                            batch.deductionsTotal += deductionRate;
                        }
                    });
                }
            });

            batch.netAmountDue = batch.grossAmount - batch.deductionsTotal;
        });

        return Object.values(grouped);
    }, [arrivals, samplings, farms]);

    // RECEIVABLES LOGIC (Revenue from Buyers)
    const receivablesData = useMemo(() => {
        // Only look at containers that are fully stuffed or departed
        const activeContainers = containers.filter(c => c.totalBoxes > 0);

        return activeContainers.map(container => {
            const agreedRate = Number(container.agreed_rate) || 0;
            const amountPaid = Number(container.amount_paid_partial) || 0;
            const totalBoxes = Number(container.totalBoxes) || 0;
            const grossRevenue = totalBoxes * agreedRate;
            const balanceDue = grossRevenue - amountPaid;

            let payStatus = container.receivables_status || 'UNPAID';
            if (payStatus !== 'FULLY_PAID' && amountPaid > 0 && amountPaid < grossRevenue) payStatus = 'PARTIAL';
            if (payStatus !== 'FULLY_PAID' && amountPaid >= grossRevenue && grossRevenue > 0) payStatus = 'FULLY_PAID';

            return {
                ...container,
                agreedRate,
                amountPaid,
                grossRevenue,
                balanceDue,
                receivablesStatus: payStatus
            };
        });
    }, [containers]);

    // Financial Metrics
    const totalPendingPayables = payablesData.filter(p => p.paymentStatus !== 'PAID').reduce((sum, p) => sum + p.netAmountDue, 0);
    const totalPaidPayables = payablesData.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + p.netAmountDue, 0);

    const totalExpectedRevenue = receivablesData.reduce((sum, c) => sum + c.grossRevenue, 0);
    const totalCollectedRevenue = receivablesData.reduce((sum, c) => sum + c.amountPaid, 0);
    const totalPendingReceivables = totalExpectedRevenue - totalCollectedRevenue;

    const handleMarkAsPaid = async (batchId) => {
        // Because the payment applies to the whole batch, update all arrivals matching batchId
        const { error } = await supabase
            .from('arrivals')
            .update({ payment_status: 'PAID', payment_date: new Date().toISOString() })
            .or(`batchId.eq.${batchId},id.eq.${batchId}`);

        if (error) {
            console.error("Error marking paid:", error);
            showToast("Failed to update payment status.", "error");
        } else {
            showToast("Payment recorded successfully.", "success");
            if (fetchData) fetchData();
        }
    };

    const handleUpdateReceivable = async () => {
        if (!editingReceivable) return;
        const { error } = await supabase
            .from('containers')
            .update({
                agreed_rate: Number(receivableEditForm.agreed_rate) || 0,
                amount_paid_partial: Number(receivableEditForm.amount_paid_partial) || 0,
                receivables_status: receivableEditForm.receivables_status
            })
            .eq('id', editingReceivable);
        if (error) {
            showToast('Error updating billing: ' + error.message, 'error');
        } else {
            showToast('Billing updated successfully.', 'success');
            setEditingReceivable(null);
            if (fetchData) fetchData();
        }
    };

    // Calculate Trial Balance
    const trialBalance = useMemo(() => {
        const balances = {};
        localChartOfAccounts.forEach(acc => {
            balances[acc.id] = { ...acc, totalDebit: 0, totalCredit: 0, balance: 0 };
        });

        journalLines.forEach(line => {
            if (balances[line.account_id]) {
                balances[line.account_id].totalDebit += Number(line.debit_amount || 0);
                balances[line.account_id].totalCredit += Number(line.credit_amount || 0);
            }
        });

        const activeAccounts = Object.values(balances).filter(b => b.totalDebit > 0 || b.totalCredit > 0);

        activeAccounts.forEach(acc => {
            // Normal Balance Logic:
            // Assets & Expenses increase with Debit
            // Liabilities, Equity, Revenue increase with Credit
            if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
                acc.balance = acc.totalDebit - acc.totalCredit;
            } else {
                acc.balance = acc.totalCredit - acc.totalDebit;
            }
        });

        const sorted = activeAccounts.sort((a, b) => a.code.localeCompare(b.code));
        const totalDr = sorted.reduce((sum, a) => sum + a.totalDebit, 0);
        const totalCr = sorted.reduce((sum, a) => sum + a.totalCredit, 0);

        return { accounts: sorted, totalDebit: totalDr, totalCredit: totalCr };
    }, [localChartOfAccounts, journalLines]);

    // Map Journal Lines to Entries for Ledger display
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

    return (
        <div className="accounting-dashboard animation-fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2>Financial Ledger</h2>
                    <p>Track grower payables, container receivables, and gross margins.</p>
                </div>
            </header>

            {/* ERP Sub-Navigation */}
            <div className="chrome-tabs-container">
                <button className={`chrome-tab ${subTab === 'overview' ? 'active' : ''}`} onClick={() => setSubTab('overview')}>
                    <LayoutDashboard size={16} /> Accounts Overview
                </button>
                <button className={`chrome-tab ${subTab === 'vouchers' ? 'active' : ''}`} onClick={() => setSubTab('vouchers')}>
                    <Receipt size={16} /> Vouchers (AP/AR)
                </button>
                <button className={`chrome-tab ${subTab === 'ledger' ? 'active' : ''}`} onClick={() => setSubTab('ledger')}>
                    <BookOpen size={16} /> General Ledger
                </button>
                <button className={`chrome-tab ${subTab === 'inventory' ? 'active' : ''}`} onClick={() => setSubTab('inventory')}>
                    <Package size={16} /> Inventory Valuation
                </button>
                <button className={`chrome-tab ${subTab === 'reports' ? 'active' : ''}`} onClick={() => setSubTab('reports')}>
                    <LineChart size={16} /> Financial Reports
                </button>
                <button className={`chrome-tab ${subTab === 'coa' ? 'active' : ''}`} onClick={() => setSubTab('coa')}>
                    <BookMarked size={16} /> Chart of Accounts
                </button>
                <button className={`chrome-tab ${subTab === 'periods' ? 'active' : ''}`} onClick={() => setSubTab('periods')}>
                    <Calendar size={16} /> Calendar Periods
                </button>
            </div>

            {/* Dynamic Content Based on Sub-Tab */}
            {subTab === 'overview' && (
                <div className="erp-content-section slide-down">
                    {/* Metrics Overview */}
                    <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                        <div className="card metric-card">
                            <div className="metric-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>💸</div>
                            <div className="metric-content">
                                <h3 className="metric-title">Pending Payables</h3>
                                <p className="metric-value">₱{totalPendingPayables.toLocaleString()}</p>
                                <span className="metric-trend negative">Awaiting settlement</span>
                            </div>
                        </div>
                        <div className="card metric-card">
                            <div className="metric-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>✓</div>
                            <div className="metric-content">
                                <h3 className="metric-title">Total Settled (YTD)</h3>
                                <p className="metric-value">₱{totalPaidPayables.toLocaleString()}</p>
                                <span className="metric-trend positive">Paid to growers</span>
                            </div>
                        </div>
                        <div className="card metric-card">
                            <div className="metric-icon" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>💰</div>
                            <div className="metric-content">
                                <h3 className="metric-title">Receivables Expected</h3>
                                <p className="metric-value">${totalExpectedRevenue.toLocaleString()}</p>
                                <span className="metric-trend neutral">${totalPendingReceivables.toLocaleString()} Unpaid</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="tabs-container">
                        <button
                            className={`tab-btn ${activeTab === 'payables' ? 'active' : ''}`}
                            onClick={() => setActiveTab('payables')}
                        >
                            Grower Payables (Expenses)
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'receivables' ? 'active' : ''}`}
                            onClick={() => setActiveTab('receivables')}
                        >
                            Buyer Receivables (Revenue)
                        </button>
                    </div>

                    {/* Payables Ledger */}
                    {activeTab === 'payables' && (
                        <div className="card shadow-lg" style={{ padding: '0', overflow: 'hidden' }}>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Delivery Batch</th>
                                        <th>Grower</th>
                                        <th className="text-right">Total Boxes</th>
                                        <th className="text-right">Rates (PHP)</th>
                                        <th className="text-right">Gross</th>
                                        <th className="text-right" style={{ color: '#dc2626' }}>Deductions</th>
                                        <th className="text-right">Net Due (PHP)</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payablesData.length === 0 ? (
                                        <tr><td colSpan="9" className="text-center" style={{ padding: '2rem' }}>No pending payables.</td></tr>
                                    ) : (
                                        payablesData.sort((a, b) => new Date(b.dateTimeEncoded) - new Date(a.dateTimeEncoded)).map(p => (
                                            <tr key={p.id}>
                                                <td style={{ fontSize: '0.85rem' }}>
                                                    {p.dateOfPacking ? new Date(p.dateOfPacking).toLocaleDateString() : 'N/A'}
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{p.deliveryReceipt || p.plateNumber}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: '600', color: 'var(--color-primary-dark)' }}>{p.farmName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.farmCode}</div>
                                                </td>
                                                <td className="text-right">
                                                    <strong>{p.totalQuantity}</strong>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-main)' }}>
                                                        {p.classADetails.quantity > 0 && `${p.classADetails.quantity} A`}
                                                        {p.classADetails.quantity > 0 && p.classBDetails.quantity > 0 && ' | '}
                                                        {p.classBDetails.quantity > 0 && `${p.classBDetails.quantity} B`}
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Varied based</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>on spec matrix</div>
                                                </td>
                                                <td className="text-right" style={{ color: '#64748b' }}>₱{p.grossAmount.toFixed(2)}</td>
                                                <td className="text-right" style={{ color: '#ef4444' }}>
                                                    {p.deductionsTotal > 0 ? `-₱${p.deductionsTotal.toFixed(2)}` : '₱0.00'}
                                                    {p.rejectedCount > 0 && <div style={{ fontSize: '0.7rem' }}>({p.rejectedCount} rejected)</div>}
                                                </td>
                                                <td className="text-right" style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-primary-dark)' }}>
                                                    ₱{p.netAmountDue.toFixed(2)}
                                                </td>
                                                <td className="text-center">
                                                    <span className="status-badge" style={p.paymentStatus === 'PAID' ? { background: '#dcfce7', color: '#16a34a' } : { background: '#fef3c7', color: '#b45309' }}>
                                                        {p.paymentStatus}
                                                    </span>
                                                    {p.paymentStatus === 'PENDING' && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                            Due: <strong>{p.expectedPaymentDate}</strong>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {p.paymentStatus !== 'PAID' && (
                                                        <button
                                                            className="btn-primary"
                                                            onClick={() => handleMarkAsPaid(p.id)}
                                                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
                                                        >
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Receivables Ledger */}
                    {activeTab === 'receivables' && (
                        <div className="card shadow-lg" style={{ padding: '0', overflow: 'hidden' }}>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Container / Voyage</th>
                                        <th>Buyer</th>
                                        <th className="text-right">Total Boxes</th>
                                        <th className="text-right">Agreed Rate (USD)</th>
                                        <th className="text-right">Gross Rev</th>
                                        <th className="text-right" style={{ color: '#16a34a' }}>Amount Paid</th>
                                        <th className="text-right">Balance Due</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receivablesData.length === 0 ? (
                                        <tr><td colSpan="9" className="text-center" style={{ padding: '2rem' }}>No outbound containers found.</td></tr>
                                    ) : (
                                        receivablesData.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated)).map(c => (
                                            <React.Fragment key={c.id}>
                                                <tr>
                                                    <td>
                                                        <div style={{ fontWeight: '800', color: 'var(--color-primary-dark)' }}>{c.reeferNo || 'Pending'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.vesselVoyage}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: '600' }}>{c.buyer_name || 'Unassigned'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.destination}</div>
                                                    </td>
                                                    <td className="text-right" style={{ fontWeight: '600' }}>{c.totalBoxes}</td>
                                                    <td className="text-right">${c.agreedRate.toFixed(2)}</td>
                                                    <td className="text-right" style={{ color: '#64748b' }}>${c.grossRevenue.toFixed(2)}</td>
                                                    <td className="text-right" style={{ color: '#16a34a', fontWeight: '600' }}>${c.amountPaid.toFixed(2)}</td>
                                                    <td className="text-right" style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-primary-dark)' }}>
                                                        ${c.balanceDue.toFixed(2)}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="status-badge" style={c.receivablesStatus === 'FULLY_PAID' ? { background: '#dcfce7', color: '#16a34a' } : c.receivablesStatus === 'PARTIAL' ? { background: '#dbeafe', color: '#2563eb' } : { background: '#fef3c7', color: '#b45309' }}>
                                                            {c.receivablesStatus}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            className="btn-secondary"
                                                            onClick={() => {
                                                                setEditingReceivable(c.id);
                                                                setReceivableEditForm({ agreed_rate: c.agreedRate, amount_paid_partial: c.amountPaid, receivables_status: c.receivablesStatus });
                                                            }}
                                                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
                                                        >
                                                            {editingReceivable === c.id ? 'Cancel' : 'Update Billing'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {editingReceivable === c.id && (
                                                    <tr>
                                                        <td colSpan="9" style={{ background: '#f0fdf4', padding: '1rem 1.5rem', borderBottom: '2px solid #10b981' }}>
                                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Agreed Rate (USD/box)</label>
                                                                    <input type="number" step="0.01" className="input-field" value={receivableEditForm.agreed_rate}
                                                                        onChange={e => setReceivableEditForm({ ...receivableEditForm, agreed_rate: e.target.value })}
                                                                        style={{ width: '130px' }} />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Amount Paid (USD)</label>
                                                                    <input type="number" step="0.01" className="input-field" value={receivableEditForm.amount_paid_partial}
                                                                        onChange={e => setReceivableEditForm({ ...receivableEditForm, amount_paid_partial: e.target.value })}
                                                                        style={{ width: '130px' }} />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Status</label>
                                                                    <select className="input-field" value={receivableEditForm.receivables_status}
                                                                        onChange={e => setReceivableEditForm({ ...receivableEditForm, receivables_status: e.target.value })}
                                                                        style={{ width: '140px' }}>
                                                                        <option value="UNPAID">UNPAID</option>
                                                                        <option value="PARTIAL">PARTIAL</option>
                                                                        <option value="FULLY_PAID">FULLY PAID</option>
                                                                    </select>
                                                                </div>
                                                                <button className="btn-primary" onClick={handleUpdateReceivable} style={{ padding: '0.5rem 1.25rem' }}>
                                                                    💾 Save
                                                                </button>
                                                                <button className="btn-secondary" onClick={() => setEditingReceivable(null)} style={{ padding: '0.5rem 1rem' }}>
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}


            {subTab === 'vouchers' && (
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
            )}

            {subTab === 'ledger' && (
                <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--color-primary-dark)' }}>General Ledger Transactions</h3>
                    <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Comprehensive log of all posted double-entry journal lines.</p>
                    <LedgerTable ledgerData={ledgerData} />
                </div>
            )}

            {subTab === 'inventory' && (
                <div className="erp-content-section slide-down">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                        <div className="card" style={{ padding: '2rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', alignSelf: 'start' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#0f172a' }}>
                                <Plus size={20} className="text-green-500" /> Dispatch Cartons to Grower
                            </h4>
                            <div className="input-group">
                                <label>Date Delivered</label>
                                <input type="date" className="input-field" value={cartonForm.date} onChange={e => setCartonForm({ ...cartonForm, date: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Farm / Grower</label>
                                <select className="input-field" value={cartonForm.farmCode} onChange={e => setCartonForm({ ...cartonForm, farmCode: e.target.value })}>
                                    <option value="">-- Select Farm --</option>
                                    {farms.map(f => (
                                        <option key={f.id} value={f.code}>{f.code} - {f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Quantity (Cartons)</label>
                                <input type="number" className="input-field" value={cartonForm.quantity} onChange={e => setCartonForm({ ...cartonForm, quantity: e.target.value })} placeholder="e.g. 500" />
                            </div>
                            <div className="input-group">
                                <label>Delivery Receipt No.</label>
                                <input type="text" className="input-field" value={cartonForm.referenceNo} onChange={e => setCartonForm({ ...cartonForm, referenceNo: e.target.value })} placeholder="Optional" />
                            </div>
                            <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
                                if (!cartonForm.date || !cartonForm.farmCode || !cartonForm.quantity) {
                                    showToast("Date, Farm, and Quantity are required.", "error"); return;
                                }
                                const newDelivery = { id: Date.now().toString(), ...cartonForm, quantity: Number(cartonForm.quantity) };
                                setCartonDeliveries([newDelivery, ...cartonDeliveries]);
                                setCartonForm({ date: new Date().toISOString().split('T')[0], farmCode: '', quantity: '', referenceNo: '' });
                                showToast("Cartons dispatched successfully.", "success");
                            }}>
                                <Save size={18} /> Record Delivery
                            </button>
                        </div>
                        <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, color: '#0f172a' }}>Grower Carton Balances</h4>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Used cartons are auto-calculated from Arrivals.</span>
                            </div>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Farm Code</th>
                                        <th className="text-right">Total Delivered (IN)</th>
                                        <th className="text-right">Used in Packing (OUT)</th>
                                        <th className="text-right">Remaining Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {farms.map(farm => {
                                        const totalIn = cartonDeliveries.filter(d => d.farmCode === farm.code).reduce((sum, d) => sum + d.quantity, 0);
                                        const totalOut = arrivals.filter(a => a.farmCode === farm.code && a.approval_status === 'APPROVED').reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
                                        const balance = totalIn - totalOut;
                                        if (totalIn === 0 && totalOut === 0) return null; // Hide if no activity

                                        return (
                                            <tr key={farm.code}>
                                                <td style={{ fontWeight: 600 }}>{farm.code}</td>
                                                <td className="text-right" style={{ color: '#16a34a' }}>{totalIn} boxes</td>
                                                <td className="text-right" style={{ color: '#dc2626' }}>{totalOut} boxes</td>
                                                <td className="text-right" style={{ fontWeight: 800, color: balance < 0 ? '#dc2626' : '#0f172a' }}>
                                                    {balance} boxes
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {farms.length === 0 || (farms.every(farm => {
                                        const inQ = cartonDeliveries.filter(d => d.farmCode === farm.code).reduce((sum, d) => sum + d.quantity, 0);
                                        const outQ = arrivals.filter(a => a.farmCode === farm.code && a.approval_status === 'APPROVED').reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
                                        return inQ === 0 && outQ === 0;
                                    })) ? (
                                        <tr><td colSpan="4" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>No carton activity recorded yet.</td></tr>
                                    ) : null}
                                </tbody>
                            </table>
                            {cartonDeliveries.length > 0 && (
                                <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                    <h5 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Recent Dispatch History</h5>
                                    {cartonDeliveries.slice(0, 5).map(d => (
                                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                            <span><strong>{d.farmCode}</strong> <span style={{ color: '#64748b' }}>({d.date})</span> - REF: {d.referenceNo || 'No Reference'}</span>
                                            <span style={{ fontWeight: 600, color: '#16a34a' }}>+{d.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'reports' && (
                <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary-dark)' }}>Financial Reporting Center</h3>
                            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Generate fully automated financial statements based on real-time GL postings.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select className="input-field" style={{ width: '250px' }} value={reportView} onChange={(e) => setReportView(e.target.value)}>
                                <option value="TRIAL_BALANCE">Trial Balance</option>
                                <option value="BALANCE_SHEET">Statement of Financial Position (Balance Sheet)</option>
                                <option value="INCOME_STATEMENT">Statement of Comprehensive Income</option>
                                <option value="AGING_REPORT">Aging of Receivables & Payables</option>
                                <option value="BANK_RECON">Bank Reconciliation</option>
                            </select>
                            <button className="btn-secondary" onClick={() => {
                                const exportData = trialBalance.accounts.map(acc => ({
                                    'Account Code': acc.code,
                                    'Account Name': acc.name,
                                    'Type': acc.type,
                                    'Total Debit': acc.totalDebit,
                                    'Total Credit': acc.totalCredit,
                                    'Balance': acc.balance,
                                    'Export Timestamp': new Date().toLocaleString()
                                }));
                                const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
                                downloadCSV(exportData, `GL_Extract_Report_${timestampStr}.xlsx`);
                            }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📊 Export GL Data
                            </button>
                        </div>
                    </div>

                    <div style={{ maxWidth: '850px', margin: '0 auto', background: '#f8fafc', padding: '2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        {/* 1. TRIAL BALANCE */}
                        {reportView === 'TRIAL_BALANCE' && (
                            <>
                                <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary-dark)' }}>Trial Balance<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>As of {new Date().toLocaleDateString()}</span></h4>
                                <table className="banana-table" style={{ fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Account Name</th>
                                            <th>Type</th>
                                            <th className="text-right">Total Debit</th>
                                            <th className="text-right">Total Credit</th>
                                            <th className="text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trialBalance.accounts.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center" style={{ padding: '2rem' }}>No account activity to report.</td></tr>
                                        ) : (
                                            trialBalance.accounts.map(acc => (
                                                <tr key={acc.id}>
                                                    <td style={{ color: 'var(--text-tertiary)' }}>{acc.code}</td>
                                                    <td style={{ fontWeight: 600 }}>{acc.name}</td>
                                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{acc.type}</td>
                                                    <td className="text-right" style={{ color: acc.totalDebit > 0 ? 'var(--color-primary-dark)' : '#cbd5e1' }}>
                                                        {acc.totalDebit > 0 ? acc.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="text-right" style={{ color: acc.totalCredit > 0 ? '#b45309' : '#cbd5e1' }}>
                                                        {acc.totalCredit > 0 ? acc.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="text-right" style={{ fontWeight: 800, color: acc.balance !== 0 ? '#0f172a' : '#cbd5e1' }}>
                                                        {acc.balance !== 0 ? acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {trialBalance.accounts.length > 0 && (
                                        <tfoot>
                                            <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                                                <td colSpan="3" className="text-right">TOTAL</td>
                                                <td className="text-right" style={{ color: 'var(--color-primary-dark)' }}>₱{trialBalance.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right" style={{ color: trialBalance.totalDebit === trialBalance.totalCredit ? 'var(--color-primary-dark)' : '#dc2626' }}>
                                                    ₱{trialBalance.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>

                                {trialBalance.accounts.length > 0 && trialBalance.totalDebit !== trialBalance.totalCredit && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                        <strong>Warning: Trial Balance is out of bounds. Debits do not equal Credits.</strong>
                                    </div>
                                )}
                                {trialBalance.accounts.length > 0 && trialBalance.totalDebit === trialBalance.totalCredit && trialBalance.totalDebit > 0 && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>✅</span>
                                        <strong>Ledger is balanced perfectly.</strong>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 2. BALANCE SHEET */}
                        {reportView === 'BALANCE_SHEET' && (() => {
                            const assets = trialBalance.accounts.filter(a => a.type === 'ASSET');
                            const liabilities = trialBalance.accounts.filter(a => a.type === 'LIABILITY');
                            const equities = trialBalance.accounts.filter(a => a.type === 'EQUITY');

                            const totalAssets = assets.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const totalEquity = equities.reduce((sum, a) => sum + Math.max(0, a.balance), 0);

                            // Calculate Net Income to roll into Retained Earnings
                            const revenues = trialBalance.accounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const expenses = trialBalance.accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const netIncome = revenues - expenses;

                            const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome;

                            return (
                                <>
                                    <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary-dark)' }}>Statement of Financial Position<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>As of {new Date().toLocaleDateString()}</span></h4>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                        {/* Assets Column */}
                                        <div>
                                            <h5 style={{ borderBottom: '2px solid var(--color-primary-main)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Assets</h5>
                                            {assets.length === 0 ? <p style={{ color: 'var(--text-tertiary)' }}>No asset accounts found.</p> : (
                                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                                    <tbody>
                                                        {assets.map(a => (
                                                            <tr key={a.id}>
                                                                <td style={{ padding: '0.25rem 0' }}>{a.name}</td>
                                                                <td className="text-right">₱{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            </tr>
                                                        ))}
                                                        <tr><td colSpan="2"><hr style={{ margin: '0.5rem 0', borderColor: '#cbd5e1' }} /></td></tr>
                                                        <tr style={{ fontWeight: 800 }}>
                                                            <td>Total Assets</td>
                                                            <td className="text-right">₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Liabilities & Equity Column */}
                                        <div>
                                            <h5 style={{ borderBottom: '2px solid #b45309', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Liabilities</h5>
                                            {liabilities.length === 0 ? <p style={{ color: 'var(--text-tertiary)' }}>No liability accounts found.</p> : (
                                                <table style={{ width: '100%', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                                    <tbody>
                                                        {liabilities.map(a => (
                                                            <tr key={a.id}>
                                                                <td style={{ padding: '0.25rem 0' }}>{a.name}</td>
                                                                <td className="text-right">₱{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            </tr>
                                                        ))}
                                                        <tr><td colSpan="2"><hr style={{ margin: '0.5rem 0', borderColor: '#cbd5e1' }} /></td></tr>
                                                        <tr style={{ fontWeight: 800 }}>
                                                            <td>Total Liabilities</td>
                                                            <td className="text-right">₱{totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            )}

                                            <h5 style={{ borderBottom: '2px solid #0f172a', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Equity</h5>
                                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                                <tbody>
                                                    {equities.map(a => (
                                                        <tr key={a.id}>
                                                            <td style={{ padding: '0.25rem 0' }}>{a.name}</td>
                                                            <td className="text-right">₱{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td style={{ padding: '0.25rem 0', color: 'var(--color-primary-dark)' }}><em>Current Year Net Income</em></td>
                                                        <td className="text-right" style={{ color: 'var(--color-primary-dark)' }}>₱{netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                    <tr><td colSpan="2"><hr style={{ margin: '0.5rem 0', borderColor: '#cbd5e1' }} /></td></tr>
                                                    <tr style={{ fontWeight: 800 }}>
                                                        <td>Total Equity</td>
                                                        <td className="text-right">₱{(totalEquity + netIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '2rem', padding: '1rem', background: '#e0f2fe', borderRadius: '6px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                                        <span>Total Liabilities & Equity:</span>
                                        <span style={{ color: totalAssets === totalLiabilitiesAndEquity ? 'var(--color-primary-dark)' : '#dc2626' }}>
                                            ₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </>
                            );
                        })()}

                        {/* 3. INCOME STATEMENT */}
                        {reportView === 'INCOME_STATEMENT' && (() => {
                            const revenues = trialBalance.accounts.filter(a => a.type === 'REVENUE');
                            const expenses = trialBalance.accounts.filter(a => a.type === 'EXPENSE');

                            const totalRev = revenues.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const totalExp = expenses.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
                            const netIncome = totalRev - totalExp;

                            return (
                                <>
                                    <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary-dark)' }}>Statement of Comprehensive Income<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>For the period ending {new Date().toLocaleDateString()}</span></h4>

                                    <div style={{ padding: '0 2rem' }}>
                                        <h5 style={{ borderBottom: '2px solid #16a34a', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#16a34a' }}>Revenues</h5>
                                        {revenues.length === 0 ? <p style={{ color: 'var(--text-tertiary)' }}>No revenue accounts found.</p> : (
                                            <table style={{ width: '100%', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                                <tbody>
                                                    {revenues.map(a => (
                                                        <tr key={a.id}>
                                                            <td style={{ padding: '0.4rem 0' }}>{a.name}</td>
                                                            <td className="text-right">₱{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={{ fontWeight: 800 }}>
                                                        <td style={{ padding: '0.5rem 0' }}>Total Revenues</td>
                                                        <td className="text-right" style={{ borderTop: '1px solid #cbd5e1' }}>₱{totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        )}

                                        <h5 style={{ borderBottom: '2px solid #dc2626', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#dc2626' }}>Expenses / Cost of Goods Sold</h5>
                                        {expenses.length === 0 ? <p style={{ color: 'var(--text-tertiary)' }}>No expense accounts found.</p> : (
                                            <table style={{ width: '100%', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                                <tbody>
                                                    {expenses.map(a => (
                                                        <tr key={a.id}>
                                                            <td style={{ padding: '0.4rem 0' }}>{a.name}</td>
                                                            <td className="text-right">₱{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={{ fontWeight: 800 }}>
                                                        <td style={{ padding: '0.5rem 0' }}>Total Expenses</td>
                                                        <td className="text-right" style={{ borderTop: '1px solid #cbd5e1' }}>₱{totalExp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        )}

                                        <div style={{ marginTop: '2rem', padding: '1.5rem', background: netIncome >= 0 ? '#dcfce7' : '#fef2f2', color: netIncome >= 0 ? '#166534' : '#991b1b', borderRadius: '6px', border: netIncome >= 0 ? '1px solid #bbf7d0' : '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem' }}>
                                            <span>Net Income (Loss):</span>
                                            <span>₱{netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        {/* 3.5 AGING REPORTS */}
                        {reportView === 'AGING_REPORT' && (() => {
                            const today = new Date();
                            const calculateDays = (dateStr) => {
                                if (!dateStr) return 0;
                                const diffTime = Math.abs(today - new Date(dateStr));
                                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            };

                            const categorizeAging = (days) => {
                                if (days <= 30) return '0-30';
                                if (days <= 60) return '31-60';
                                if (days <= 90) return '61-90';
                                return '90+';
                            };

                            // Calculate AP Aging
                            const apAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
                            payablesData.filter(p => p.paymentStatus !== 'PAID').forEach(p => {
                                const days = calculateDays(p.dateOfPacking);
                                const category = categorizeAging(days);
                                apAging[category] += p.netAmountDue;
                                apAging.total += p.netAmountDue;
                            });

                            // Calculate AR Aging
                            const arAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
                            receivablesData.filter(r => r.receivablesStatus !== 'FULLY_PAID').forEach(r => {
                                const days = calculateDays(r.dateCreated);
                                const category = categorizeAging(days);
                                arAging[category] += r.balanceDue; // Already calculated locally in USD but let's just show raw amounts for now or convert
                                arAging.total += r.balanceDue;
                            });

                            return (
                                <>
                                    <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary-dark)' }}>Aging of Accounts<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>As of {new Date().toLocaleDateString()}</span></h4>

                                    <div style={{ padding: '0 1rem' }}>
                                        <h5 style={{ borderBottom: '2px solid #dc2626', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#dc2626' }}>Accounts Payable (Owed to Growers)</h5>
                                        <table className="banana-table" style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>
                                            <thead>
                                                <tr>
                                                    <th>Account Type</th>
                                                    <th className="text-right">0-30 Days</th>
                                                    <th className="text-right">31-60 Days</th>
                                                    <th className="text-right">61-90 Days</th>
                                                    <th className="text-right">Over 90 Days</th>
                                                    <th className="text-right">Total Outstanding</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Grower Payables (PHP)</td>
                                                    <td className="text-right">₱{apAging['0-30'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right">₱{apAging['31-60'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ color: '#b45309' }}>₱{apAging['61-90'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ color: '#dc2626', fontWeight: 600 }}>₱{apAging['90+'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ fontWeight: 800 }}>₱{apAging.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <h5 style={{ borderBottom: '2px solid #16a34a', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#16a34a' }}>Accounts Receivable (Owed from Buyers)</h5>
                                        <table className="banana-table" style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>
                                            <thead>
                                                <tr>
                                                    <th>Account Type</th>
                                                    <th className="text-right">0-30 Days</th>
                                                    <th className="text-right">31-60 Days</th>
                                                    <th className="text-right">61-90 Days</th>
                                                    <th className="text-right">Over 90 Days</th>
                                                    <th className="text-right">Total Outstanding</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Buyer Receivables (USD)</td>
                                                    <td className="text-right">${arAging['0-30'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right">${arAging['31-60'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ color: '#b45309' }}>${arAging['61-90'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ color: '#dc2626', fontWeight: 600 }}>${arAging['90+'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right" style={{ fontWeight: 800 }}>${arAging.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            );
                        })()}

                        {/* 4. BANK RECONCILIATION */}
                        {reportView === 'BANK_RECON' && (
                            <div style={{ padding: '1rem' }}>
                                <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary-dark)' }}>Bank Reconciliation Checklist</h4>
                                <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '2rem' }}>Compare the system's Cash in Bank ledger against physical bank statements.</p>

                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <h5 style={{ margin: '0 0 0.25rem 0' }}>System Balance: Cash in Bank (PHP)</h5>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Account 1010</span>
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                                            ₱{(() => {
                                                const cashAcct = trialBalance.accounts.find(a => a.code === '1010');
                                                return cashAcct ? cashAcct.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00';
                                            })()}
                                        </div>
                                    </div>

                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label>Statement Balance (from Bank)</label>
                                        <input type="number" step="0.01" className="input-field" placeholder="Enter balance on bank statement..." />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label>Add: Deposits in Transit</label>
                                        <input type="number" step="0.01" className="input-field" placeholder="0.00" />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label>Less: Outstanding Checks</label>
                                        <input type="number" step="0.01" className="input-field" placeholder="0.00" />
                                    </div>

                                    <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '6px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Adjusted Bank Balance (Computed):</span>
                                        <span style={{ fontSize: '1.1rem' }}>₱0.00</span>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                        <button className="btn-primary">Generate Reconciliation Report</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {subTab === 'coa' && (
                <ChartOfAccountsTab
                    localChartOfAccounts={localChartOfAccounts}
                    setLocalChartOfAccounts={setLocalChartOfAccounts}
                />
            )}

            {subTab === 'periods' && (
                <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary-dark)' }}>Accounting Periods Config</h3>
                    <p style={{ margin: '0 0 2rem 0', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Lock down past periods to prevent retroactive journal entries and ensure data integrity.</p>

                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ margin: 0, flex: 1 }}>
                            <label>Period Name</label>
                            <input type="text" id="new-period-name" className="input-field" placeholder="e.g. Q1-2026" />
                        </div>
                        <div className="input-group" style={{ margin: 0, flex: 1 }}>
                            <label>Start Date</label>
                            <input type="date" id="new-period-start" className="input-field" />
                        </div>
                        <div className="input-group" style={{ margin: 0, flex: 1 }}>
                            <label>End Date</label>
                            <input type="date" id="new-period-end" className="input-field" />
                        </div>
                        <button className="btn-primary" onClick={async () => {
                            const name = document.getElementById('new-period-name').value;
                            const start = document.getElementById('new-period-start').value;
                            const end = document.getElementById('new-period-end').value;
                            if (!name || !start || !end) { alert("Please complete all fields."); return; }

                            const { data, error } = await supabase.from('accounting_periods').insert([{
                                period_name: name, start_date: start, end_date: end, is_closed: false
                            }]).select();

                            if (error) alert(error.message);
                            else {
                                setAccountingPeriods([...accountingPeriods, data[0]].sort((a, b) => new Date(b.start_date) - new Date(a.start_date)));
                                document.getElementById('new-period-name').value = '';
                                document.getElementById('new-period-start').value = '';
                                document.getElementById('new-period-end').value = '';
                            }
                        }}>Create Period</button>
                    </div>

                    <table className="banana-table">
                        <thead>
                            <tr>
                                <th>Period Name</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th className="text-center">Status</th>
                                <th className="text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountingPeriods.length === 0 ? (
                                <tr><td colSpan="5" className="text-center" style={{ padding: '2rem' }}>No periods defined.</td></tr>
                            ) : accountingPeriods.map(period => (
                                <tr key={period.id}>
                                    <td style={{ fontWeight: 600 }}>{period.period_name}</td>
                                    <td>{new Date(period.start_date).toLocaleDateString()}</td>
                                    <td>{new Date(period.end_date).toLocaleDateString()}</td>
                                    <td className="text-center">
                                        <span className="status-badge" style={period.is_closed ? { background: '#fef2f2', color: '#991b1b' } : { background: '#dcfce7', color: '#166534' }}>
                                            {period.is_closed ? 'CLOSED / LOCKED' : 'OPEN'}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        {!period.is_closed && (
                                            <button className="btn-secondary" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={async () => {
                                                if (confirm(`Are you sure you want to lock the period "${period.period_name}"? New entries will be blocked.`)) {
                                                    const { error } = await supabase.from('accounting_periods').update({ is_closed: true }).eq('id', period.id);
                                                    if (error) alert(error.message);
                                                    else setAccountingPeriods(accountingPeriods.map(p => p.id === period.id ? { ...p, is_closed: true } : p));
                                                }
                                            }}>🔒 Lock Period</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ============================================================
// CHART OF ACCOUNTS TAB
// ============================================================
const PRESET_ACCOUNTS = [
    // ASSETS
    { code: '1010', name: 'Cash in Bank - PHP',                       type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1011', name: 'Cash in Bank - USD',                       type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1020', name: 'Petty Cash Fund',                          type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1100', name: 'Accounts Receivable - Buyers',             type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1110', name: 'Advances to Growers',                      type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1200', name: 'Inventory - Packing Materials (Boxes)',    type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1210', name: 'Inventory - Banana Produce',               type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1300', name: 'Prepaid Expenses',                         type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1310', name: 'Input VAT',                                type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1500', name: 'Property, Plant & Equipment',              type: 'ASSET',     normal_balance: 'Debit' },
    { code: '1510', name: 'Accumulated Depreciation - PPE',           type: 'ASSET',     normal_balance: 'Credit' },
    // LIABILITIES
    { code: '2010', name: 'Accounts Payable - Growers',               type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2020', name: 'Accrued Salaries & Wages',                 type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2030', name: 'SSS / PHIC / HDMF Payable',               type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2040', name: 'Withholding Tax Payable',                  type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2050', name: 'Output VAT Payable',                       type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2060', name: 'Short-Term Loans Payable',                 type: 'LIABILITY', normal_balance: 'Credit' },
    { code: '2500', name: 'Long-Term Loans Payable',                  type: 'LIABILITY', normal_balance: 'Credit' },
    // EQUITY
    { code: '3010', name: "Owner's Capital",                          type: 'EQUITY',    normal_balance: 'Credit' },
    { code: '3020', name: 'Retained Earnings',                        type: 'EQUITY',    normal_balance: 'Credit' },
    { code: '3030', name: 'Current Year Net Income',                  type: 'EQUITY',    normal_balance: 'Credit' },
    // REVENUE
    { code: '4010', name: 'Export Sales Revenue - Banana',            type: 'REVENUE',   normal_balance: 'Credit' },
    { code: '4020', name: 'Local Sales Revenue',                      type: 'REVENUE',   normal_balance: 'Credit' },
    { code: '4030', name: 'Other Income',                             type: 'REVENUE',   normal_balance: 'Credit' },
    // EXPENSES
    { code: '5010', name: 'Cost of Goods - Grower Payments',          type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5020', name: 'Freight & Logistics Costs',                type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5030', name: 'Salaries & Wages - Employees',             type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5031', name: 'Salaries & Wages - Officers',              type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5040', name: 'SSS / PHIC / HDMF Contributions',          type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5050', name: 'Packing Materials Expense',                type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5060', name: 'Depreciation Expense',                     type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5070', name: 'Bank Charges & Wire Transfer Fees',        type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5080', name: 'Utilities Expense',                        type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5090', name: 'Repairs & Maintenance',                    type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5100', name: 'Communication Expense',                    type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5110', name: 'Professional Fees',                        type: 'EXPENSE',   normal_balance: 'Debit' },
    { code: '5120', name: 'Miscellaneous Expense',                    type: 'EXPENSE',   normal_balance: 'Debit' },
];

const COA_TYPE_COLORS = { ASSET: '#3b82f6', LIABILITY: '#ef4444', EQUITY: '#8b5cf6', REVENUE: '#10b981', EXPENSE: '#f59e0b' };

function ChartOfAccountsTab({ localChartOfAccounts, setLocalChartOfAccounts }) {
    const [newAcc, setNewAcc] = useState({ code: '', name: '', type: 'ASSET', normal_balance: 'Debit' });
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const existingCodes = new Set((localChartOfAccounts || []).map(a => a.code));
    const presetsToAdd = PRESET_ACCOUNTS.filter(p => !existingCodes.has(p.code));

    const grouped = useMemo(() => {
        const g = { ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: [] };
        (localChartOfAccounts || []).forEach(a => { if (g[a.type]) g[a.type].push(a); });
        return g;
    }, [localChartOfAccounts]);

    const handleSeedPresets = async () => {
        if (presetsToAdd.length === 0) { alert('All preset accounts are already in your Chart of Accounts!'); return; }
        if (!window.confirm(`This will add ${presetsToAdd.length} standard banana-export accounts to your COA. Proceed?`)) return;
        setSeeding(true);
        try {
            const { data, error } = await supabase.from('chart_of_accounts').insert(presetsToAdd).select();
            if (error) throw error;
            setLocalChartOfAccounts(prev => [...(prev || []), ...(data || [])]);
            alert(`✅ ${data.length} accounts added successfully!`);
        } catch (e) {
            alert('Error seeding accounts: ' + e.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleAddAccount = async () => {
        if (!newAcc.code || !newAcc.name) return alert('Code and Name are required.');
        if (existingCodes.has(newAcc.code)) return alert(`Account code ${newAcc.code} already exists.`);
        setSaving(true);
        try {
            const { data, error } = await supabase.from('chart_of_accounts').insert([newAcc]).select();
            if (error) throw error;
            setLocalChartOfAccounts(prev => [...(prev || []), ...(data || [])]);
            setNewAcc({ code: '', name: '', type: 'Asset', normal_balance: 'Debit' });
            setShowForm(false);
        } catch (e) {
            alert('Error adding account: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="erp-content-section slide-down text-left" style={{ padding: '2rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.25rem', color: 'var(--color-primary-dark)' }}>Chart of Accounts</h3>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.88rem' }}>{(localChartOfAccounts || []).length} accounts • Banana export standard COA</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {presetsToAdd.length > 0 && (
                        <button
                            onClick={handleSeedPresets}
                            disabled={seeding}
                            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #10b981', background: '#f0fdf4', color: '#065f46', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            {seeding ? '⟳ Adding...' : `⬇ Seed ${presetsToAdd.length} Preset Accounts`}
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <Plus size={16} /> Add Custom Account
                    </button>
                </div>
            </div>

            {/* Add Account Form */}
            {showForm && (
                <div style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Account Code *</label>
                        <input className="input-field" placeholder="e.g. 5130" value={newAcc.code} onChange={e => setNewAcc({ ...newAcc, code: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Account Name *</label>
                        <input className="input-field" placeholder="e.g. Transportation Expense" value={newAcc.name} onChange={e => setNewAcc({ ...newAcc, name: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Type</label>
                        <select className="input-field" value={newAcc.type} onChange={e => setNewAcc({ ...newAcc, type: e.target.value })}>
                            <option value="ASSET">Asset</option><option value="LIABILITY">Liability</option><option value="EQUITY">Equity</option><option value="REVENUE">Revenue</option><option value="EXPENSE">Expense</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Normal Balance</label>
                        <select className="input-field" value={newAcc.normal_balance} onChange={e => setNewAcc({ ...newAcc, normal_balance: e.target.value })}>
                            <option>Debit</option><option>Credit</option>
                        </select>
                    </div>
                    <button onClick={handleAddAccount} disabled={saving} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Account'}
                    </button>
                </div>
            )}

            {/* Accounts By Group */}
            {Object.entries(grouped).map(([type, accs]) => (
                accs.length === 0 ? null : (
                    <div key={type} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COA_TYPE_COLORS[type], display: 'inline-block', flexShrink: 0 }} />
                            <strong style={{ fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: COA_TYPE_COLORS[type] }}>{type}s</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>({accs.length})</span>
                        </div>
                        <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                            <thead><tr><th style={{ width: '90px' }}>Code</th><th>Account Name</th><th style={{ width: '120px' }}>Type</th><th style={{ width: '110px' }}>Normal Balance</th></tr></thead>
                            <tbody>
                                {[...accs].sort((a, b) => a.code.localeCompare(b.code)).map(acc => (
                                    <tr key={acc.id || acc.code}>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: COA_TYPE_COLORS[type] }}>{acc.code}</td>
                                        <td style={{ fontWeight: 500 }}>{acc.name}</td>
                                        <td><span style={{ background: `${COA_TYPE_COLORS[type]}18`, color: COA_TYPE_COLORS[type], padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>{acc.type}</span></td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{acc.normal_balance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ))}
            {(localChartOfAccounts || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                    <p>No accounts yet. Click <strong>"Seed Preset Accounts"</strong> to get started with the standard banana-export COA.</p>
                </div>
            )}
        </div>
    );
}
// ============================================================
// Ledger Filter & Table Sub-Components
// ============================================================
function LedgerAccountFilter({ ledgerData }) {
    return (
        <select
            id="ledger-account-filter"
            className="input-field"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
            defaultValue=""
        >
            <option value="">All Accounts</option>
            {[...new Map(ledgerData.map(r => [r.accountCode, r])).values()]
                .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
                .map(r => (
                    <option key={r.accountCode} value={r.accountCode}>{r.accountCode} - {r.accountName}</option>
                ))}
        </select>
    );
}

function LedgerDateFilter({ id }) {
    return (
        <input
            type="date"
            id={id}
            className="input-field"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
        />
    );
}

function LedgerTable({ ledgerData }) {
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
    );
}

export default Accounting;
