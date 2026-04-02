import React from 'react';

const SingleItemModal = ({
    isFormOpen,
    closeModal,
    editItemId,
    errorMsg,
    handleAddItem,
    newItem,
    handleInputChange
}) => {
    if (!isFormOpen) return null;

    return (
        <div className="inventory-form-overlay" onClick={closeModal}>
          <div
            className="inventory-form-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-modal-header">
              <h3>{editItemId ? "Update Material" : "New Material"}</h3>
              <button type="button" onClick={closeModal}>×</button>
            </div>
            <div className="form-modal-body">
              {errorMsg && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "8px",
                    color: "#b91c1c",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleAddItem}>
                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: "1/-1" }}>
                    <label className="label">Item Name</label>
                    <input
                      type="text"
                      name="item_name"
                      className="input-field"
                      value={newItem.item_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Item Code</label>
                    <input
                      type="text"
                      name="item_code"
                      className="input-field"
                      value={newItem.item_code}
                      onChange={handleInputChange}
                      required
                      disabled={!!editItemId}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      className="input-field"
                      value={newItem.unit || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. PCS, KGS"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Price in PHP</label>
                    <input
                      type="number"
                      step="0.01"
                      name="price_php"
                      className="input-field"
                      value={newItem.price_php || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. 150.00"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1/-1" }}>
                    <label className="label">Supplier</label>
                    <input
                      type="text"
                      name="supplier_details"
                      className="input-field"
                      value={newItem.supplier_details}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div
                    className="form-group"
                    style={{
                      padding: "0.75rem",
                      background: "#f0fdf4",
                      borderRadius: "8px",
                    }}
                  >
                    <label className="label">Total Stock IN</label>
                    <input
                      type="number"
                      name="stock_in"
                      className="input-field"
                      value={newItem.stock_in}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div
                    className="form-group"
                    style={{
                      padding: "0.75rem",
                      background: "#fef2f2",
                      borderRadius: "8px",
                    }}
                  >
                    <label className="label">Total Stock OUT</label>
                    <input
                      type="number"
                      name="stock_out"
                      className="input-field"
                      value={newItem.stock_out}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div
                  className="form-modal-footer"
                  style={{ border: "none", padding: "1.5rem 0 0" }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editItemId ? "Update" : "Register"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
    );
};

export default SingleItemModal;
