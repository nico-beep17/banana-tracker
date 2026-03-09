import React, { useState, useEffect } from 'react';
import './NewContainerForm.css';
import './ContainersList.css'; // Reusing the css for the form styles
import { supabase } from '../supabaseClient';

const getISOWeek = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const NewContainerForm = ({ onSaveContainer, initialData = null, onCancel }) => {
    const [formData, setFormData] = useState({
        // Header 1
        brand: 'LFJ',
        reeferName: '',
        reeferNo: '',
        sealNo: '',
        destination: '',
        vesselVoyage: '', // Changed from voyageNo
        shipper: 'LFJ AGRI-VENTURES CORP.',
        bpiSticker: '',
        buyer_name: '',
        // Header 2 - New fields
        bookingNo: '',
        dateDeparted: '',
        timeOfDeparture: '',
        driverName: '', // Changed from driver
        plateNo: '',
        dateArrived: '',
        temperature: '14.0',
        ventilation: 'CLOSED'
    });
    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                vesselVoyage: initialData.voyageNo || '', // Map old voyageNo to new vesselVoyage
                driverName: initialData.driver || '', // Map old driver to new driverName
                // Set defaults for new fields if not present in initialData
                buyer_name: initialData.buyer_name || '',
                bookingNo: initialData.bookingNo || '',
                dateDeparted: initialData.dateDeparted || '',
                timeOfDeparture: initialData.timeOfDeparture || '',
                dateArrived: initialData.dateArrived || '',
                ventilation: initialData.ventilation || 'CLOSED'
            });
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault(); // Prevent default form submission
        const containerToSave = initialData ? {
            ...initialData,
            ...formData,
            voyageNo: formData.vesselVoyage, // Map new vesselVoyage back to old voyageNo for saving
            driver: formData.driverName // Map new driverName back to old driver for saving
        } : {
            id: `CONT-${Date.now()}`,
            ...formData,
            voyageNo: formData.vesselVoyage, // Map new vesselVoyage to old voyageNo for saving
            driver: formData.driverName, // Map new driverName to old driver for saving
            totalBoxes: 0,
            stuffedItems: [],
            dateCreated: new Date().toISOString()
        };

        onSaveContainer(containerToSave);

        if (!initialData) {
            // Reset form for next container if it was a create operation
            setFormData({
                brand: 'LFJ', reeferName: '', reeferNo: '', sealNo: '', destination: '', vesselVoyage: '',
                shipper: 'LFJ AGRI-VENTURES CORP.', bpiSticker: '', buyer_name: '',
                bookingNo: '', dateDeparted: '', timeOfDeparture: '',
                driverName: '', plateNo: '', dateArrived: '', temperature: '14.0', ventilation: 'CLOSED'
            });
        }
    };

    return (
        <div className="container-stuffing-page animation-fade-in" style={{ padding: '0 2rem' }}>
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2>{initialData ? 'Edit Container Details' : 'Create New Container Log'}</h2>
                    <p>{initialData ? 'Update registry information for this container.' : 'Register a new export shipping container before stuffing inventory.'}</p>
                </div>
            </header>

            <div className="stuffing-layout" style={{ maxWidth: '1000px', margin: '0 auto', display: 'block' }}>
                <form onSubmit={handleSubmit}>
                    <div className="form-section">
                        <h3 className="form-section-title">🚢 Shipment Identification</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">Destination Port</label>
                                <select
                                    name="destination"
                                    className="input-field"
                                    value={formData.destination}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Destination...</option>
                                    <option value="Dalian">Dalian, China</option>
                                    <option value="Hakata">Hakata, Japan</option>
                                    <option value="Kawasaki">Kawasaki, Japan</option>
                                    <option value="Kobe">Kobe, Japan</option>
                                    <option value="Yokohama">Yokohama, Japan</option>
                                    <option value="Nagoya">Nagoya, Japan</option>
                                    <option value="Qingdao">Qingdao, China</option>
                                    <option value="Shanghai">Shanghai, China</option>
                                    <option value="Shekou">Shekou, China</option>
                                    <option value="Xingang">Xingang, China</option>
                                    <option value="Damman, Saudi Arabia">Damman, Saudi Arabia</option>
                                    <option value="Jebbel Ali">Jebbel Ali</option>
                                    <option value="Qatar">Qatar</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">Reefer Name</label>
                                <input type="text" name="reeferName" className="input-field" value={formData.reeferName} onChange={handleChange} required placeholder="e.g. COSCO" />
                            </div>
                            <div className="form-group">
                                <label className="label">Reefer Number</label>
                                <input type="text" name="reeferNo" className="input-field" value={formData.reeferNo} onChange={handleChange} required placeholder="e.g. 12345" />
                            </div>
                            <div className="form-group">
                                <label className="label">Brand</label>
                                <input type="text" name="brand" className="input-field" value={formData.brand} onChange={handleChange} required placeholder="e.g. LFJ" />
                            </div>
                            <div className="form-group">
                                <label className="label">Buyer Name</label>
                                <input type="text" name="buyer_name" className="input-field" value={formData.buyer_name} onChange={handleChange} placeholder="e.g. Trading Co." />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">🎫 Booking & Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">Booking Number</label>
                                <input type="text" name="bookingNo" className="input-field" value={formData.bookingNo} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="label">Vessel / Voyage No.</label>
                                <input type="text" name="vesselVoyage" className="input-field" value={formData.vesselVoyage} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="label">Shipper</label>
                                <input type="text" name="shipper" className="input-field" value={formData.shipper} onChange={handleChange} required />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">Date of departure</label>
                                <input type="date" name="dateDeparted" className="input-field" value={formData.dateDeparted} onChange={handleChange} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>Subject to change without notice due to vessel delays.</span>
                            </div>
                            <div className="form-group">
                                <label className="label">Time of departure</label>
                                <input type="time" name="timeOfDeparture" className="input-field" value={formData.timeOfDeparture} onChange={handleChange} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>Subject to change depending on operations.</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">🚚 Transport & Operation</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">BPI Sticker No.</label>
                                <input type="text" name="bpiSticker" className="input-field" value={formData.bpiSticker} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="label">Seal No.</label>
                                <input type="text" name="sealNo" className="input-field" value={formData.sealNo} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">Truck Plate No.</label>
                                <input type="text" name="plateNo" className="input-field" value={formData.plateNo} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="label">Driver Name</label>
                                <input type="text" name="driverName" className="input-field" value={formData.driverName} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="label">Date Arrived</label>
                                <input type="date" name="dateArrived" className="input-field" value={formData.dateArrived} onChange={handleChange} required />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">🌡️ Climate Control</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="label">Temperature (C°)</label>
                                <input type="text" name="temperature" className="input-field" value={formData.temperature} onChange={handleChange} placeholder="e.g. 13.5" />
                            </div>
                            <div className="form-group">
                                <label className="label">Ventilation</label>
                                <input type="text" name="ventilation" className="input-field" value={formData.ventilation} onChange={handleChange} placeholder="e.g. CLOSED" />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" className="btn-secondary" onClick={onCancel} style={{ padding: '0.75rem 1.5rem', fontWeight: 'bold' }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.05rem', boxShadow: '0 4px 6px rgba(42,90,53,0.3)' }}>
                            {initialData ? '✓ Update Details' : '🚢 Register Container'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewContainerForm;
