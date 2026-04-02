import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
    Users, Clock, DollarSign, MapPin,
    UserPlus, Edit, Save, ScanLine,
    Calendar, CheckCircle, AlertTriangle
} from 'lucide-react';
// QR and scanner loaded only when needed
import './Accounting.css'; // Reusing ERP styles
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useEmployeesQuery, useDtrRecordsQuery, useAttendanceLocationsQuery } from '../queries/hooks';

const Payroll = ({ initialTab, userProfile }) => {
    const queryClient = useQueryClient();
    const { data: employees = [] } = useEmployeesQuery();
    const { data: dtrRecords = [] } = useDtrRecordsQuery();
    const { data: attendanceLocations = [] } = useAttendanceLocationsQuery();
    const showToast = (msg, type) => {
        if (type === 'error') toast.error(msg);
        else if (type === 'warning') toast.warning(msg);
        else toast.success(msg);
    };

    const [activeTab, setActiveTab] = useState(initialTab || 'dashboard');

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);
    const [payrollRegister, setPayrollRegister] = useState(null);
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);

    const [payPeriodStart, setPayPeriodStart] = useState('');
    const [payPeriodEnd, setPayPeriodEnd] = useState('');

    // Scanner State
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [lastScanTime, setLastScanTime] = useState(0);
    const [showOverride, setShowOverride] = useState(false);
    const [overrideForm, setOverrideForm] = useState({ empId: '', type: 'IN', time: new Date().toISOString().slice(0, 16) });

    // No local fetchData needed here as it's passed from App.jsx

    // Employee Form State
    const [empForm, setEmpForm] = useState({
        employee_code: '', first_name: '', last_name: '', department: '', role: '',
        employment_status: 'ACTIVE', basic_rate: '', rate_type: 'DAILY',
        employee_type: 'EMPLOYEE',
        bank_account_no: '', sss_no: '', phic_no: '', hdmf_no: '', tin_no: ''
    });
    const [isEditingEmp, setIsEditingEmp] = useState(false);
    const [editingEmpId, setEditingEmpId] = useState(null);
    const [empListTab, setEmpListTab] = useState('EMPLOYEE'); // 'EMPLOYEE' or 'OFFICER'

    const handleSaveEmployee = async () => {
        if (!empForm.employee_code || !empForm.first_name || !empForm.last_name) {
            showToast("Code, First Name, and Last Name are required.", "error");
            return;
        }

        try {
            const { id, created_at, ...safePayload } = empForm;
            if (isEditingEmp) {
                const { error } = await supabase.from('employees').update(safePayload).eq('id', editingEmpId);
                if (error) throw error;
                showToast("Employee updated.", "success");
            } else {
                const { error } = await supabase.from('employees').insert([safePayload]);
                if (error) throw error;
                showToast("Employee created successfully.", "success");
            }

            setEmpForm({
                employee_code: '', first_name: '', last_name: '', department: '', role: '',
                employment_status: 'ACTIVE', basic_rate: '', rate_type: 'DAILY',
                employee_type: 'EMPLOYEE',
                bank_account_no: '', sss_no: '', phic_no: '', hdmf_no: '', tin_no: ''
            });
            setIsEditingEmp(false);
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        } catch (error) {
            showToast("Error saving employee: " + error.message, "error");
        }
    };

    const handleEditEmployee = (emp) => {
        setEmpForm(emp);
        setIsEditingEmp(true);
        setEditingEmpId(emp.id);
    };

    // DTR Encoding State
    const [dtrDate, setDtrDate] = useState(new Date().toISOString().split('T')[0]);
    const [dtrEntries, setDtrEntries] = useState({});

    useEffect(() => {
        if (activeTab === 'dtr') {
            const currentDTRs = dtrRecords.filter(d => d.record_date === dtrDate);
            const initialEntries = {};
            employees.filter(e => e.employment_status === 'ACTIVE').forEach(emp => {
                const existing = currentDTRs.find(d => d.employee_id === emp.id);
                if (existing) {
                    initialEntries[emp.id] = { ...existing };
                } else {
                    initialEntries[emp.id] = { regular_hours: 8, overtime_hours: 0, status: 'PRESENT' };
                }
            });
            setDtrEntries(initialEntries);
        }
    }, [activeTab, dtrDate, employees, dtrRecords]);

    const handleSaveDTR = async () => {
        try {
            const recordsToUpsert = Object.keys(dtrEntries).map(empId => ({
                employee_id: empId,
                record_date: dtrDate,
                regular_hours: Number(dtrEntries[empId].regular_hours || 0),
                overtime_hours: Number(dtrEntries[empId].overtime_hours || 0),
                status: dtrEntries[empId].status
            }));

            const { error: delErr } = await supabase.from('dtr_records').delete().eq('record_date', dtrDate);
            if (delErr) throw delErr;

            const { error: insErr } = await supabase.from('dtr_records').insert(recordsToUpsert);
            if (insErr) throw insErr;

            showToast("DTR saved successfully for " + dtrDate, "success");
            queryClient.invalidateQueries({ queryKey: ['dtr_records'] });
        } catch (error) {
            showToast("Error saving DTR: " + error.message, "error");
        }
    };

    const handlePostToGL = async (register) => {
        if (!register) return;
        try {
            const { data: coaData } = await supabase.from('chart_of_accounts').select('*');
            if (!coaData || coaData.length === 0) {
                showToast("Chart of accounts is not seeded.", "error"); return;
            }

            const getAcct = (code) => coaData.find(a => a.code === code)?.id;
            const acctSalaries = getAcct('6001'); // Salaries Expense
            const acctSSS = getAcct('2004'); // SSS Payable (Example code)
            const acctPHIC = getAcct('2005'); // PHIC Payable
            const acctHDMF = getAcct('2006'); // HDMF Payable
            const acctPayable = getAcct('2003'); // Accrued Payroll

            if (!acctSalaries || !acctPayable) {
                showToast("Required GL Accounts (Salaries/Accrued Payroll) are missing.", "error"); return;
            }

            const refNo = `PR-${Date.now().toString().slice(-6)}`;
            const { data: jeData, error: jeErr } = await supabase.from('journal_entries').insert([{
                date_posted: new Date().toISOString().split('T')[0],
                reference_no: refNo,
                description: `Payroll run for period ${register.start} to ${register.end}`,
                total_debit: register.totals.gross,
                total_credit: register.totals.gross
            }]).select();

            if (jeErr) throw jeErr;
            const jeId = jeData[0].id;

            const lines = [];
            // Debit Salaries Expense (Gross)
            lines.push({ journal_entry_id: jeId, account_id: acctSalaries, debit_amount: register.totals.gross, credit_amount: 0 });

            // Credit Deductions
            if (acctSSS) lines.push({ journal_entry_id: jeId, account_id: acctSSS, debit_amount: 0, credit_amount: register.totals.sss });
            if (acctPHIC) lines.push({ journal_entry_id: jeId, account_id: acctPHIC, debit_amount: 0, credit_amount: register.totals.phic });
            if (acctHDMF) lines.push({ journal_entry_id: jeId, account_id: acctHDMF, debit_amount: 0, credit_amount: register.totals.hdmf });

            // Credit Accrued Payroll (Net Pay)
            lines.push({ journal_entry_id: jeId, account_id: acctPayable, debit_amount: 0, credit_amount: register.totals.net });

            const { error: linesErr } = await supabase.from('journal_lines').insert(lines);
            if (linesErr) throw linesErr;

            showToast(`Posted Journal Entry ${refNo} to GL. Gross: ₱${register.totals.gross.toLocaleString()}`, "success");
        } catch (error) {
            showToast("Error posting to GL: " + error.message, "error");
        }
    };

    // --- Phase 4: QR & GPS Utilities ---
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const handleAttendanceScan = async (decodedText) => {
        const nowMs = Date.now();
        if (nowMs - lastScanTime < 60000) {
            setScanResult({ status: 'warning', message: 'Scan already processed recently. Please wait 60 seconds.' });
            return;
        }

        setScanResult({ status: 'processing', message: 'Validating location...' });
        setLastScanTime(nowMs);

        if (!navigator.geolocation) {
            setScanResult({ status: 'error', message: 'Geolocation not supported by your browser.' });
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;

            let matchedLocation = null;
            for (const loc of attendanceLocations) {
                const dist = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
                if (dist <= loc.radius_meters) {
                    matchedLocation = loc;
                    break;
                }
            }

            if (!matchedLocation) {
                setScanResult({ status: 'error', message: `Scan rejected: Outside allowed premises. [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]` });
                return;
            }

            const emp = employees.find(e => e.employee_code === decodedText);
            if (!emp) {
                setScanResult({ status: 'error', message: 'Unknown Employee Code.' });
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();

            try {
                const { data: existingDTR } = await supabase.from('dtr_records')
                    .select('*')
                    .eq('employee_id', emp.id)
                    .eq('record_date', today)
                    .single();

                if (!existingDTR) {
                    await supabase.from('dtr_records').insert([{
                        employee_id: emp.id,
                        record_date: today,
                        time_in: now,
                        latitude_in: latitude,
                        longitude_in: longitude,
                        location_id_in: matchedLocation.id,
                        status: 'PRESENT'
                    }]);
                    setScanResult({ status: 'success', message: `Welcome Back, ${emp.first_name}! Time In recorded at ${matchedLocation.name}.` });
                } else if (!existingDTR.time_out) {
                    await supabase.from('dtr_records').update({
                        time_out: now,
                        latitude_out: latitude,
                        longitude_out: longitude,
                        location_id_out: matchedLocation.id
                    }).eq('id', existingDTR.id);
                    setScanResult({ status: 'success', message: `Goodbye, ${emp.first_name}! Time Out recorded at ${matchedLocation.name}.` });
                } else {
                    setScanResult({ status: 'warning', message: `${emp.first_name} has already recorded both Time In and Time Out for today.` });
                }
                queryClient.invalidateQueries({ queryKey: ['dtr_records'] });
            } catch (err) {
                setScanResult({ status: 'error', message: 'Database error: ' + err.message });
            }
        }, (err) => {
            setScanResult({ status: 'error', message: 'Geolocation error: ' + err.message });
        }, { enableHighAccuracy: true });
    };

    if (isLoadingLocal) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Processing...</div>;
    }

    const activeEmployeesCount = employees.filter(e => e.employment_status === 'ACTIVE').length;

    return (
        <div className="accounting-dashboard animation-fade-in" style={{ paddingBottom: '4rem' }}>
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2>Payroll & HR Management</h2>
                    <p>Manage headcount, daily time records, and payroll processing.</p>
                </div>
            </header>

            <div className="chrome-tabs-container">
                <button className={`chrome-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                    <Users size={16} /> Overview
                </button>
                <button className={`chrome-tab ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>
                    <UserPlus size={16} /> Employee Masterfile
                </button>
                <button className={`chrome-tab ${activeTab === 'dtr' ? 'active' : ''}`} onClick={() => setActiveTab('dtr')}>
                    <Calendar size={16} /> DTR Encoding
                </button>
                <button className={`chrome-tab ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
                    <ScanLine size={16} /> Scan Terminal
                </button>
                <button className={`chrome-tab ${activeTab === 'processing' ? 'active' : ''}`} onClick={() => setActiveTab('processing')}>
                    <DollarSign size={16} /> Payroll Register
                </button>
                <button className={`chrome-tab ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
                    <MapPin size={16} /> Location Settings
                </button>
            </div>

            {activeTab === 'dashboard' && (
                <div className="erp-content-section slide-down">
                    {employees.length === 0 && (
                        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '12px', borderLeft: '5px solid #3b82f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ fontSize: '1.5rem' }}>👋</div>
                                <div>
                                    <strong style={{ color: '#1e40af', display: 'block', marginBottom: '0.25rem' }}>Welcome to Payroll & HR</strong>
                                    <p style={{ color: '#1e40af', fontSize: '0.9rem', margin: 0 }}>
                                        No employees have been added yet. Go to <strong>Employee Masterfile</strong> to register your first employee and start managing payroll.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                        <div className="card metric-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' }}>
                            <div className="metric-icon" style={{ backgroundColor: '#eff6ff', color: '#3b82f6', padding: '1rem', borderRadius: '12px', display: 'flex' }}>
                                <Users size={28} />
                            </div>
                            <div className="metric-content">
                                <h3 className="metric-title" style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Active Employees</h3>
                                <p className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{activeEmployeesCount}</p>
                            </div>
                        </div>
                        <div className="card metric-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' }}>
                            <div className="metric-icon" style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1rem', borderRadius: '12px', display: 'flex' }}>
                                <Clock size={28} />
                            </div>
                            <div className="metric-content">
                                <h3 className="metric-title" style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>DTR Records (Mtd)</h3>
                                <p className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{dtrRecords.length}</p>
                            </div>
                        </div>
                        <div className="card metric-card" style={{ borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' }}>
                            <div className="metric-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '1rem', borderRadius: '12px', display: 'flex' }}>
                                <DollarSign size={28} />
                            </div>
                            <div className="metric-content">
                                <h3 className="metric-title" style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Est. Monthly Gross</h3>
                                <p className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>₱{(dtrRecords || []).reduce((sum, d) => {
                                    const emp = (employees || []).find(e => e.id === d.employee_id);
                                    if (!emp) return sum;
                                    const basicRate = Number(emp.basic_rate) || 0;
                                    const hourlyRate = emp.rate_type === 'HOURLY' ? basicRate : (emp.rate_type === 'DAILY' ? basicRate / 8 : basicRate / 160);
                                    const total = sum + (Number(d.regular_hours || 0) * hourlyRate) + (Number(d.overtime_hours || 0) * hourlyRate * 1.25);
                                    return total || 0;
                                }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                        <div className="card metric-card" style={{ borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' }}>
                            <div className="metric-icon" style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex' }}>
                                <AlertTriangle size={28} />
                            </div>
                            <div className="metric-content">
                                <h3 className="metric-title" style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Geofence Alerts</h3>
                                <p className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{dtrRecords.filter(d => d.status === 'OUTSIDE_GEOFENCE').length}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'employees' && (() => {
                const canViewOfficers = (userProfile?.role === 'Administrator' || userProfile?.role === 'Admin / Developer') ||
                    userProfile?.role === 'HR Manager' ||
                    userProfile?.role === 'Accounting Manager';
                const rankAndFile = employees.filter(e => e.employee_type !== 'OFFICER');
                const officers = employees.filter(e => e.employee_type === 'OFFICER');
                const displayList = empListTab === 'OFFICER' ? officers : rankAndFile;

                return (
                <div className="erp-content-section slide-down">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                        {/* Form */}
                        <div className="card" style={{ padding: '2rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', alignSelf: 'start' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#0f172a' }}>
                                {isEditingEmp ? <Edit size={20} className="text-blue-500" /> : <UserPlus size={20} className="text-green-500" />}
                                {isEditingEmp ? 'Edit Employee' : 'New Employee'}
                            </h4>
                            <div className="input-group"><label>Employee Code</label><input type="text" className="input-field" value={empForm.employee_code} onChange={e => setEmpForm({ ...empForm, employee_code: e.target.value })} placeholder="e.g. EMP-001" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group"><label>First Name</label><input type="text" className="input-field" value={empForm.first_name} onChange={e => setEmpForm({ ...empForm, first_name: e.target.value })} /></div>
                                <div className="input-group"><label>Last Name</label><input type="text" className="input-field" value={empForm.last_name} onChange={e => setEmpForm({ ...empForm, last_name: e.target.value })} /></div>
                            </div>
                            {/* Employee Type */}
                            <div className="input-group">
                                <label>Employee Classification</label>
                                <select className="input-field" value={empForm.employee_type || 'EMPLOYEE'} onChange={e => setEmpForm({ ...empForm, employee_type: e.target.value })}>
                                    <option value="EMPLOYEE">🏭 Rank & File / Regular Employee</option>
                                    <option value="OFFICER">👔 Officer / Management</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label>Rate Type</label>
                                    <select className="input-field" value={empForm.rate_type} onChange={e => setEmpForm({ ...empForm, rate_type: e.target.value })}>
                                        <option value="HOURLY">Hourly Local</option>
                                        <option value="DAILY">Daily Rated</option>
                                        <option value="MONTHLY">Monthly Salaried</option>
                                    </select>
                                </div>
                                <div className="input-group"><label>Base Rate (₱)</label><input type="number" className="input-field" value={empForm.basic_rate} onChange={e => setEmpForm({ ...empForm, basic_rate: e.target.value })} /></div>
                            </div>
                            <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={handleSaveEmployee}>
                                <Save size={18} /> {isEditingEmp ? 'Update Employee' : 'Create Employee'}
                            </button>
                        </div>

                        {/* Employee List with type tabs */}
                        <div>
                            {/* Tab switcher */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <button
                                    onClick={() => setEmpListTab('EMPLOYEE')}
                                    style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: `1px solid ${empListTab === 'EMPLOYEE' ? '#3b82f6' : 'var(--border-color)'}`, background: empListTab === 'EMPLOYEE' ? '#eff6ff' : 'none', color: empListTab === 'EMPLOYEE' ? '#1d4ed8' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                >🏭 Rank & File ({rankAndFile.length})</button>
                                {canViewOfficers && (
                                    <button
                                        onClick={() => setEmpListTab('OFFICER')}
                                        style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: `1px solid ${empListTab === 'OFFICER' ? '#8b5cf6' : 'var(--border-color)'}`, background: empListTab === 'OFFICER' ? '#f5f3ff' : 'none', color: empListTab === 'OFFICER' ? '#6d28d9' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                    >👔 Officers / Management ({officers.length})</button>
                                )}
                            </div>
                            <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                <table className="banana-table">
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>QR</th>
                                            <th>Name</th>
                                            <th>Classification</th>
                                            <th>Rate Type</th>
                                            <th>Rate</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayList.map(emp => (
                                            <tr key={emp.id}>
                                                <td>{emp.employee_code}</td>
                                                <td>
                                                    <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', color: '#1e293b' }}>
                                                        {emp.employee_code}
                                                    </div>
                                                </td>
                                                <td>{emp.last_name}, {emp.first_name}</td>
                                                <td>
                                                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, background: emp.employee_type === 'OFFICER' ? '#f5f3ff' : '#f0fdf4', color: emp.employee_type === 'OFFICER' ? '#6d28d9' : '#065f46' }}>
                                                        {emp.employee_type === 'OFFICER' ? '👔 Officer' : '🏭 Rank & File'}
                                                    </span>
                                                </td>
                                                <td><span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: '#e2e8f0', borderRadius: '4px' }}>{emp.rate_type}</span></td>
                                                <td>₱{emp.basic_rate}</td>
                                                <td><button onClick={() => handleEditEmployee(emp)}>Edit</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {activeTab === 'dtr' && (
                <div className="erp-content-section slide-down">
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-end', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="input-group" style={{ margin: 0, flex: 1, maxWidth: '250px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} /> Select Date</label>
                            <input type="date" className="input-field" value={dtrDate} onChange={e => setDtrDate(e.target.value)} style={{ padding: '0.6rem' }} />
                        </div>
                        <button className="btn-primary" onClick={handleSaveDTR} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}>
                            <Save size={18} /> Save DTR Entries
                        </button>
                    </div>
                    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <table className="banana-table">
                            <thead><tr><th>Employee Name</th><th>Attendance Status</th><th>Reg Hrs</th><th>OT Hrs</th></tr></thead>
                            <tbody>
                                {employees.filter(e => e.employment_status === 'ACTIVE').map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ fontWeight: 500 }}>{emp.last_name}, {emp.first_name}</td>
                                        <td>
                                            <select className="input-field" style={{ padding: '0.4rem', border: dtrEntries[emp.id]?.status === 'ABSENT' ? '1px solid #ef4444' : '1px solid #e2e8f0' }} value={dtrEntries[emp.id]?.status || 'PRESENT'} onChange={e => setDtrEntries({ ...dtrEntries, [emp.id]: { ...dtrEntries[emp.id], status: e.target.value } })}>
                                                <option value="PRESENT">✅ Present</option>
                                                <option value="ABSENT">❌ Absent</option>
                                                <option value="ON_LEAVE">🏖️ On Leave</option>
                                            </select>
                                        </td>
                                        <td><input type="number" className="input-field" style={{ width: '80px', padding: '0.4rem' }} value={dtrEntries[emp.id]?.regular_hours || 0} onChange={e => setDtrEntries({ ...dtrEntries, [emp.id]: { ...dtrEntries[emp.id], regular_hours: e.target.value } })} /></td>
                                        <td><input type="number" className="input-field" style={{ width: '80px', padding: '0.4rem' }} value={dtrEntries[emp.id]?.overtime_hours || 0} onChange={e => setDtrEntries({ ...dtrEntries, [emp.id]: { ...dtrEntries[emp.id], overtime_hours: e.target.value } })} /></td>
                                    </tr>
                                ))}
                                {employees.filter(e => e.employment_status === 'ACTIVE').length === 0 && (
                                    <tr><td colSpan="4" className="text-center" style={{ padding: '2rem', color: '#64748b' }}>No active employees found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'terminal' && (
                <div className="erp-content-section slide-down text-center">
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                                <ScanLine size={24} className="text-primary-main" /> Attendance Terminal
                            </h3>
                            <button className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowOverride(!showOverride)}>
                                {showOverride ? <React.Fragment><CheckCircle size={14} /> Close Manual Mode</React.Fragment> : <React.Fragment><Edit size={14} /> Supervisor Override</React.Fragment>}
                            </button>
                        </div>

                        {showOverride && (
                            <div className="card animation-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem', textAlign: 'left', background: '#fefce8' }}>
                                <h4 style={{ marginTop: 0 }}>Manual Time Adjustment</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label>Employee</label>
                                        <select className="input-field" value={overrideForm.empId} onChange={e => setOverrideForm({ ...overrideForm, empId: e.target.value })}>
                                            <option value="">Select Employee</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.last_name}, {e.first_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Log Type</label>
                                        <select className="input-field" value={overrideForm.type} onChange={e => setOverrideForm({ ...overrideForm, type: e.target.value })}>
                                            <option value="IN">Time In</option>
                                            <option value="OUT">Time Out</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Actual Time</label>
                                        <input type="datetime-local" className="input-field" value={overrideForm.time} onChange={e => setOverrideForm({ ...overrideForm, time: e.target.value })} />
                                    </div>
                                </div>
                                <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={async () => {
                                    if (!overrideForm.empId || !overrideForm.time) return showToast("Select employee and time.", "error");
                                    const d = overrideForm.time.split('T')[0];
                                    const t = new Date(overrideForm.time).toISOString();
                                    try {
                                        const { data: existing } = await supabase.from('dtr_records').select('*').eq('employee_id', overrideForm.empId).eq('record_date', d).single();
                                        if (overrideForm.type === 'IN') {
                                            if (existing) await supabase.from('dtr_records').update({ time_in: t, status: 'PRESENT' }).eq('id', existing.id);
                                            else await supabase.from('dtr_records').insert([{ employee_id: overrideForm.empId, record_date: d, time_in: t, status: 'PRESENT' }]);
                                        } else {
                                            if (existing) await supabase.from('dtr_records').update({ time_out: t }).eq('id', existing.id);
                                            else await supabase.from('dtr_records').insert([{ employee_id: overrideForm.empId, record_date: d, time_out: t, status: 'PRESENT' }]);
                                        }
                                        showToast("Manual log saved.", "success");
                                        queryClient.invalidateQueries({ queryKey: ['dtr_records'] });
                                    } catch (err) { showToast(err.message, "error"); }
                                }}>Save Adjustment</button>
                            </div>
                        )}

                        {!isScanning ? (
                            <div className="card" style={{ padding: '3rem', cursor: 'pointer', border: '2px dashed #cbd5e1', background: '#f8fafc', transition: 'all 0.2s' }} onClick={() => setIsScanning(true)} onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#64748b' }}>
                                    <ScanLine size={64} />
                                </div>
                                <h4 style={{ color: '#0f172a' }}>Open QR Scanner</h4>
                                <p style={{ color: '#64748b' }}>Tap here to start recording attendance via employee QR code.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '1rem', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <ScanComponent onScan={handleAttendanceScan} />
                                <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%', border: '1px solid #ef4444', color: '#ef4444' }} onClick={() => setIsScanning(false)}>Stop Scanner</button>
                            </div>
                        )}
                        {scanResult && (
                            <div className={`animation-fade-in`} style={{
                                marginTop: '1.5rem',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                background: scanResult.status === 'success' ? '#dcfce7' : (scanResult.status === 'error' ? '#fef2f2' : '#f1f5f9'),
                                color: scanResult.status === 'success' ? '#166534' : (scanResult.status === 'error' ? '#991b1b' : '#475569'),
                                fontWeight: 600,
                                textAlign: 'center',
                                border: '1px solid currentColor'
                            }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                    {scanResult.status === 'success' ? '✅' : (scanResult.status === 'error' ? '❌' : '⏳')}
                                </div>
                                {scanResult.message}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'processing' && (
                <div className="erp-content-section slide-down">
                    <div className="card" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', background: '#f8fafc', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ margin: 0, flex: 1, maxWidth: '200px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Start Date</label>
                            <input type="date" className="input-field" value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} style={{ padding: '0.6rem' }} />
                        </div>
                        <div className="input-group" style={{ margin: 0, flex: 1, maxWidth: '200px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> End Date</label>
                            <input type="date" className="input-field" value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} style={{ padding: '0.6rem' }} />
                        </div>
                        <button className="btn-primary" onClick={async () => {
                            if (!payPeriodStart || !payPeriodEnd) {
                                toast.warning("Please select a date range."); return;
                            }

                            setIsLoadingLocal(true);
                            try {
                                const { data: dtrs, error } = await supabase.from('dtr_records')
                                    .select('*')
                                    .gte('record_date', payPeriodStart)
                                    .lte('record_date', payPeriodEnd);
                                if (error) throw error;

                                const registerEntries = employees.filter(e => e.employment_status === 'ACTIVE').map(emp => {
                                    const personalDTR = dtrs.filter(d => d.employee_id === emp.id);
                                    const regHrs = personalDTR.reduce((sum, d) => sum + Number(d.regular_hours || 0), 0);
                                    const otHrs = personalDTR.reduce((sum, d) => sum + Number(d.overtime_hours || 0), 0);

                                    const hourlyRate = emp.rate_type === 'HOURLY' ? emp.basic_rate : (emp.rate_type === 'DAILY' ? emp.basic_rate / 8 : emp.basic_rate / 160);
                                    let gross = 0;

                                    // For monthly salaried, assume basic_rate is for the whole month, prorated manually for now, or just default to basic for demo. 
                                    // For now we calculate purely based on DTR hours for all to make it standard
                                    gross = (regHrs * hourlyRate) + (otHrs * hourlyRate * 1.25);

                                    // Statutory Deductions (Simplified 2% each for demonstration)
                                    const sss = gross * 0.02;
                                    const phic = gross * 0.02;
                                    const hdmf = 100; // Flat
                                    const deductions = sss + phic + hdmf;
                                    const net = gross - deductions;

                                    return {
                                        employee: `${emp.last_name}, ${emp.first_name}`,
                                        regHrs, otHrs, gross, sss, phic, hdmf, net
                                    };
                                });

                                const totals = registerEntries.reduce((acc, curr) => ({
                                    gross: acc.gross + curr.gross,
                                    net: acc.net + curr.net,
                                    sss: acc.sss + curr.sss,
                                    phic: acc.phic + curr.phic,
                                    hdmf: acc.hdmf + curr.hdmf
                                }), { gross: 0, net: 0, sss: 0, phic: 0, hdmf: 0 });

                                setPayrollRegister({ entries: registerEntries, totals, start: payPeriodStart, end: payPeriodEnd });
                            } catch (err) {
                                toast.error("Error generating payroll: " + err.message);
                            } finally {
                                setIsLoadingLocal(false);
                            }
                        }} style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={18} /> Generate Payroll Run
                        </button>
                    </div>
                    {payrollRegister && (
                        <div className="animation-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, color: '#0f172a' }}>Register Summary: {new Date(payrollRegister.start).toLocaleDateString()} - {new Date(payrollRegister.end).toLocaleDateString()}</h3>
                                <button className="btn-primary" onClick={() => handlePostToGL(payrollRegister)} style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle size={16} /> Post to General Ledger
                                </button>
                            </div>
                            <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                <table className="banana-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th className="text-right">Hrs (Reg/OT)</th>
                                            <th className="text-right">Gross</th>
                                            <th className="text-right">SSS</th>
                                            <th className="text-right">PHIC</th>
                                            <th className="text-right">HDMF</th>
                                            <th className="text-right">Net Pay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payrollRegister.entries.map((entry, idx) => (
                                            <tr key={idx}>
                                                <td>{entry.employee}</td>
                                                <td className="text-right">{entry.regHrs} / {entry.otHrs}</td>
                                                <td className="text-right">₱{entry.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right">₱{entry.sss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right">₱{entry.phic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right">₱{entry.hdmf.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right" style={{ fontWeight: 'bold' }}>₱{entry.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                                            <td>TOTAL</td>
                                            <td className="text-right">-</td>
                                            <td className="text-right">₱{payrollRegister.totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right">₱{payrollRegister.totals.sss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right">₱{payrollRegister.totals.phic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right">₱{payrollRegister.totals.hdmf.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right">₱{payrollRegister.totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'locations' && (
                <div className="erp-content-section slide-down">
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#0f172a' }}>
                            <MapPin size={20} className="text-blue-500" /> New Geofence Location
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1fr 1fr 120px auto', gap: '1rem', alignItems: 'end' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label>Location Name</label>
                                <input type="text" id="ln" placeholder="e.g. Main Farm Entrance" className="input-field" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label>Latitude</label>
                                <input type="number" id="la" placeholder="7.12345" className="input-field" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label>Longitude</label>
                                <input type="number" id="lo" placeholder="125.12345" className="input-field" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label>Radius (m)</label>
                                <input type="number" id="ra" placeholder="100" className="input-field" defaultValue="100" />
                            </div>
                            <button className="btn-primary" onClick={async () => {
                                const n = document.getElementById('ln').value;
                                const la = document.getElementById('la').value;
                                const lo = document.getElementById('lo').value;
                                const ra = document.getElementById('ra').value;
                                if (!n || !la || !lo) return showToast('Please enter name, lat, and lon.', 'error');
                                const { error } = await supabase.from('attendance_locations').insert([{ name: n, latitude: la, longitude: lo, radius_meters: ra }]);
                                if (error) {
                                    showToast("Error adding location: " + error.message, "error");
                                } else {
                                    showToast("Location added successfully.", "success");
                                    queryClient.invalidateQueries({ queryKey: ['attendance_locations'] });
                                    document.getElementById('ln').value = '';
                                    document.getElementById('la').value = '';
                                    document.getElementById('lo').value = '';
                                }
                            }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', height: 'fit-content' }}>
                                <Save size={18} /> Add
                            </button>
                        </div>
                    </div>
                    <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <table className="banana-table">
                            <thead><tr><th>Location Name</th><th>GPS Coordinates</th><th>Allowed Radius</th></tr></thead>
                            <tbody>
                                {attendanceLocations.map(l => (
                                    <tr key={l.id}>
                                        <td style={{ fontWeight: 500 }}>{l.name}</td>
                                        <td style={{ fontFamily: 'monospace' }}>[{l.latitude}, {l.longitude}]</td>
                                        <td>{l.radius_meters} meters</td>
                                    </tr>
                                ))}
                                {attendanceLocations.length === 0 && (
                                    <tr><td colSpan="3" className="text-center" style={{ padding: '2rem', color: '#64748b' }}>No locations specified yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const ScanComponent = ({ onScan }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        let scanner;
        
        const initScanner = async () => {
            try {
                if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                    const { Camera } = await import('@capacitor/camera');
                    const perms = await Camera.checkPermissions();
                    if (perms.camera !== 'granted') {
                        await Camera.requestPermissions({ permissions: ['camera'] });
                    }
                }
            } catch (e) {
                console.warn('Camera permission check skipped (web):', e);
            }

            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                
                // Initialize directly instead of using the pre-built Scanner UI
                scanner = new Html5Qrcode("reader");
                scannerRef.current = scanner;
                
                // Request 'environment' (back) camera directly
                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        // Success callback
                        if (scannerRef.current) {
                            scannerRef.current.stop().then(() => {
                                onScan(decodedText);
                            }).catch(err => {
                                console.log("Failed to stop scanner", err);
                                onScan(decodedText);
                            });
                        }
                    },
                    (errorMessage) => {
                        // ignore background scan errors 
                    }
                );
            } catch (err) {
                console.error('QR scanner failed to start:', err);
                if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                    toast.error('Camera could not start. Please ensure the app has permission in Android Settings.');
                }
            }
        };
        initScanner();

        return () => {
            if (scannerRef.current) {
                // Ignore stop errors on unmount
                scannerRef.current.stop().catch(() => {}).finally(() => {
                    scannerRef.current.clear();
                });
            }
        };
    }, [onScan]);

    return <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}></div>;
};

export default Payroll;
