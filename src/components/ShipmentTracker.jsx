import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ShipmentTracker.css';

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom modern ship icon
const createShipIcon = (isArrived) => new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div class="ship-marker-wrapper" style="border-color: ${isArrived ? '#10b981' : '#f59e0b'}">
             <div class="ship-icon-inner">🚢</div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Coordinates for major points
const PORTS = {
    // Origin
    'PHILIPPINES': [7.0736, 125.6110], // Davao/Panabo roughly
    // Destinations
    'SHANGHAI': [31.2304, 121.4737],
    'DALIAN': [38.9140, 121.6147],
    'SHEKOU': [22.4833, 113.9167],
    'QINGDAO': [36.0671, 120.3826],
    'XINGANG': [38.9833, 117.7500],
    'KAWASAKI': [35.5308, 139.7029],
    'HAKATA': [33.6064, 130.4183],
    'KOBE': [34.6901, 135.1955],
    'NAGOYA': [35.1815, 136.9066],
    'YOKOHAMA': [35.4437, 139.6380],
    // Middle East approximation points (ocean path)
    'DAMMAM, SAUDI ARABIA': [26.4207, 50.1088],
    'JEBBEL ALI': [24.9857, 55.0273],
    'QATAR': [25.2854, 51.5310]
};

// Simulated mid-ocean waypoints based on destination country to draw curved/multi-point lines
const getRoutePath = (destination) => {
    const start = PORTS['PHILIPPINES'];
    const end = PORTS[destination.toUpperCase()] || [0, 0];

    // Very basic curve approximation via a mid-point for visual flair
    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];

    // Push the mid point out a bit to create a slight arc
    const midPoint = [
        start[0] + (latDiff * 0.5) + (lngDiff > 0 ? -2 : 2),
        start[1] + (lngDiff * 0.5) + (latDiff > 0 ? 2 : -2)
    ];

    return [start, midPoint, end];
};

const STEPS = ['HUB', 'PORT_OF_LOADING', 'IN_TRANSIT', 'ARRIVED'];
const LABELS = ['Hub', 'Port', 'Ocean', 'Destination'];
const ICONS = ['🏢', '⚓', '🌊', '🏁'];

const DEFAULT_ETA_OFFSET = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const ShipmentTracker = ({ containers, onUpdateTransitStatus }) => {
    // Only show dispatched containers
    const activeShipments = useMemo(() => {
        const fallbackEta = new Date(Date.now() + DEFAULT_ETA_OFFSET).toISOString();
        return containers.filter(c => c.timeDeparted).map(c => ({
            ...c,
            transit_status: c.transit_status || 'HUB',
            eta: c.eta || fallbackEta
        }));
    }, [containers]);

    const handleAdvance = (containerId, currentStatus) => {
        const currentIndex = STEPS.indexOf(currentStatus);
        if (currentIndex < STEPS.length - 1) {
            const nextStatus = STEPS[currentIndex + 1];
            onUpdateTransitStatus(containerId, nextStatus);
        }
    };

    // Calculate current position on map based on status
    const getMarkerPosition = (shipment) => {
        const route = getRoutePath(shipment.destination || '');
        if (route[2][0] === 0) return route[0]; // Unknown destination fallback to start

        const status = shipment.transit_status;
        if (status === 'HUB' || status === 'PORT_OF_LOADING') return route[0];
        if (status === 'IN_TRANSIT') return route[1];
        if (status === 'ARRIVED') return route[2];
        return route[0];
    };

    return (
        <div className="tracker-container animation-fade-in">
            <header className="page-header" style={{ marginBottom: '1.5rem', padding: '1rem 0' }}>
                <div>
                    <h2>Live Shipment Tracker</h2>
                    <p>Monitor dispatched reefer containers in transit to global markets.</p>
                </div>
            </header>

            {/* Interactive World Map */}
            <div className="map-wrapper shadow-lg">
                <MapContainer center={[20, 125]} zoom={3} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {activeShipments.map(shipment => {
                        if (!shipment.destination) return null;

                        const route = getRoutePath(shipment.destination);
                        const pos = getMarkerPosition(shipment);
                        const isArrived = shipment.transit_status === 'ARRIVED';

                        // Draw route polyline
                        return (
                            <React.Fragment key={shipment.id}>
                                <Polyline
                                    positions={route}
                                    pathOptions={{ color: isArrived ? '#10b981' : 'var(--color-primary-light)', weight: 3, dashArray: '5, 10', opacity: 0.6 }}
                                />
                                <Marker position={pos} icon={createShipIcon(isArrived)}>
                                    <Popup className="premium-popup">
                                        <div className="eta-bubble">
                                            <span className="bg">{shipment.brand} | {shipment.reeferName}</span>
                                            {shipment.destination}<br />
                                            {isArrived ? 'Arrived' : `ETA: ${new Date(shipment.eta).toLocaleDateString()}`}
                                        </div>
                                    </Popup>
                                </Marker>
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Shipment Cards Grid */}
            <div className="shipments-grid">
                {activeShipments.length === 0 ? (
                    <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '4rem' }}>
                        <div style={{ fontSize: '3rem' }}>📭</div>
                        <h3 style={{ marginTop: '1rem' }}>No Active Shipments</h3>
                        <p className="text-secondary">Containers will appear here after they depart the Hub.</p>
                    </div>
                ) : (
                    activeShipments.map(shipment => {
                        const statusIndex = STEPS.indexOf(shipment.transit_status);
                        const progressPercent = (statusIndex / (STEPS.length - 1)) * 100;
                        const isArrived = shipment.transit_status === 'ARRIVED';

                        return (
                            <div key={shipment.id} className="shipment-card card shadow-sm">
                                <div className="shipment-header">
                                    <div>
                                        <div className="shipment-title">{shipment.destination || 'Pending Destination'}</div>
                                        <div className="shipment-subtitle">{shipment.brand} | {shipment.reeferName} - {shipment.reeferNo}</div>
                                    </div>
                                    <div className={`status-badge ${isArrived ? 'full' : 'packing'}`}>
                                        {isArrived ? 'ARRIVED' : 'IN TRANSIT'}
                                    </div>
                                </div>

                                <div className="text-secondary" style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                                    Departed Hub: {new Date(shipment.timeDeparted).toLocaleDateString()}
                                </div>

                                <div className="transit-timeline">
                                    <div className="timeline-progress" style={{ width: `${progressPercent}%`, background: isArrived ? '#10b981' : '' }}></div>

                                    {STEPS.map((step, idx) => {
                                        const isCompleted = idx < statusIndex;
                                        const isActive = idx === statusIndex;

                                        let nodeClass = "timeline-node";
                                        if (isCompleted) nodeClass += " completed";
                                        if (isActive) nodeClass += " active";

                                        return (
                                            <div key={step} className={nodeClass}>
                                                <div className="node-icon">{ICONS[idx]}</div>
                                                <div className="node-label">{LABELS[idx]}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="shipment-actions">
                                    {!isArrived && (
                                        <button
                                            className="btn-primary"
                                            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                            onClick={() => handleAdvance(shipment.id, shipment.transit_status)}
                                        >
                                            Advance Milestone &rarr;
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ShipmentTracker;
