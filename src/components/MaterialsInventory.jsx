import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Printer, Plus, Edit2, Archive, AlertTriangle, TrendingUp, TrendingDown, Box, Trash2, ListPlus, Warehouse, Tractor, ChevronDown } from 'lucide-react';
import './MaterialsInventory.css';
import './Accounting.css'; // for chrome-tabs

const MaterialsInventory = ({ inventoryItems = [], setInventoryItems, farms = [] }) => {
    const [activeView, setActiveView] = useState('global'); // 'global' | 'farm'
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
    const [editItemId, setEditItemId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);

    // Farm Allocation State (stored locally in localStorage for persistence without DB schema change)
    const [allocations, setAllocations] = useState(() => {
        try { return JSON.parse(localStorage.getItem('farm_material_allocations') || '[]'); } catch { return []; }
    });
    const [allocForm, setAllocForm] = useState({ date: new Date().toISOString().split('T')[0], farmCode: '', itemCode: '', quantity: '', referenceNo: '' });
    const [farmFilter, setFarmFilter] = useState('ALL');
    const [itemFilter, setItemFilter] = useState('ALL');

    const saveAllocations = (newAllocations) => {
        setAllocations(newAllocations);
        localStorage.setItem('farm_material_allocations', JSON.stringify(newAllocations));
    };

    const handleRecordAllocation = () => {
        if (!allocForm.farmCode || !allocForm.itemCode || !allocForm.quantity) {
            alert('Farm, Material, and Quantity are required.'); return;
        }
        const newEntry = { id: Date.now().toString(), ...allocForm, quantity: Number(allocForm.quantity) };
        saveAllocations([newEntry, ...allocations]);
        setAllocForm({ date: new Date().toISOString().split('T')[0], farmCode: '', itemCode: '', quantity: '', referenceNo: '' });
    };

    const handleDeleteAllocation = (id) => {
        if (window.confirm('Remove this dispatch record?')) saveAllocations(allocations.filter(a => a.id !== id));
    };

    const initialItemState = {
        item_code: '',
        item_name: '',
        supplier_details: '',
        pricing_details: '',
        stock_in: 0,
        stock_out: 0
    };

    const [newItem, setNewItem] = useState(initialItemState);
    const [batchItems, setBatchItems] = useState([{ ...initialItemState }]);

    const handleBatchInputChange = (index, e) => {
        const { name, value, type } = e.target;
        const newBatch = [...batchItems];
        const newValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;

        let updatedRow = {
            ...newBatch[index],
            [name]: newValue
        };

        if (name === 'item_code') {
            const existingItem = inventoryItems.find(item => item.item_code === newValue);
            if (existingItem) {
                updatedRow = {
                    ...updatedRow,
                    id: existingItem.id,
                    item_name: existingItem.item_name || '',
                    supplier_details: existingItem.supplier_details || '',
                    pricing_details: existingItem.pricing_details || '',
                    existing_stock_in: existingItem.stock_in || 0,
                    existing_stock_out: existingItem.stock_out || 0,
                    stock_in: 0,
                    stock_out: 0
                };
            } else {
                delete updatedRow.id;
                delete updatedRow.existing_stock_in;
                delete updatedRow.existing_stock_out;
            }
        }

        newBatch[index] = updatedRow;
        setBatchItems(newBatch);
    };

    const addBatchRow = () => {
        setBatchItems([...batchItems, { ...initialItemState }]);
    };

    const removeBatchRow = (index) => {
        const newBatch = batchItems.filter((_, i) => i !== index);
        setBatchItems(newBatch.length ? newBatch : [{ ...initialItemState }]);
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);

        const payloads = batchItems
            .filter(item => item.item_code && item.item_code.toString().trim() && item.item_name && item.item_name.toString().trim())
            .map(item => {
                const { existing_stock_in, existing_stock_out, ...rest } = item;
                const final_stock_in = (existing_stock_in || 0) + (Number(item.stock_in) || 0);
                const final_stock_out = (existing_stock_out || 0) + (Number(item.stock_out) || 0);

                return {
                    ...rest,
                    stock_in: final_stock_in,
                    stock_out: final_stock_out,
                    last_updated: new Date().toISOString()
                };
            });

        if (payloads.length === 0) {
            setErrorMsg("⚠️ Batch Error: No valid items to submit. Ensure Code and Name are filled.");
            return;
        }

        const { data, error } = await supabase
            .from('materials_inventory')
            .upsert(payloads)
            .select();

        if (error) {
            console.error("Batch Upsert error:", error);
            setErrorMsg(`⚠️ Batch Database Error: ${error.message || error.details}`);
            return;
        }

        if (data && data.length > 0) {
            setInventoryItems(prev => {
                const newDataIds = data.map(d => d.id);
                const filteredPrev = prev.filter(p => !newDataIds.includes(p.id));
                return [...data, ...filteredPrev];
            });
            closeBatchModal();
        }
    };

    const closeBatchModal = () => {
        setIsBatchFormOpen(false);
        setBatchItems([{ ...initialItemState }]);
        setErrorMsg(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setNewItem(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
        }));
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        setErrorMsg(null);

        const payload = {
            ...newItem,
            last_updated: new Date().toISOString()
        };

        if (editItemId) {
            const { data, error } = await supabase
                .from('materials_inventory')
                .update(payload)
                .eq('id', editItemId)
                .select();

            if (error) {
                console.error("Update error:", error);
                setErrorMsg(`⚠️ Update Failed: ${error.message || error.details}`);
                return;
            }

            if (data && data.length > 0) {
                setInventoryItems(prev => prev.map(i => i.id === editItemId ? data[0] : i));
                closeModal();
            }
        } else {
            const { data, error } = await supabase
                .from('materials_inventory')
                .insert([payload])
                .select();

            if (error) {
                console.error("Insert error:", error);
                setErrorMsg(`⚠️ Database Error: ${error.message || error.details}`);
                return;
            }

            if (data && data.length > 0) {
                setInventoryItems(prev => [data[0], ...prev]);
                closeModal();
            }
        }
    };

    const handleEditClick = (item) => {
        setEditItemId(item.id);
        setNewItem({
            item_code: item.item_code,
            item_name: item.item_name,
            supplier_details: item.supplier_details || '',
            pricing_details: item.pricing_details || '',
            stock_in: item.stock_in || 0,
            stock_out: item.stock_out || 0
        });
        setIsFormOpen(true);
    };

    const closeModal = () => {
        setIsFormOpen(false);
        setEditItemId(null);
        setNewItem(initialItemState);
        setErrorMsg(null);
    };

    const handlePrintReport = () => {
        const printWindow = window.open('', '_blank');
        const printContent = `
            <html>
                <head>
                    <title>Materials Inventory Report</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 2rem; color: #1e293b; }
                        h1 { color: #166534; font-size: 1.5rem; text-align: center; margin-bottom: 2rem; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                        th, td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }
                        th { background-color: #f1f5f9; font-weight: 600; }
                        .text-right { text-align: right; }
                        .print-footer { margin-top: 3rem; text-align: right; font-size: 0.85rem; color: #64748b; }
                    </style>
                </head>
                <body>
                    <h1>LAVC Materials Inventory Report</h1>
                    <p><strong>Generated At:</strong> ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item Code</th>
                                <th>Item Name</th>
                                <th>Supplier</th>
                                <th>Pricing</th>
                                <th class="text-right">Stock In</th>
                                <th class="text-right">Stock Out</th>
                                <th class="text-right">Stock On Hand</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inventoryItems.map(item => `
                                <tr>
                                    <td>${item.item_code}</td>
                                    <td>${item.item_name}</td>
                                    <td>${item.supplier_details || 'N/A'}</td>
                                    <td>${item.pricing_details || 'N/A'}</td>
                                    <td class="text-right">${item.stock_in || 0}</td>
                                    <td class="text-right">${item.stock_out || 0}</td>
                                    <td class="text-right"><strong>${(item.stock_in || 0) - (item.stock_out || 0)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="print-footer">
                        Generated by LAVC Banana Tracker
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    // Derived Metrics & Search Filtering
    const totalItemsCount = inventoryItems.length;
    const totalStockVal = inventoryItems.reduce((acc, curr) => acc + ((curr.stock_in || 0) - (curr.stock_out || 0)), 0);
    const lowStockCount = inventoryItems.filter(i => ((i.stock_in || 0) - (i.stock_out || 0)) <= 0).length;

    const filteredItems = useMemo(() => {
        if (!searchQuery) return inventoryItems;
        const lowerSearch = searchQuery.toLowerCase();
        return inventoryItems.filter(item =>
            (item.item_name && item.item_name.toLowerCase().includes(lowerSearch)) ||
            (item.item_code && item.item_code.toLowerCase().includes(lowerSearch))
        );
    }, [inventoryItems, searchQuery]);

    return (
        <div className="materials-inventory-page animation-fade-in" style={{ padding: '1.5rem' }}>

            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Package size={28} color="var(--color-primary-dark)" />
                        Materials Inventory
                    </h2>
                    <p style={{ color: 'var(--text-tertiary)', margin: '0.25rem 0 0 calc(28px + 0.75rem)', fontSize: '0.95rem' }}>Track packaging materials, supplies, pricing, and exact stock levels.</p>
                </div>
            </div>

            {/* Chrome-style Tab Switcher */}
            <div className="chrome-tabs-container" style={{ marginBottom: '1.5rem' }}>
                <button className={`chrome-tab ${activeView === 'global' ? 'active' : ''}`} onClick={() => setActiveView('global')}>
                    <Warehouse size={16} /> Global Stock
                </button>
                <button className={`chrome-tab ${activeView === 'farm' ? 'active' : ''}`} onClick={() => setActiveView('farm')}>
                    <Tractor size={16} /> Farm Allocations
                </button>
            </div>

            {/* === GLOBAL STOCK VIEW === */}
            {activeView === 'global' && (
                <div className="animation-fade-in">
                    {/* Metrics Dashboard */}
                    <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                        <div className="metric-card">
                            <div className="metric-icon blue"><Box size={24} /></div>
                            <div className="metric-content">
                                <span className="metric-label">Total Unique Items</span>
                                <span className="metric-value">{totalItemsCount}</span>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-icon green"><Archive size={24} /></div>
                            <div className="metric-content">
                                <span className="metric-label">Cumulative Stock (On Hand)</span>
                                <span className="metric-value">{totalStockVal.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-icon red"><AlertTriangle size={24} /></div>
                            <div className="metric-content">
                                <span className="metric-label">Low / Out of Stock</span>
                                <span className="metric-value">{lowStockCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="card content-section" style={{ padding: 0, overflow: 'hidden' }}>

                        {/* Search & Actions Ribbon */}
                        <div className="inventory-controls">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search by code or item name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn-secondary" onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Printer size={16} /> Print Full Report
                                </button>
                                <button className="btn-secondary" onClick={() => setIsBatchFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }}>
                                    <ListPlus size={18} /> Batch Entry
                                </button>
                                <button className="btn-primary" onClick={() => setIsFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(42,90,53,0.3)' }}>
                                    <Plus size={18} /> Register New Item
                                </button>
                            </div>
                        </div>

                        {/* Table View */}
                        <div className="table-responsive">
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Item Identification</th>
                                        <th>Procurement Details</th>
                                        <th className="text-right">Total In</th>
                                        <th className="text-right">Total Out</th>
                                        <th className="text-right" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderBottom: '2px solid #bbf7d0' }}>Stock Balance</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length > 0 ? (
                                        filteredItems.map(item => {
                                            const onHand = (item.stock_in || 0) - (item.stock_out || 0);
                                            const isLow = onHand <= 0;

                                            return (
                                                <tr key={item.id} className={isLow ? 'bg-error-light' : ''}>
                                                    <td>
                                                        <div className="cell-primary" style={{ fontWeight: '700', fontSize: '1.05rem', color: isLow ? '#b91c1c' : '#0f172a' }}>
                                                            {isLow && <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', position: 'relative', top: '2px' }} />}
                                                            {item.item_name}
                                                        </div>
                                                        <div className="badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                                                            <Box size={12} /> {item.item_code}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="cell-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {item.supplier_details || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No supplier listed</span>}
                                                        </div>
                                                        <div className="cell-secondary" style={{ marginTop: '0.2rem' }}>
                                                            <span style={{ fontWeight: 600 }}>Price:</span> {item.pricing_details || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontWeight: 600 }}>
                                                            {item.stock_in || 0} <TrendingUp size={14} />
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 600 }}>
                                                            {item.stock_out || 0} <TrendingDown size={14} />
                                                        </div>
                                                    </td>
                                                    <td className="text-right highlight-col" style={{ background: '#f8fafc', fontWeight: '800', fontSize: '1.25rem', color: isLow ? '#ef4444' : '#10b981' }}>
                                                        {onHand}
                                                    </td>
                                                    <td className="text-center">
                                                        <button className="btn-secondary btn-sm" onClick={() => handleEditClick(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <Edit2 size={14} /> Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                                                <Package size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                                                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#64748b' }}>No materials found.</p>
                                                {searchQuery && <p style={{ fontSize: '0.9rem' }}>Try clearing your search query.</p>}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* === FARM ALLOCATIONS VIEW === */}
            {activeView === 'farm' && (
                <div className="animation-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                    {/* LEFT: Dispatch Form */}
                    <div className="card" style={{ padding: '2rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', alignSelf: 'start' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#0f172a' }}>
                            <Tractor size={20} style={{ color: '#16a34a' }} /> Dispatch to Farm
                        </h4>
                        <div className="input-group">
                            <label>Date</label>
                            <input type="date" className="input-field" value={allocForm.date} onChange={e => setAllocForm({ ...allocForm, date: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Farm / Grower</label>
                            <select className="input-field" value={allocForm.farmCode} onChange={e => setAllocForm({ ...allocForm, farmCode: e.target.value })}>
                                <option value="">-- Select Farm --</option>
                                {farms.map(f => (
                                    <option key={f.id || f.farmCode} value={f.farmCode || f.code}>{f.farmCode || f.code} – {f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Material</label>
                            <select className="input-field" value={allocForm.itemCode} onChange={e => setAllocForm({ ...allocForm, itemCode: e.target.value })}>
                                <option value="">-- Select Material --</option>
                                {inventoryItems.map(item => (
                                    <option key={item.id} value={item.item_code}>{item.item_code} – {item.item_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Quantity</label>
                            <input type="number" className="input-field" value={allocForm.quantity} onChange={e => setAllocForm({ ...allocForm, quantity: e.target.value })} placeholder="e.g. 200" />
                        </div>
                        <div className="input-group">
                            <label>Reference / DR No.</label>
                            <input type="text" className="input-field" value={allocForm.referenceNo} onChange={e => setAllocForm({ ...allocForm, referenceNo: e.target.value })} placeholder="Optional" />
                        </div>
                        <button className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={handleRecordAllocation}>
                            <Plus size={18} /> Record Dispatch
                        </button>
                    </div>

                    {/* RIGHT: Balances + History */}
                    <div>
                        {/* Filter Row */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                                <label style={{ fontSize: '0.8rem' }}>Filter by Farm</label>
                                <select className="input-field" value={farmFilter} onChange={e => setFarmFilter(e.target.value)}>
                                    <option value="ALL">All Farms</option>
                                    {[...new Set(allocations.map(a => a.farmCode))].map(code => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                                <label style={{ fontSize: '0.8rem' }}>Filter by Material</label>
                                <select className="input-field" value={itemFilter} onChange={e => setItemFilter(e.target.value)}>
                                    <option value="ALL">All Materials</option>
                                    {inventoryItems.map(item => (
                                        <option key={item.id} value={item.item_code}>{item.item_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Per-Farm, Per-Material Balance Summary */}
                        <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, color: '#0f172a' }}>Farm Material Balances</h4>
                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Total dispatched vs. what's still in their hands</span>
                            </div>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Farm</th>
                                        <th>Material</th>
                                        <th className="text-right">Dispatched</th>
                                        <th className="text-right">Used (returned)</th>
                                        <th className="text-right">Balance Left</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Build summary per farm x item
                                        const summary = {};
                                        allocations.forEach(a => {
                                            const key = `${a.farmCode}__${a.itemCode}`;
                                            if (!summary[key]) summary[key] = { farmCode: a.farmCode, itemCode: a.itemCode, dispatched: 0 };
                                            summary[key].dispatched += a.quantity;
                                        });

                                        const rows = Object.values(summary)
                                            .filter(r => (farmFilter === 'ALL' || r.farmCode === farmFilter) && (itemFilter === 'ALL' || r.itemCode === itemFilter));

                                        if (rows.length === 0) {
                                            return <tr><td colSpan="5" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>No allocations recorded yet. Use the form to dispatch materials.</td></tr>;
                                        }

                                        return rows.map((row, idx) => {
                                            const item = inventoryItems.find(i => i.item_code === row.itemCode);
                                            const farmName = farms.find(f => (f.farmCode || f.code) === row.farmCode)?.name || row.farmCode;
                                            const balance = row.dispatched; // Used = 0 for now; can add return tracking later
                                            const isLow = balance <= 0;
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.farmCode}<div style={{ fontSize: '0.75rem', color: '#64748b' }}>{farmName}</div></td>
                                                    <td>{item?.item_name || row.itemCode}</td>
                                                    <td className="text-right" style={{ color: '#16a34a', fontWeight: 600 }}>{row.dispatched} pcs</td>
                                                    <td className="text-right" style={{ color: '#f59e0b' }}>0 pcs</td>
                                                    <td className="text-right" style={{ fontWeight: 800, fontSize: '1.1rem', color: isLow ? '#ef4444' : '#0f172a' }}>{balance} pcs</td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>

                        {/* Dispatch History Log */}
                        <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: 0, color: '#0f172a' }}>Dispatch History</h4>
                            </div>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Farm</th>
                                        <th>Material</th>
                                        <th className="text-right">Qty</th>
                                        <th>Reference</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations
                                        .filter(a => (farmFilter === 'ALL' || a.farmCode === farmFilter) && (itemFilter === 'ALL' || a.itemCode === itemFilter))
                                        .map(a => (
                                            <tr key={a.id}>
                                                <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{a.date}</td>
                                                <td style={{ fontWeight: 600 }}>{a.farmCode}</td>
                                                <td>{inventoryItems.find(i => i.item_code === a.itemCode)?.item_name || a.itemCode}</td>
                                                <td className="text-right" style={{ fontWeight: 600, color: '#16a34a' }}>+{a.quantity}</td>
                                                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{a.referenceNo || '—'}</td>
                                                <td>
                                                    <button onClick={() => handleDeleteAllocation(a.id)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {allocations.filter(a => (farmFilter === 'ALL' || a.farmCode === farmFilter) && (itemFilter === 'ALL' || a.itemCode === itemFilter)).length === 0 && (
                                        <tr><td colSpan="6" className="text-center" style={{ padding: '2rem', color: '#64748b' }}>No records.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Editing / Creation Modal */}
            {isBatchFormOpen && (
                <div className="inventory-form-overlay" onClick={closeBatchModal}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
                        <div className="form-modal-header">
                            <h3>
                                <ListPlus size={20} color="var(--color-primary-dark)" />
                                Batch Register Materials
                            </h3>
                            <button onClick={closeBatchModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>
                        <div className="form-modal-body">
                            {errorMsg && (
                                <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem' }}>
                                    {errorMsg}
                                </div>
                            )}
                            <form id="batchInventoryForm" onSubmit={handleBatchSubmit}>
                                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                                    <table className="banana-table" style={{ minWidth: '1000px', fontSize: '0.9rem', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '12%' }}>Code *</th>
                                                <th style={{ width: '28%' }}>Name *</th>
                                                <th style={{ width: '20%' }}>Supplier</th>
                                                <th style={{ width: '15%' }}>Price Details</th>
                                                <th style={{ width: '10%' }}>Stock IN</th>
                                                <th style={{ width: '10%' }}>Stock OUT</th>
                                                <th style={{ width: '5%', textAlign: 'center' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchItems.map((item, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <input type="text" name="item_code" className="input-field" value={item.item_code} onChange={(e) => handleBatchInputChange(index, e)} required placeholder="Code" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '80px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td>
                                                        <input type="text" name="item_name" className="input-field" value={item.item_name} onChange={(e) => handleBatchInputChange(index, e)} required placeholder="Name" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '120px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td>
                                                        <input type="text" name="supplier_details" className="input-field" value={item.supplier_details} onChange={(e) => handleBatchInputChange(index, e)} placeholder="Supplier" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '100px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td>
                                                        <input type="text" name="pricing_details" className="input-field" value={item.pricing_details} onChange={(e) => handleBatchInputChange(index, e)} placeholder="Price" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '90px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td>
                                                        <input type="number" name="stock_in" className="input-field" value={item.stock_in} onChange={(e) => handleBatchInputChange(index, e)} placeholder="0" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '70px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td>
                                                        <input type="number" name="stock_out" className="input-field" value={item.stock_out} onChange={(e) => handleBatchInputChange(index, e)} placeholder="0" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', minWidth: '70px', boxSizing: 'border-box' }} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button type="button" onClick={() => removeBatchRow(index)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remove Row">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                                    <button type="button" onClick={addBatchRow} style={{ background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.75rem 2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                                        <Plus size={16} /> Add Another Material
                                    </button>
                                </div>
                                <div className="form-modal-footer" style={{ margin: '0 -2rem -2rem -2rem', padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={closeBatchModal} style={{ padding: '0.6rem 1.2rem' }}>Cancel</button>
                                    <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        Save Batch ({batchItems.length})
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing / Creation Modal */}
            {isFormOpen && (
                <div className="inventory-form-overlay" onClick={closeModal}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()}>
                        <div className="form-modal-header">
                            <h3>
                                {editItemId ? <Edit2 size={20} color="var(--color-primary-dark)" /> : <Plus size={20} color="var(--color-primary-dark)" />}
                                {editItemId ? 'Manage Inventory Item' : 'Register New Item'}
                            </h3>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>

                        <div className="form-modal-body">
                            {errorMsg && (
                                <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem' }}>
                                    {errorMsg}
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                                        Check if the Supabase table has been created using the SQL script.
                                    </div>
                                </div>
                            )}
                            <form id="inventoryForm" onSubmit={handleAddItem}>
                                <div className="grid-2">
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="label">Materials Name <span style={{ color: 'red' }}>*</span></label>
                                        <input type="text" name="item_name" className="input-field" value={newItem.item_name} onChange={handleInputChange} required placeholder="e.g. LFJ BOX COVER WHITE 13kg" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Item Code <span style={{ color: 'red' }}>*</span></label>
                                        <input type="text" name="item_code" className="input-field" value={newItem.item_code} onChange={handleInputChange} required placeholder="e.g. 0001" disabled={!!editItemId} style={{ background: editItemId ? '#f1f5f9' : '#fff' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Pricing/Unit Config</label>
                                        <input type="text" name="pricing_details" className="input-field" value={newItem.pricing_details} onChange={handleInputChange} placeholder="E.g. Php 45.00 / piece" />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="label">Supplier Info</label>
                                        <input type="text" name="supplier_details" className="input-field" value={newItem.supplier_details} onChange={handleInputChange} placeholder="Supplier name or contact" />
                                    </div>

                                    {/* Stock Adjustments Layered */}
                                    <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                        <label className="label" style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <TrendingUp size={16} /> Total Stock IN
                                        </label>
                                        <input type="number" name="stock_in" className="input-field" value={newItem.stock_in} onChange={handleInputChange} placeholder="Cumulative received" />
                                    </div>

                                    <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px' }}>
                                        <label className="label" style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <TrendingDown size={16} /> Total Stock OUT
                                        </label>
                                        <input type="number" name="stock_out" className="input-field" value={newItem.stock_out} onChange={handleInputChange} placeholder="Cumulative requested/used" />
                                    </div>
                                </div>

                                <div className="form-modal-footer" style={{ margin: '2rem -2rem -2rem -2rem', padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={closeModal} style={{ padding: '0.6rem 1.2rem' }}>Cancel</button>
                                    <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {editItemId ? 'Save Changes' : 'Register Material'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default MaterialsInventory;
