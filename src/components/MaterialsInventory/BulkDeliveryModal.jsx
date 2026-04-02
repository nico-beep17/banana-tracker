import React from 'react';
import { Trash2 } from 'lucide-react';

const BulkDeliveryModal = ({
    isBulkDeliveryOpen,
    setIsBulkDeliveryOpen,
    farms,
    bulkFarm,
    setBulkFarm,
    bulkDate,
    setBulkDate,
    bulkRef,
    setBulkRef,
    bulkItems,
    inventoryItems,
    updateBulkRow,
    removeBulkRow,
    addBulkRow,
    handleBulkSubmit
}) => {
    if (!isBulkDeliveryOpen) return null;

    return (
        <div
          className="inventory-form-overlay"
          onClick={() => setIsBulkDeliveryOpen(false)}
        >
          <div
            className="inventory-form-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "700px" }}
          >
            <div className="form-modal-header">
              <h3>Record Physical Delivery</h3>
              <button onClick={() => setIsBulkDeliveryOpen(false)}>×</button>
            </div>
            <div className="form-modal-body">
              <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
                <div className="form-group" style={{ gridColumn: "1/-1" }}>
                  <label className="label">Select Target Farm</label>
                  <select
                    className="input-field"
                    value={bulkFarm}
                    onChange={(e) => setBulkFarm(e.target.value)}
                  >
                    <option value="">-- Select Farm --</option>
                    {farms.map((f) => (
                      <option key={f.id} value={f.farmCode || f.code}>
                        {f.farmCode || f.code} — {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label">MIS Number</label>
                  <input
                    type="text"
                    className="input-field"
                    value={bulkRef}
                    onChange={(e) => setBulkRef(e.target.value)}
                    placeholder="e.g. MIS-0007"
                  />
                </div>
              </div>

              <h4 style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
                Items List
              </h4>
              {bulkItems.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px auto",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <select
                    className="input-field"
                    value={it.itemCode}
                    onChange={(e) =>
                      updateBulkRow(idx, "itemCode", e.target.value)
                    }
                    style={{ margin: 0 }}
                  >
                    <option value="">-- Material --</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.item_code}>
                        {inv.item_code} — {inv.item_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input-field"
                    value={it.quantity}
                    onChange={(e) =>
                      updateBulkRow(idx, "quantity", e.target.value)
                    }
                    placeholder="Qty"
                    style={{ margin: 0 }}
                  />
                  <button
                    onClick={() => removeBulkRow(idx)}
                    style={{
                      background: "#fee2e2",
                      border: "none",
                      borderRadius: "4px",
                      padding: "0.5rem",
                    }}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                </div>
              ))}
              <button
                onClick={addBulkRow}
                style={{
                  width: "100%",
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginTop: "0.5rem",
                }}
              >
                + Add Item
              </button>

              <div
                className="form-modal-footer"
                style={{ border: "none", padding: "1.5rem 0 0" }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setIsBulkDeliveryOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleBulkSubmit()}
                >
                  Confirm Delivery
                </button>
              </div>
            </div>
          </div>
        </div>
    );
};

export default BulkDeliveryModal;
