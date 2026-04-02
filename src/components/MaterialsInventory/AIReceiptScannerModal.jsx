import React from 'react';
import { Camera, XCircle, CheckCircle, Trash2 } from 'lucide-react';

const AIReceiptScannerModal = ({
    isScanOpen,
    closeScan,
    scanState,
    scanError,
    fileInputRef,
    handleFileSelect,
    scanImage,
    handleScanReceipt,
    scanResult,
    setScanResult,
    handleScanConfirm,
    setScanState
}) => {
    if (!isScanOpen) return null;

    return (
        <div className="inventory-form-overlay" onClick={closeScan}>
          <div
            className="inventory-form-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "640px",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              className="form-modal-header"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "white",
                padding: "1.25rem 1.5rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
              >
                <Camera size={22} />
                <div>
                  <h3 style={{ margin: 0, color: "white" }}>
                    AI Receipt Scanner
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.85 }}>
                    Capture a supplier DR to auto-add inventory
                  </p>
                </div>
              </div>
              <button
                onClick={closeScan}
                style={{
                  color: "white",
                  opacity: 0.8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.4rem",
                }}
              >
                ×
              </button>
            </div>

            <div className="form-modal-body" style={{ padding: "1.5rem" }}>
              {/* IDLE: upload / capture */}
              {(scanState === "idle" || scanState === "error") && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    id="scan-input"
                  />

                  {!scanImage ? (
                    <label
                      htmlFor="scan-input"
                      style={{
                        display: "block",
                        border: "2px dashed #a78bfa",
                        borderRadius: "12px",
                        padding: "2.5rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "#faf5ff",
                        transition: "all 0.2s",
                      }}
                    >
                      <Camera
                        size={40}
                        color="#7c3aed"
                        style={{ marginBottom: "0.75rem" }}
                      />
                      <p
                        style={{
                          fontWeight: 700,
                          color: "#6d28d9",
                          margin: "0 0 0.25rem",
                        }}
                      >
                        Tap to capture or upload receipt
                      </p>
                      <p
                        style={{
                          fontSize: "0.82rem",
                          color: "#9ca3af",
                          margin: 0,
                        }}
                      >
                        Steniel DR, delivery receipt, or any supplier invoice
                      </p>
                    </label>
                  ) : (
                    <div>
                      <img
                        src={scanImage}
                        alt="Receipt preview"
                        style={{
                          width: "100%",
                          maxHeight: "300px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          marginBottom: "1rem",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <label
                          htmlFor="scan-input"
                          style={{
                            cursor: "pointer",
                            padding: "0.6rem 1rem",
                            background: "#f3f4f6",
                            borderRadius: "8px",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#374151",
                            border: "1px solid #d1d5db",
                          }}
                        >
                          🔄 Retake
                        </label>
                        <button
                          onClick={handleScanReceipt}
                          style={{
                            flex: 1,
                            padding: "0.7rem 1.25rem",
                            background:
                              "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.5rem",
                            fontSize: "0.95rem",
                          }}
                        >
                          <Camera size={18} /> Scan with AI
                        </button>
                      </div>
                    </div>
                  )}

                  {scanState === "error" && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem 1rem",
                        background: "#fef2f2",
                        border: "1px solid #fca5a5",
                        borderRadius: "8px",
                        color: "#b91c1c",
                        fontSize: "0.875rem",
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <XCircle
                        size={16}
                        style={{ flexShrink: 0, marginTop: "2px" }}
                      />
                      <div>
                        <strong>Scan failed:</strong> {scanError}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SCANNING */}
              {scanState === "scanning" && (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      border: "4px solid #e9d5ff",
                      borderTop: "4px solid #7c3aed",
                      borderRadius: "50%",
                      margin: "0 auto 1.25rem",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <p
                    style={{
                      fontWeight: 700,
                      color: "#6d28d9",
                      margin: "0 0 0.25rem",
                    }}
                  >
                    AI is reading the receipt...
                  </p>
                  <p
                    style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}
                  >
                    Extracting items, quantities, and DR details
                  </p>
                </div>
              )}

              {/* SAVING */}
              {scanState === "saving" && (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      border: "4px solid #bbf7d0",
                      borderTop: "4px solid #16a34a",
                      borderRadius: "50%",
                      margin: "0 auto 1.25rem",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <p style={{ fontWeight: 700, color: "#166534", margin: 0 }}>
                    Saving to inventory...
                  </p>
                </div>
              )}

              {/* DONE */}
              {scanState === "done" && (
                <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                  <CheckCircle
                    size={56}
                    color="#16a34a"
                    style={{ marginBottom: "1rem" }}
                  />
                  <h3 style={{ color: "#166534", margin: "0 0 0.5rem" }}>
                    Inventory Updated!
                  </h3>
                  <p
                    style={{
                      color: "#64748b",
                      margin: "0 0 1.5rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    {scanResult?.items?.length} item
                    {scanResult?.items?.length !== 1 ? "s" : ""} from DR #
                    {scanResult?.drNo} added to stock.
                  </p>
                  <button
                    onClick={closeScan}
                    className="btn-primary"
                    style={{ padding: "0.7rem 2rem" }}
                  >
                    Done
                  </button>
                </div>
              )}

              {/* PREVIEW: show extracted items for confirmation */}
              {scanState === "preview" && scanResult && (
                <div>
                  {/* Receipt header pill */}
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "0.75rem 1rem",
                      marginBottom: "1.25rem",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          display: "block",
                        }}
                      >
                        Supplier
                      </span>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {scanResult.supplier}
                      </strong>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          display: "block",
                        }}
                      >
                        DR No.
                      </span>
                      <strong style={{ fontSize: "0.9rem" }}>
                        #{scanResult.drNo}
                      </strong>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          display: "block",
                        }}
                      >
                        Date
                      </span>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {scanResult.date}
                      </strong>
                    </div>
                  </div>

                  <h4
                    style={{
                      margin: "0 0 0.75rem",
                      fontSize: "0.88rem",
                      textTransform: "uppercase",
                      color: "#64748b",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Extracted Items — verify & confirm
                  </h4>

                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      overflow: "hidden",
                      marginBottom: "1.25rem",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.88rem",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th
                            style={{
                              padding: "0.6rem 0.75rem",
                              textAlign: "left",
                              fontWeight: 700,
                              color: "#374151",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Item
                          </th>
                          <th
                            style={{
                              padding: "0.6rem 0.75rem",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#374151",
                              borderBottom: "1px solid #e2e8f0",
                              width: "90px",
                            }}
                          >
                            Qty
                          </th>
                          <th
                            style={{
                              padding: "0.6rem 0.75rem",
                              textAlign: "center",
                              fontWeight: 700,
                              color: "#374151",
                              borderBottom: "1px solid #e2e8f0",
                              width: "40px",
                            }}
                          ></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResult.items.map((it, idx) => (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px solid #f1f5f9" }}
                          >
                            <td style={{ padding: "0.6rem 0.75rem" }}>
                              <div
                                style={{ fontWeight: 700, color: "#0f172a" }}
                              >
                                {it.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                  fontFamily: "monospace",
                                }}
                              >
                                {it.code}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "0.6rem 0.75rem",
                                textAlign: "right",
                              }}
                            >
                              <input
                                type="number"
                                value={it.qty}
                                min="0"
                                onChange={(e) =>
                                  setScanResult((prev) => ({
                                    ...prev,
                                    items: prev.items.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            qty: Number(e.target.value),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                                style={{
                                  width: "75px",
                                  padding: "0.35rem 0.5rem",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "6px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                  fontSize: "0.9rem",
                                }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "0.6rem 0.5rem",
                                textAlign: "center",
                              }}
                            >
                              <button
                                onClick={() =>
                                  setScanResult((prev) => ({
                                    ...prev,
                                    items: prev.items.filter(
                                      (_, i) => i !== idx
                                    ),
                                  }))
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#ef4444",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      onClick={() => {
                        setScanState("idle");
                        setScanResult(null);
                      }}
                      className="btn-secondary"
                      style={{ flex: 1 }}
                    >
                      ← Retake
                    </button>
                    <button
                      onClick={handleScanConfirm}
                      className="btn-primary"
                      style={{
                        flex: 2,
                        background: "linear-gradient(135deg, #16a34a, #15803d)",
                      }}
                    >
                      ✓ Add {scanResult.items.filter((i) => i.qty > 0).length}{" "}
                      Item
                      {scanResult.items.filter((i) => i.qty > 0).length !== 1
                        ? "s"
                        : ""}{" "}
                      to Inventory
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    );
};

export default AIReceiptScannerModal;
