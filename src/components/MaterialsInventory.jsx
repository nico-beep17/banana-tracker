import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Printer, Plus, Edit2, Archive, AlertTriangle, TrendingUp, TrendingDown, Box, Trash2, ListPlus, Warehouse, Tractor, ChevronDown, ChevronRight } from 'lucide-react';
import './MaterialsInventory.css';
import './Accounting.css'; // for chrome-tabs

const MaterialsInventory = ({ inventoryItems = [], setInventoryItems, farms = [] }) => {
    const [activeView, setActiveView] = useState('global'); // 'global' | 'farm'
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
    const [editItemId, setEditItemId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);

    // Farm Allocation State
    // allocations = dispatch records (what we deliver FROM warehouse TO farm for a specific operation)
    const [allocations, setAllocations] = useState(() => {
        try { return JSON.parse(localStorage.getItem('farm_material_allocations') || '[]'); } catch { return []; }
    });
    const [farmFilter, setFarmFilter] = useState('ALL');

    // Expanded farm in per-farm view
    const [expandedFarm, setExpandedFarm] = useState(null);

    // Bulk dispatch form: one farm, multiple items
    const [isBulkDispatchOpen, setIsBulkDispatchOpen] = useState(false);
    const [bulkDispatchFarm, setBulkDispatchFarm] = useState('');
    const [bulkDispatchRef, setBulkDispatchRef] = useState('');
    const [bulkDispatchDate, setBulkDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkDispatchItems, setBulkDispatchItems] = useState([{ itemCode: '', quantity: '' }]);

    const saveAllocations = (newAllocations) => {
        setAllocations(newAllocations);
        localStorage.setItem('farm_material_allocations', JSON.stringify(newAllocations));
    };

    // Total dispatched per item (for Global Stock calculation)
    const totalDispatchedPerItem = useMemo(() => {
        const result = {};
        allocations.forEach(a => {
            if (!result[a.itemCode]) result[a.itemCode] = 0;
            result[a.itemCode] += a.quantity;
        });
        return result;
    }, [allocations]);

    // Warehouse-only stock (Global Stock = total in - total out - total dispatched to farms)
    const warehouseStock = useMemo(() => {
        return inventoryItems.map(item => {
            const totalIn = item.stock_in || 0;
            const totalOut = item.stock_out || 0;
            const dispatched = totalDispatchedPerItem[item.item_code] || 0;
            return {
                ...item,
                warehouseBalance: totalIn - totalOut - dispatched
            };
        });
    }, [inventoryItems, totalDispatchedPerItem]);

    // Per-farm balance per item
    const farmBalances = useMemo(() => {
        // { farmCode: { itemCode: dispatched } }
        const result = {};
        allocations.forEach(a => {
            if (!result[a.farmCode]) result[a.farmCode] = {};
            if (!result[a.farmCode][a.itemCode]) result[a.farmCode][a.itemCode] = 0;
            result[a.farmCode][a.itemCode] += a.quantity;
        });
        return result;
    }, [allocations]);

    // Farms that have at least one dispatch record
    const farmsWithAllocations = useMemo(() => {
        const codes = [...new Set(allocations.map(a => a.farmCode))];
        return codes;
    }, [allocations]);

    // Bulk dispatch handlers
    const addBulkItem = () => setBulkDispatchItems(prev => [...prev, { itemCode: '', quantity: '' }]);
    const removeBulkItem = (idx) => setBulkDispatchItems(prev => prev.filter((_, i) => i !== idx));
    const updateBulkItem = (idx, field, value) => {
        setBulkDispatchItems(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const handleBulkDispatch = () => {
        if (!bulkDispatchFarm) { alert('Please select a farm.'); return; }
        const validItems = bulkDispatchItems.filter(it => it.itemCode && it.quantity > 0);
        if (validItems.length === 0) { alert('Add at least one item with qty > 0.'); return; }

        const newEntries = validItems.map(it => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date: bulkDispatchDate,
            farmCode: bulkDispatchFarm,
            itemCode: it.itemCode,
            quantity: Number(it.quantity),
            referenceNo: bulkDispatchRef
        }));
        saveAllocations([...newEntries, ...allocations]);
        setIsBulkDispatchOpen(false);
        setBulkDispatchFarm('');
        setBulkDispatchRef('');
        setBulkDispatchDate(new Date().toISOString().split('T')[0]);
        setBulkDispatchItems([{ itemCode: '', quantity: '' }]);
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
        let updatedRow = { ...newBatch[index], [name]: newValue };
        if (name === 'item_code') {
            const existingItem = inventoryItems.find(item => item.item_code === newValue);
            if (existingItem) {
                updatedRow = {
                    ...updatedRow, id: existingItem.id,
                    item_name: existingItem.item_name || '',
                    supplier_details: existingItem.supplier_details || '',
                    pricing_details: existingItem.pricing_details || '',
                    existing_stock_in: existingItem.stock_in || 0,
                    existing_stock_out: existingItem.stock_out || 0,
                    stock_in: 0, stock_out: 0
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

    const addBatchRow = () => setBatchItems([...batchItems, { ...initialItemState }]);
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
                return {
                    ...rest,
                    stock_in: (existing_stock_in || 0) + (Number(item.stock_in) || 0),
                    stock_out: (existing_stock_out || 0) + (Number(item.stock_out) || 0),
                    last_updated: new Date().toISOString()
                };
            });
        if (payloads.length === 0) { setErrorMsg('⚠️ No valid items to submit.'); return; }
        const { data, error } = await supabase.from('materials_inventory').upsert(payloads).select();
        if (error) { setErrorMsg(`⚠️ ${error.message}`); return; }
        if (data && data.length > 0) {
            setInventoryItems(prev => {
                const ids = data.map(d => d.id);
                return [...data, ...prev.filter(p => !ids.includes(p.id))];
            });
            closeBatchModal();
        }
    };

    const closeBatchModal = () => { setIsBatchFormOpen(false); setBatchItems([{ ...initialItemState }]); setErrorMsg(null); };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setNewItem(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value }));
    };

    const handleAddItem = async (e) => {
        e.preventDefault(); setErrorMsg(null);
        const payload = { ...newItem, last_updated: new Date().toISOString() };
        if (editItemId) {
            const { data, error } = await supabase.from('materials_inventory').update(payload).eq('id', editItemId).select();
            if (error) { setErrorMsg(`⚠️ ${error.message}`); return; }
            if (data?.[0]) { setInventoryItems(prev => prev.map(i => i.id === editItemId ? data[0] : i)); closeModal(); }
        } else {
            const { data, error } = await supabase.from('materials_inventory').insert([payload]).select();
            if (error) { setErrorMsg(`⚠️ ${error.message}`); return; }
            if (data?.[0]) { setInventoryItems(prev => [data[0], ...prev]); closeModal(); }
        }
    };

    const handleEditClick = (item) => {
        setEditItemId(item.id);
        setNewItem({ item_code: item.item_code, item_name: item.item_name, supplier_details: item.supplier_details || '', pricing_details: item.pricing_details || '', stock_in: item.stock_in || 0, stock_out: item.stock_out || 0 });
        setIsFormOpen(true);
    };

    const closeModal = () => { setIsFormOpen(false); setEditItemId(null); setNewItem(initialItemState); setErrorMsg(null); };

    const handlePrintReport = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>Materials Inventory Report</title>
        <style>body{font-family:sans-serif;padding:2rem;color:#1e293b}h1{color:#166534;text-align:center}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{border:1px solid #e2e8f0;padding:.75rem;text-align:left}th{background:#f1f5f9;font-weight:600}.text-right{text-align:right}</style>
        </head><body><h1>LAVC Materials Inventory Report</h1><p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <table><thead><tr><th>Code</th><th>Item Name</th><th>Supplier</th><th>Pricing</th><th class="text-right">Stock In</th><th class="text-right">Stock Out</th><th class="text-right">Warehouse Balance</th><th class="text-right">Farm Dispatched</th></tr></thead><tbody>
        ${warehouseStock.map(item => `<tr><td>${item.item_code}</td><td>${item.item_name}</td><td>${item.supplier_details || 'N/A'}</td><td>${item.pricing_details || 'N/A'}</td><td class="text-right">${item.stock_in || 0}</td><td class="text-right">${item.stock_out || 0}</td><td class="text-right"><strong>${item.warehouseBalance}</strong></td><td class="text-right">${totalDispatchedPerItem[item.item_code] || 0}</td></tr>`).join('')}
        </tbody></table></body></html>`);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const totalItemsCount = inventoryItems.length;
    const totalWarehouseStock = warehouseStock.reduce((acc, i) => acc + i.warehouseBalance, 0);
    const lowStockCount = warehouseStock.filter(i => i.warehouseBalance <= 0).length;

    const filteredItems = useMemo(() => {
        if (!searchQuery) return warehouseStock;
        const q = searchQuery.toLowerCase();
        return warehouseStock.filter(item =>
            (item.item_name && item.item_name.toLowerCase().includes(q)) ||
            (item.item_code && item.item_code.toLowerCase().includes(q))
        );
    }, [warehouseStock, searchQuery]);

    return (
        <div className="materials-inventory-page animation-fade-in" style={{ padding: '1.5rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Package size={28} color="var(--color-primary-dark)" />
                        Materials Inventory
                    </h2>
                    <p style={{ color: 'var(--text-tertiary)', margin: '0.25rem 0 0 calc(28px + 0.75rem)', fontSize: '0.95rem' }}>Track packaging materials, farm allocations, and warehouse stock.</p>
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
                    {/* Metrics */}
                    <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                        <div className="metric-card">
                            <div className="metric-icon blue"><Box size={24} /></div>
                            <div className="metric-content">
                                <span className="metric-label">Total Unique Items</span>
                                <span className="metric-value">{totalItemsCount}</span>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-icon green"><Warehouse size={24} /></div>
                            <div className="metric-content">
                                <span className="metric-label">Warehouse Stock (excl. Farm)</span>
                                <span className="metric-value">{totalWarehouseStock.toLocaleString()}</span>
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

                    {/* Main Content */}
                    <div className="card content-section" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="inventory-controls">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input type="text" className="search-input" placeholder="Search by code or item name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button className="btn-secondary" onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Printer size={16} /> Print Report
                                </button>
                                <button className="btn-secondary" onClick={() => setIsBatchFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }}>
                                    <ListPlus size={18} /> Batch Entry
                                </button>
                                <button className="btn-primary" onClick={() => setIsFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={18} /> Register New Item
                                </button>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Procurement</th>
                                        <th className="text-right">Total In</th>
                                        <th className="text-right">Total Out</th>
                                        <th className="text-right">Farm Dispatched</th>
                                        <th className="text-right" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderBottom: '2px solid #bbf7d0' }}>Warehouse Balance</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length > 0 ? (
                                        filteredItems.map(item => {
                                            const isLow = item.warehouseBalance <= 0;
                                            const dispatched = totalDispatchedPerItem[item.item_code] || 0;
                                            return (
                                                <tr key={item.id} className={isLow ? 'bg-error-light' : ''}>
                                                    <td data-label="Item">
                                                        <div className="cell-primary" style={{ fontWeight: '700', fontSize: '1.05rem', color: isLow ? '#b91c1c' : '#0f172a' }}>
                                                            {isLow && <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', position: 'relative', top: '2px' }} />}
                                                            {item.item_name}
                                                        </div>
                                                        <div className="badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                                                            <Box size={12} /> {item.item_code}
                                                        </div>
                                                    </td>
                                                    <td data-label="Supplier">
                                                        <div className="cell-primary">{item.supplier_details || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No supplier listed</span>}</div>
                                                        <div className="cell-secondary"><span style={{ fontWeight: 600 }}>Price:</span> {item.pricing_details || 'N/A'}</div>
                                                    </td>
                                                    <td data-label="Total In" className="text-right">
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontWeight: 600 }}>
                                                            {item.stock_in || 0} <TrendingUp size={14} />
                                                        </div>
                                                    </td>
                                                    <td data-label="Total Out" className="text-right">
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 600 }}>
                                                            {item.stock_out || 0} <TrendingDown size={14} />
                                                        </div>
                                                    </td>
                                                    <td data-label="Farm Dispatched" className="text-right">
                                                        <div style={{ color: '#8b5cf6', fontWeight: 600 }}>
                                                            {dispatched > 0 ? `−${dispatched}` : '0'}
                                                        </div>
                                                    </td>
                                                    <td data-label="Warehouse Bal." className="text-right highlight-col" style={{ background: '#f8fafc', fontWeight: '800', fontSize: '1.25rem', color: isLow ? '#ef4444' : '#10b981' }}>
                                                        {item.warehouseBalance}
                                                    </td>
                                                    <td data-label="" className="text-center">
                                                        <button className="btn-secondary btn-sm" onClick={() => handleEditClick(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <Edit2 size={14} /> Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
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
                <div className="animation-fade-in">
                    {/* Top Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Tractor size={20} color="#16a34a" /> Farm Allocations
                            </h3>
                            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                Each farm has a pool of materials. Only items delivered to the farm for a specific operation are deducted.
                            </p>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            onClick={() => setIsBulkDispatchOpen(true)}
                        >
                            <Plus size={18} /> Deliver to Farm
                        </button>
                    </div>

                    {/* Filter row */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '0.8rem' }}>Filter by Farm</label>
                            <select className="input-field" value={farmFilter} onChange={e => setFarmFilter(e.target.value)}>
                                <option value="ALL">All Farms</option>
                                {farmsWithAllocations.map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Per-Farm Inventory Cards */}
                    {farms.length === 0 && farmsWithAllocations.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            <Tractor size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                            <p>No farm allocations yet. Click <strong>Deliver to Farm</strong> to start.</p>
                        </div>
                    ) : (
                        (farmFilter === 'ALL' ? farmsWithAllocations : [farmFilter]).map(farmCode => {
                            const farmInfo = farms.find(f => (f.farmCode || f.code) === farmCode);
                            const farmName = farmInfo?.name || farmCode;
                            const farmItemBalances = farmBalances[farmCode] || {};
                            const farmHistory = allocations.filter(a => a.farmCode === farmCode);
                            const isExpanded = expandedFarm === farmCode;

                            return (
                                <div key={farmCode} className="card" style={{ padding: 0, marginBottom: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    {/* Farm Header */}
                                    <button
                                        onClick={() => setExpandedFarm(isExpanded ? null : farmCode)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#f8fafc', border: 'none', cursor: 'pointer', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Tractor size={18} color="#16a34a" />
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>{farmCode} — {farmName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    {Object.keys(farmItemBalances).length} item{Object.keys(farmItemBalances).length !== 1 ? 's' : ''} in allocation pool
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                                    </button>

                                    {/* Farm Content */}
                                    {isExpanded && (
                                        <div>
                                            {/* Item Balance Summary */}
                                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                                <h5 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Allocation Pool</h5>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                                    {Object.entries(farmItemBalances).map(([itemCode, qty]) => {
                                                        const item = inventoryItems.find(i => i.item_code === itemCode);
                                                        return (
                                                            <div key={itemCode} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>{item?.item_name || itemCode}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{itemCode}</div>
                                                                </div>
                                                                <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#16a34a' }}>{qty}</div>
                                                            </div>
                                                        );
                                                    })}
                                                    {Object.keys(farmItemBalances).length === 0 && (
                                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', gridColumn: '1/-1' }}>No items allocated yet.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Delivery History */}
                                            <div style={{ padding: '1rem 1.5rem' }}>
                                                <h5 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery History</h5>
                                                <div className="table-responsive">
                                                    <table className="banana-table" style={{ fontSize: '0.875rem' }}>
                                                        <thead>
                                                            <tr>
                                                                <th>Date</th>
                                                                <th>Material</th>
                                                                <th className="text-right">Qty Delivered</th>
                                                                <th>Reference</th>
                                                                <th></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {farmHistory.map(a => (
                                                                <tr key={a.id}>
                                                                    <td data-label="Date" style={{ color: '#64748b' }}>{a.date}</td>
                                                                    <td data-label="Material" style={{ fontWeight: 600 }}>
                                                                        {inventoryItems.find(i => i.item_code === a.itemCode)?.item_name || a.itemCode}
                                                                    </td>
                                                                    <td data-label="Qty" className="text-right" style={{ fontWeight: 600, color: '#16a34a' }}>+{a.quantity}</td>
                                                                    <td data-label="Reference" style={{ color: '#64748b', fontSize: '0.85rem' }}>{a.referenceNo || '—'}</td>
                                                                    <td data-label="">
                                                                        <button onClick={() => handleDeleteAllocation(a.id)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {farmHistory.length === 0 && (
                                                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No deliveries recorded.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* === BULK DISPATCH MODAL === */}
            {isBulkDispatchOpen && (
                <div className="inventory-form-overlay" onClick={() => setIsBulkDispatchOpen(false)}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="form-modal-header">
                            <h3><Tractor size={20} color="var(--color-primary-dark)" /> Deliver Materials to Farm</h3>
                            <button onClick={() => setIsBulkDispatchOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>
                        <div className="form-modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="input-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                                    <label>Farm / Grower *</label>
                                    <select className="input-field" value={bulkDispatchFarm} onChange={e => setBulkDispatchFarm(e.target.value)}>
                                        <option value="">-- Select Farm --</option>
                                        {farms.map(f => (
                                            <option key={f.id || f.farmCode} value={f.farmCode || f.code}>{f.farmCode || f.code} – {f.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group" style={{ margin: 0 }}>
                                    <label>Delivery Date</label>
                                    <input type="date" className="input-field" value={bulkDispatchDate} onChange={e => setBulkDispatchDate(e.target.value)} />
                                </div>
                                <div className="input-group" style={{ margin: 0 }}>
                                    <label>Reference / DR No.</label>
                                    <input type="text" className="input-field" value={bulkDispatchRef} placeholder="Optional" onChange={e => setBulkDispatchRef(e.target.value)} />
                                </div>
                            </div>

                            <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.9rem' }}>Items Delivered</h4>
                            {bulkDispatchItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <select className="input-field" value={item.itemCode} onChange={e => updateBulkItem(idx, 'itemCode', e.target.value)} style={{ margin: 0 }}>
                                        <option value="">-- Select Material --</option>
                                        {inventoryItems.map(inv => (
                                            <option key={inv.id} value={inv.item_code}>{inv.item_code} – {inv.item_name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number" min="1" className="input-field" placeholder="Qty"
                                        value={item.quantity} onChange={e => updateBulkItem(idx, 'quantity', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                    <button onClick={() => removeBulkItem(idx)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={addBulkItem} style={{ width: '100%', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                                <Plus size={14} /> Add Another Item
                            </button>
                        </div>
                        <div className="form-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                            <button className="btn-secondary" onClick={() => setIsBulkDispatchOpen(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleBulkDispatch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Tractor size={16} /> Record Delivery
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Register Modal */}
            {isBatchFormOpen && (
                <div className="inventory-form-overlay" onClick={closeBatchModal}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
                        <div className="form-modal-header">
                            <h3><ListPlus size={20} color="var(--color-primary-dark)" /> Batch Register Materials</h3>
                            <button onClick={closeBatchModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>
                        <div className="form-modal-body">
                            {errorMsg && <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem' }}>{errorMsg}</div>}
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
                                                    <td data-label="Code"><input type="text" name="item_code" className="input-field" value={item.item_code} onChange={(e) => handleBatchInputChange(index, e)} required placeholder="Code" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="Name"><input type="text" name="item_name" className="input-field" value={item.item_name} onChange={(e) => handleBatchInputChange(index, e)} required placeholder="Name" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="Supplier"><input type="text" name="supplier_details" className="input-field" value={item.supplier_details} onChange={(e) => handleBatchInputChange(index, e)} placeholder="Supplier" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="Price"><input type="text" name="pricing_details" className="input-field" value={item.pricing_details} onChange={(e) => handleBatchInputChange(index, e)} placeholder="Price" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="Stock IN"><input type="number" name="stock_in" className="input-field" value={item.stock_in} onChange={(e) => handleBatchInputChange(index, e)} placeholder="0" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="Stock OUT"><input type="number" name="stock_out" className="input-field" value={item.stock_out} onChange={(e) => handleBatchInputChange(index, e)} placeholder="0" style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} /></td>
                                                    <td data-label="" style={{ textAlign: 'center' }}>
                                                        <button type="button" onClick={() => removeBatchRow(index)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                    <button type="button" className="btn-secondary" onClick={closeBatchModal}>Cancel</button>
                                    <button type="submit" className="btn-primary">Save Batch ({batchItems.length})</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Item Modal */}
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
                            {errorMsg && <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem' }}>{errorMsg}</div>}
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
                                    <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                        <label className="label" style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={16} /> Total Stock IN</label>
                                        <input type="number" name="stock_in" className="input-field" value={newItem.stock_in} onChange={handleInputChange} placeholder="Cumulative received" />
                                    </div>
                                    <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px' }}>
                                        <label className="label" style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingDown size={16} /> Total Stock OUT</label>
                                        <input type="number" name="stock_out" className="input-field" value={newItem.stock_out} onChange={handleInputChange} placeholder="Cumulative requested/used" />
                                    </div>
                                </div>
                                <div className="form-modal-footer" style={{ margin: '2rem -2rem -2rem -2rem', padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                    <button type="submit" className="btn-primary">{editItemId ? 'Save Changes' : 'Register Material'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialsInventory;
