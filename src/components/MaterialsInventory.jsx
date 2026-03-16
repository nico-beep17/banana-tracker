import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Printer, Plus, Edit2, Archive, AlertTriangle, TrendingUp, TrendingDown, Box, Trash2, ListPlus, Warehouse, Tractor, ChevronDown, ChevronRight, ClipboardList, Truck } from 'lucide-react';
import './MaterialsInventory.css';

const MaterialsInventory = ({ inventoryItems = [], setInventoryItems, farms = [] }) => {
    const [activeView, setActiveView] = useState('global'); // 'global' | 'farm'
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
    const [editItemId, setEditItemId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);

    // PERSISTENCE KEY NAMES
    const ALLOCATIONS_KEY = 'farm_material_allocations';
    const DELIVERIES_KEY = 'farm_material_deliveries';

    // State for Earmarks (Allocations)
    const [allocations, setAllocations] = useState(() => {
        try { return JSON.parse(localStorage.getItem(ALLOCATIONS_KEY) || '[]'); } catch { return []; }
    });

    // State for Physical Deliveries (Usage)
    const [deliveries, setDeliveries] = useState(() => {
        try { return JSON.parse(localStorage.getItem(DELIVERIES_KEY) || '[]'); } catch { return []; }
    });

    const [farmFilter, setFarmFilter] = useState('ALL');
    const [expandedFarm, setExpandedFarm] = useState(null);

    // Modals
    const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);
    const [isBulkDeliveryOpen, setIsBulkDeliveryOpen] = useState(false);
    
    // Bulk Forms State
    const [bulkFarm, setBulkFarm] = useState('');
    const [bulkRef, setBulkRef] = useState('');
    const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkItems, setBulkItems] = useState([{ itemCode: '', quantity: '' }]);

    const saveAllocations = (newAllocations) => {
        setAllocations(newAllocations);
        localStorage.setItem(ALLOCATIONS_KEY, JSON.stringify(newAllocations));
    };

    const saveDeliveries = (newDeliveries) => {
        setDeliveries(newDeliveries);
        localStorage.setItem(DELIVERIES_KEY, JSON.stringify(newDeliveries));
    };

    // COMPUTED VALUES
    
    // Total physically delivered per item (deducts from Global)
    const totalDeliveredPerItem = useMemo(() => {
        const result = {};
        deliveries.forEach(d => {
            if (!result[d.itemCode]) result[d.itemCode] = 0;
            result[d.itemCode] += Number(d.quantity) || 0;
        });
        return result;
    }, [deliveries]);

    // Total earmarked per item (not yet delivered)
    const totalEarmarkedPerItem = useMemo(() => {
        const result = {};
        allocations.forEach(a => {
            if (!result[a.itemCode]) result[a.itemCode] = 0;
            result[a.itemCode] += Number(a.quantity) || 0;
        });
        // Subtract delivered amounts from earmarked ones to get "current holding"
        Object.keys(result).forEach(code => {
            result[code] = Math.max(0, result[code] - (totalDeliveredPerItem[code] || 0));
        });
        return result;
    }, [allocations, totalDeliveredPerItem]);

    // Global Stock = stock_in - stock_out - physical deliveries
    const warehouseStock = useMemo(() => {
        return inventoryItems.map(item => {
            const delivered = totalDeliveredPerItem[item.item_code] || 0;
            const balance = (item.stock_in || 0) - (item.stock_out || 0) - delivered;
            return { ...item, warehouseBalance: balance };
        });
    }, [inventoryItems, totalDeliveredPerItem]);

    // Per-farm balance
    const farmData = useMemo(() => {
        const result = {};
        // 1. Add all earmarks
        allocations.forEach(a => {
            if (!result[a.farmCode]) result[a.farmCode] = { earmarked: {}, history: [], pool: {} };
            if (!result[a.farmCode].pool[a.itemCode]) result[a.farmCode].pool[a.itemCode] = 0;
            result[a.farmCode].pool[a.itemCode] += Number(a.quantity) || 0;
            result[a.farmCode].history.push({ ...a, type: 'ALLOCATION' });
        });
        // 2. Subtract deliveries from pool
        deliveries.forEach(d => {
            if (!result[d.farmCode]) result[d.farmCode] = { earmarked: {}, history: [], pool: {} };
            if (!result[d.farmCode].pool[d.itemCode]) result[d.farmCode].pool[d.itemCode] = 0;
            result[d.farmCode].pool[d.itemCode] -= Number(d.quantity) || 0;
            result[d.farmCode].history.push({ ...d, type: 'DELIVERY' });
        });
        return result;
    }, [allocations, deliveries]);

    const farmsWithActivity = useMemo(() => {
        const set = new Set([...allocations.map(a => a.farmCode), ...deliveries.map(d => d.farmCode)]);
        return [...set];
    }, [allocations, deliveries]);

    // BULK HANDLERS
    const addBulkRow = () => setBulkItems(prev => [...prev, { itemCode: '', quantity: '' }]);
    const removeBulkRow = (idx) => setBulkItems(prev => prev.filter((_, i) => i !== idx));
    const updateBulkRow = (idx, field, value) => {
        setBulkItems(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const handleBulkSubmit = (type) => {
        if (!bulkFarm) { alert('Please select a farm.'); return; }
        const validItems = bulkItems.filter(it => it.itemCode && it.quantity > 0);
        if (validItems.length === 0) { alert('Add at least one item with qty > 0.'); return; }

        if (type === 'DELIVERY') {
            // Check if farm has enough in pool
            for (const it of validItems) {
                const currentPool = farmData[bulkFarm]?.pool[it.itemCode] || 0;
                if (it.quantity > currentPool) {
                    alert(`Not enough '${it.itemCode}' earmarked for this farm. Available: ${currentPool}`);
                    return;
                }
            }
        }

        const newEntries = validItems.map(it => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date: bulkDate,
            farmCode: bulkFarm,
            itemCode: it.itemCode,
            quantity: Number(it.quantity),
            referenceNo: bulkRef
        }));

        if (type === 'ALLOCATION') {
            saveAllocations([...newEntries, ...allocations]);
            setIsBulkAllocateOpen(false);
        } else {
            saveDeliveries([...newEntries, ...deliveries]);
            setIsBulkDeliveryOpen(false);
        }

        // Reset
        setBulkFarm(''); setBulkRef(''); setBulkItems([{ itemCode: '', quantity: '' }]);
    };

    const handleDeleteRecord = (id, type) => {
        if (!window.confirm('Delete this record?')) return;
        if (type === 'ALLOCATION') {
            saveAllocations(allocations.filter(a => a.id !== id));
        } else {
            saveDeliveries(deliveries.filter(d => d.id !== id));
        }
    };

    // ITEM MANAGEMENT (SUPABASE)
    const initialItemState = { item_code: '', item_name: '', supplier_details: '', pricing_details: '', stock_in: 0, stock_out: 0 };
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
            }
        }
        newBatch[index] = updatedRow;
        setBatchItems(newBatch);
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        const payloads = batchItems
            .filter(item => item.item_code?.trim() && item.item_name?.trim())
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
        if (data) {
            const ids = data.map(d => d.id);
            setInventoryItems(prev => [...data, ...prev.filter(p => !ids.includes(p.id))]);
            setIsBatchFormOpen(false); setBatchItems([{ ...initialItemState }]);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
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

    const closeModal = () => { setIsFormOpen(false); setEditItemId(null); setNewItem(initialItemState); setErrorMsg(null); };

    const handlePrintReport = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>Inventory Report</title><style>body{font-family:sans-serif;padding:2rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head>
        <body><h1>Materials Inventory Report</h1><p>Generated: ${new Date().toLocaleString()}</p>
        <table><thead><tr><th>Code</th><th>Item Name</th><th>Total In</th><th>Total Out</th><th>Delivered</th><th>Global Balance</th></tr></thead><tbody>
        ${warehouseStock.map(i => `<tr><td>${i.item_code}</td><td>${i.item_name}</td><td>${i.stock_in}</td><td>${i.stock_out}</td><td>${totalDeliveredPerItem[i.item_code] || 0}</td><td><strong>${i.warehouseBalance}</strong></td></tr>`).join('')}
        </tbody></table></body></html>`);
        printWindow.document.close();
        printWindow.print();
    };

    const filteredItems = warehouseStock.filter(item => 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="materials-inventory-page animation-fade-in" style={{ padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                        <Package size={28} color="var(--color-primary-dark)" />
                        Materials Hub
                    </h2>
                    <p style={{ color: 'var(--text-tertiary)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Comprehensive tracking of earmarks, usage, and global stock.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={handlePrintReport}><Printer size={16} /> Print</button>
                    <button className="btn-primary" onClick={() => setIsFormOpen(true)}><Plus size={16} /> Register Item</button>
                </div>
            </div>

            {/* View Switcher */}
            <div className="chrome-tabs-container" style={{ marginBottom: '1.5rem' }}>
                <button className={`chrome-tab ${activeView === 'global' ? 'active' : ''}`} onClick={() => setActiveView('global')}>
                    <Warehouse size={16} /> Global Warehouse
                </button>
                <button className={`chrome-tab ${activeView === 'farm' ? 'active' : ''}`} onClick={() => setActiveView('farm')}>
                    <Tractor size={16} /> Farm Pools
                </button>
            </div>

            {/* GLOBAL VIEW */}
            {activeView === 'global' && (
                <div className="animation-fade-in">
                    <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="metric-card">
                            <span className="metric-label">Warehouse Items</span>
                            <span className="metric-value">{inventoryItems.length}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Total Stock Units</span>
                            <span className="metric-value">{warehouseStock.reduce((a,c) => a+c.warehouseBalance, 0).toLocaleString()}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Earmarked (Reserved)</span>
                            <span className="metric-value" style={{ color: '#8b5cf6' }}>{Object.values(totalEarmarkedPerItem).reduce((a,c)=>a+c, 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0 }}>
                        <div className="inventory-controls" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div className="search-box" style={{ flex: 1, margin: 0 }}>
                                <Search size={18} className="search-icon" />
                                <input type="text" className="search-input" placeholder="Search materials..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            </div>
                            <button className="btn-secondary" onClick={() => setIsBatchFormOpen(true)}><ListPlus size={16} /> Batch Update</button>
                        </div>
                        <div className="table-responsive">
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th className="text-right">Units In</th>
                                        <th className="text-right">Units Out</th>
                                        <th className="text-right" style={{ color: '#8b5cf6' }}>Earmarked</th>
                                        <th className="text-right" style={{ color: '#ef4444' }}>Delivered</th>
                                        <th className="text-right">Global Stock</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => (
                                        <tr key={item.id}>
                                            <td data-label="Material">
                                                <div style={{ fontWeight: '700' }}>{item.item_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.item_code}</div>
                                            </td>
                                            <td data-label="In" className="text-right">{item.stock_in}</td>
                                            <td data-label="Out" className="text-right">{item.stock_out}</td>
                                            <td data-label="Earmarked" className="text-right" style={{ color: '#8b5cf6', fontWeight: 600 }}>{totalEarmarkedPerItem[item.item_code] || 0}</td>
                                            <td data-label="Delivered" className="text-right" style={{ color: '#ef4444', fontWeight: 600 }}>{totalDeliveredPerItem[item.item_code] || 0}</td>
                                            <td data-label="Stock" className="text-right highlight-col" style={{ fontWeight: 800 }}>{item.warehouseBalance}</td>
                                            <td data-label="" className="text-center">
                                                <button className="btn-secondary btn-sm" onClick={() => { setEditItemId(item.id); setNewItem(item); setIsFormOpen(true); }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* FARM VIEW */}
            {activeView === 'farm' && (
                <div className="animation-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Farm Allocation Pool</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Reservations are earmarks. Global stock only drops when physical delivery is recorded.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={() => setIsBulkAllocateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ClipboardList size={16} /> Earmark Stocks
                            </button>
                            <button className="btn-primary" onClick={() => setIsBulkDeliveryOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Truck size={16} /> Physical Delivery
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <select className="input-field" value={farmFilter} onChange={e => setFarmFilter(e.target.value)} style={{ maxWidth: '300px' }}>
                            <option value="ALL">All Active Farms</option>
                            {farmsWithActivity.map(code => <option key={code} value={code}>{code}</option>)}
                        </select>
                    </div>

                    {farmsWithActivity.filter(f => farmFilter === 'ALL' || f === farmFilter).map(farmCode => {
                        const data = farmData[farmCode];
                        const farmName = farms.find(f => (f.farmCode || f.code) === farmCode)?.name || farmCode;
                        const isExpanded = expandedFarm === farmCode;

                        return (
                            <div key={farmCode} className="card" style={{ padding: 0, marginBottom: '1rem', overflow: 'hidden' }}>
                                <button
                                    onClick={() => setExpandedFarm(isExpanded ? null : farmCode)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', border: 'none', cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                                        <Tractor size={20} color="#16a34a" />
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{farmCode} — {farmName}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{Object.keys(data.pool).length} unique items in pool</div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </button>

                                {isExpanded && (
                                    <div className="animation-slide-down">
                                        <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '1rem' }}>Current Holding (Earmarked Units)</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                                {Object.entries(data.pool).map(([code, qty]) => (
                                                    <div key={code} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{code}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{inventoryItems.find(i=>i.item_code===code)?.item_name || 'Material'}</div>
                                                        </div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{qty}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ padding: '0 1rem 1rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '1rem' }}>Activity History</h4>
                                            <div className="table-responsive">
                                                <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Type</th>
                                                            <th>Material</th>
                                                            <th className="text-right">Qty</th>
                                                            <th>Ref/OP</th>
                                                            <th className="text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.history.sort((a,b) => b.date.localeCompare(a.date)).map(row => (
                                                            <tr key={row.id}>
                                                                <td data-label="Date">{row.date}</td>
                                                                <td data-label="Type">
                                                                    <span className={`status-badge ${row.type === 'ALLOCATION' ? 'empty' : 'full'}`} style={{ fontSize: '0.65rem' }}>
                                                                        {row.type === 'ALLOCATION' ? 'EARMARKED' : 'DELIVERED'}
                                                                    </span>
                                                                </td>
                                                                <td data-label="Item">{row.itemCode}</td>
                                                                <td data-label="Qty" className="text-right" style={{ fontWeight: 700, color: row.type === 'ALLOCATION' ? '#8b5cf6' : '#ef4444' }}>
                                                                    {row.type === 'ALLOCATION' ? `+${row.quantity}` : `−${row.quantity}`}
                                                                </td>
                                                                <td data-label="Ref">{row.referenceNo || '—'}</td>
                                                                <td data-label="" className="text-center">
                                                                    <button onClick={() => handleDeleteRecord(row.id, row.type)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* BULK MODALS (EARMARK & DELIVERY) */}
            {(isBulkAllocateOpen || isBulkDeliveryOpen) && (
                <div className="inventory-form-overlay" onClick={() => { setIsBulkAllocateOpen(false); setIsBulkDeliveryOpen(false); }}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="form-modal-header">
                            <h3>{isBulkAllocateOpen ? 'Bulk Earmark Reservation' : 'Record Physical Delivery'}</h3>
                            <button onClick={() => { setIsBulkAllocateOpen(false); setIsBulkDeliveryOpen(false); }}>×</button>
                        </div>
                        <div className="form-modal-body">
                            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="label">Select Target Farm</label>
                                    <select className="input-field" value={bulkFarm} onChange={e => setBulkFarm(e.target.value)}>
                                        <option value="">-- Select Farm --</option>
                                        {farms.map(f => <option key={f.id} value={f.farmCode || f.code}>{f.farmCode || f.code} — {f.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Date</label>
                                    <input type="date" className="input-field" value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="label">{isBulkAllocateOpen ? 'Allocation Ref' : 'Operation/DR Ref'}</label>
                                    <input type="text" className="input-field" value={bulkRef} onChange={e => setBulkRef(e.target.value)} placeholder="e.g. BATCH-2025" />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Items List</h4>
                            {bulkItems.map((it, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <select className="input-field" value={it.itemCode} onChange={e => updateBulkRow(idx, 'itemCode', e.target.value)} style={{ margin: 0 }}>
                                        <option value="">-- Material --</option>
                                        {inventoryItems.map(inv => (
                                            <option key={inv.id} value={inv.item_code}>
                                                {inv.item_code} — {inv.item_name} {isBulkDeliveryOpen ? `(Pool: ${farmData[bulkFarm]?.pool[inv.item_code] || 0})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <input type="number" className="input-field" value={it.quantity} onChange={e => updateBulkRow(idx, 'quantity', e.target.value)} placeholder="Qty" style={{ margin: 0 }} />
                                    <button onClick={() => removeBulkRow(idx)} style={{ background: '#fee2e2', border: 'none', borderRadius: '4px', padding: '0.5rem' }}><Trash2 size={14} color="#ef4444" /></button>
                                </div>
                            ))}
                            <button onClick={addBulkRow} style={{ width: '100%', background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', marginTop: '0.5rem' }}>+ Add Item</button>

                            <div className="form-modal-footer" style={{ border: 'none', padding: '1.5rem 0 0' }}>
                                <button className="btn-secondary" onClick={() => { setIsBulkAllocateOpen(false); setIsBulkDeliveryOpen(false); }}>Cancel</button>
                                <button className="btn-primary" onClick={() => handleBulkSubmit(isBulkAllocateOpen ? 'ALLOCATION' : 'DELIVERY')}>
                                    {isBulkAllocateOpen ? 'Earmark Items' : 'Confirm Delivery'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SINGLE ITEM MODAL */}
            {isFormOpen && (
                <div className="inventory-form-overlay" onClick={closeModal}>
                    <div className="inventory-form-modal" onClick={e => e.stopPropagation()}>
                        <div className="form-modal-header">
                            <h3>{editItemId ? 'Update Material' : 'New Material'}</h3>
                            <button onClick={closeModal}>×</button>
                        </div>
                        <div className="form-modal-body">
                            <form onSubmit={handleAddItem}>
                                <div className="grid-2">
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="label">Item Name</label>
                                        <input type="text" name="item_name" className="input-field" value={newItem.item_name} onChange={handleInputChange} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Item Code</label>
                                        <input type="text" name="item_code" className="input-field" value={newItem.item_code} onChange={handleInputChange} required disabled={!!editItemId} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Unit Price / Info</label>
                                        <input type="text" name="pricing_details" className="input-field" value={newItem.pricing_details} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="label">Supplier</label>
                                        <input type="text" name="supplier_details" className="input-field" value={newItem.supplier_details} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group" style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px' }}>
                                        <label className="label">Total Stock IN</label>
                                        <input type="number" name="stock_in" className="input-field" value={newItem.stock_in} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group" style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '8px' }}>
                                        <label className="label">Total Stock OUT</label>
                                        <input type="number" name="stock_out" className="input-field" value={newItem.stock_out} onChange={handleInputChange} />
                                    </div>
                                </div>
                                <div className="form-modal-footer" style={{ border: 'none', padding: '1.5rem 0 0' }}>
                                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                    <button type="submit" className="btn-primary">{editItemId ? 'Update' : 'Register'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* BATCH MODAL */}
            {isBatchFormOpen && (
                <div className="inventory-form-overlay" onClick={() => setIsBatchFormOpen(false)}>
                    <div className="inventory-form-modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
                        <div className="form-modal-header">
                            <h3>Batch Product Update</h3>
                            <button onClick={() => setIsBatchFormOpen(false)}>×</button>
                        </div>
                        <div className="form-modal-body">
                            <form onSubmit={handleBatchSubmit}>
                                {batchItems.map((it, idx) => (
                                    <div key={idx} className="grid-responsive" style={{ gridTemplateColumns: '100px 1fr 80px 80px 40px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input type="text" name="item_code" className="input-field" value={it.item_code} onChange={e => handleBatchInputChange(idx, e)} placeholder="Code" style={{margin:0}} />
                                        <input type="text" name="item_name" className="input-field" value={it.item_name} onChange={e => handleBatchInputChange(idx, e)} placeholder="Name" style={{margin:0}} />
                                        <input type="number" name="stock_in" className="input-field" value={it.stock_in} onChange={e => handleBatchInputChange(idx, e)} placeholder="+In" style={{margin:0}} />
                                        <input type="number" name="stock_out" className="input-field" value={it.stock_out} onChange={e => handleBatchInputChange(idx, e)} placeholder="-Out" style={{margin:0}} />
                                        <button type="button" onClick={() => setBatchItems(batchItems.filter((_,i)=>i!==idx))} style={{ background: '#fee2e2', border: 'none', borderRadius: '4px' }}><Trash2 size={14} color="#ef4444" /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setBatchItems([...batchItems, {...initialItemState}])} style={{ width:'100%', margin:'1rem 0', padding:'0.5rem', background: '#f8fafc', border:'1px dashed #cbd5e1', borderRadius:'8px' }}>+ New Row</button>
                                <div className="form-modal-footer" style={{ border:'none', padding: '1rem 0 0' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setIsBatchFormOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-primary">Update Batch</button>
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
