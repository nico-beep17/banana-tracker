import React from 'react';
import { Trash2 } from 'lucide-react';

const BatchModal = ({
    isBatchFormOpen,
    setIsBatchFormOpen,
    handleBatchSubmit,
    batchItems,
    setBatchItems,
    handleBatchInputChange,
    initialItemState
}) => {
    if (!isBatchFormOpen) return null;

    return (
        <div
          className="inventory-form-overlay"
          onClick={() => setIsBatchFormOpen(false)}
        >
          <div
            className="inventory-form-modal"
            style={{ maxWidth: "900px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-modal-header">
              <h3>Batch Product Update</h3>
              <button type="button" onClick={() => setIsBatchFormOpen(false)}>×</button>
            </div>
            <div className="form-modal-body">
              <form onSubmit={handleBatchSubmit}>
                {batchItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid-responsive"
                    style={{
                      gridTemplateColumns: "100px 1fr 80px 80px 40px",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <input
                      type="text"
                      name="item_code"
                      className="input-field"
                      value={it.item_code}
                      onChange={(e) => handleBatchInputChange(idx, e)}
                      placeholder="Code"
                      style={{ margin: 0 }}
                    />
                    <input
                      type="text"
                      name="item_name"
                      className="input-field"
                      value={it.item_name}
                      onChange={(e) => handleBatchInputChange(idx, e)}
                      placeholder="Name"
                      style={{ margin: 0 }}
                    />
                    <input
                      type="number"
                      name="stock_in"
                      className="input-field"
                      value={it.stock_in}
                      onChange={(e) => handleBatchInputChange(idx, e)}
                      placeholder="+In"
                      style={{ margin: 0 }}
                    />
                    <input
                      type="number"
                      name="stock_out"
                      className="input-field"
                      value={it.stock_out}
                      onChange={(e) => handleBatchInputChange(idx, e)}
                      placeholder="-Out"
                      style={{ margin: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBatchItems(batchItems.filter((_, i) => i !== idx))
                      }
                      style={{
                        background: "#fee2e2",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setBatchItems([...batchItems, { ...initialItemState }])
                  }
                  style={{
                    width: "100%",
                    margin: "1rem 0",
                    padding: "0.5rem",
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "8px",
                  }}
                >
                  + New Row
                </button>
                <div
                  className="form-modal-footer"
                  style={{ border: "none", padding: "1rem 0 0" }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsBatchFormOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
    );
};

export default BatchModal;
