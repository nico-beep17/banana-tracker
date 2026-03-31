import React, { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { LAvcLogo } from "../assets/logoBase64";
import { toast } from "sonner";
import {
  Package,
  Search,
  Printer,
  Plus,
  Edit2,
  Archive,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  Trash2,
  ListPlus,
  Warehouse,
  Tractor,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Truck,
  Camera,
  Loader,
  CheckCircle,
  XCircle,
} from "lucide-react";
import "./MaterialsInventory.css";

const MaterialsInventory = ({
  inventoryItems = [],
  setInventoryItems,
  farms = [],
}) => {
  const [activeView, setActiveView] = useState("global");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  // ── AI Receipt Scanner ────────────────────────────────────────────────────
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanImage, setScanImage] = useState(null); // base64 data URL
  const [scanImageFile, setScanImageFile] = useState(null); // File object
  const [scanState, setScanState] = useState("idle"); // idle | scanning | preview | saving | done | error
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState(null); // { drNo, date, supplier, items: [{code,name,qty}] }
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScanImage(ev.target.result);
    reader.readAsDataURL(file);
    setScanState("idle");
    setScanResult(null);
    setScanError("");
  };

  const handleScanReceipt = async () => {
    if (!scanImage) return;
    setScanState("scanning");
    setScanError("");
    try {
      const { visionCompletion } = await import('../utils/geminiAPI');

      // Convert image to base64 content (strip data URL prefix)
      const base64 = scanImage.split(",")[1];
      const mimeType = scanImage.split(";")[0].split(":")[1] || "image/jpeg";

      const prompt = `You are a data extraction AI for an inventory system at LFJ Agri-Ventures Corp, a banana exporting company.
Analyze this supplier delivery receipt image and extract ALL line items.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "drNo": "string (DR/receipt number)",
  "date": "YYYY-MM-DD (receipt date)",
  "supplier": "string (supplier company name)",
  "items": [
    {
      "code": "short item code like COVER-40ECT or BODY-51ECT or BOTPAD-200",
      "name": "full item name from receipt",
      "qty": number
    }
  ]
}

Banana packaging items to recognize:
- "PREMIUM BANANAS COVER" or "COVER WKL" or "40ECT" = banana box cover (code: COVER-40ECT)
- "LFJ BODY" or "BODY - 51ECT" = banana box body (code: BODY-51ECT)
- "ALL IN BOTTOM PADS" or "BOTTOM PADS" or "200GSM" = bottom pads (code: BOTPAD-200GSM)
- Any other item = use a short descriptive code

For quantities, use the printed number in the "Quantity" column, not bundle counts. Only return items that have a clear quantity.`;

      const raw = await visionCompletion({
        prompt,
        imageBase64: base64,
        mimeType,
        model: 'gemini-2.5-flash',
        maxTokens: 1000,
      });

      if (!raw) throw new Error("No response from AI.");

      // Safely extract JSON from markdown if Gemini included conversational text
      let cleaned = raw;
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        cleaned = jsonMatch[1];
      } else {
        cleaned = raw.replace(/^```(json)?/mi, '').replace(/```$/m, '').trim();
      }
      
      const parsed = JSON.parse(cleaned);

      if (!parsed.items || parsed.items.length === 0)
        throw new Error("No items detected. Try a clearer photo.");

      setScanResult(parsed);
      setScanState("preview");
    } catch (err) {
      console.error("Scan error:", err);
      setScanError(err.message || "Unknown error");
      setScanState("error");
    }
  };

  const handleScanConfirm = async () => {
    if (!scanResult?.items?.length) return;
    setScanState("saving");
    try {
      const payloads = scanResult.items
        .filter((it) => it.qty > 0)
        .map((it) => {
          const existing = inventoryItems.find(
            (i) =>
              i.item_code === it.code ||
              i.item_name
                ?.toLowerCase()
                .includes(it.name?.toLowerCase().slice(0, 10))
          );
          return {
            ...(existing ? { id: existing.id } : {}),
            item_code: it.code,
            item_name: it.name,
            supplier_details: scanResult.supplier || "Scanned Receipt",
            stock_in: (existing?.stock_in || 0) + Number(it.qty),
            stock_out: existing?.stock_out || 0,
            last_updated: new Date().toISOString(),
          };
        });

      const { data, error } = await supabase
        .from("materials_inventory")
        .upsert(payloads)
        .select();
      if (error) throw new Error(error.message);
      if (data) {
        const ids = data.map((d) => d.id);
        setInventoryItems((prev) => [
          ...data,
          ...prev.filter((p) => !ids.includes(p.id)),
        ]);
      }
      setScanState("done");
    } catch (err) {
      setScanError(err.message);
      setScanState("error");
    }
  };

  const closeScan = () => {
    setIsScanOpen(false);
    setScanImage(null);
    setScanImageFile(null);
    setScanState("idle");
    setScanResult(null);
    setScanError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // State for Physical Deliveries (Usage)
  const [deliveries, setDeliveries] = useState([]);

  useEffect(() => {
    const fetchDeliveries = async () => {
      const { data, error } = await supabase
        .from("material_deliveries")
        .select("*");
      if (!error && data) {
        setDeliveries(data);
      }
    };
    fetchDeliveries();
  }, []);

  const [farmFilter, setFarmFilter] = useState("ALL");
  const [expandedFarm, setExpandedFarm] = useState(null);

  // Modals
  const [isBulkDeliveryOpen, setIsBulkDeliveryOpen] = useState(false);

  // Bulk Forms State
  const [bulkFarm, setBulkFarm] = useState("");
  const [bulkRef, setBulkRef] = useState("");
  const [bulkDate, setBulkDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [bulkItems, setBulkItems] = useState([{ itemCode: "", quantity: "" }]);

  // COMPUTED VALUES

  // Total physically delivered per item (deducts from Global)
  const totalDeliveredPerItem = useMemo(() => {
    const result = {};
    (deliveries || []).forEach((d) => {
      if (!result[d.itemCode]) result[d.itemCode] = 0;
      result[d.itemCode] += Number(d.quantity) || 0;
    });
    return result;
  }, [deliveries]);

  // Global Stock = stock_in - stock_out - physical deliveries
  const warehouseStock = useMemo(() => {
    return (inventoryItems || []).map((item) => {
      const delivered = totalDeliveredPerItem[item.item_code] || 0;
      const balance = (item.stock_in || 0) - (item.stock_out || 0) - delivered;
      return { ...item, warehouseBalance: balance };
    });
  }, [inventoryItems, totalDeliveredPerItem]);

  // Per-farm balance
  const farmData = useMemo(() => {
    const result = {};
    (deliveries || []).forEach((d) => {
      if (!result[d.farmCode])
        result[d.farmCode] = { history: [], delivered: {} };
      if (!result[d.farmCode].delivered[d.itemCode])
        result[d.farmCode].delivered[d.itemCode] = 0;
      result[d.farmCode].delivered[d.itemCode] += Number(d.quantity) || 0;
      result[d.farmCode].history.push({ ...d, type: "DELIVERY" });
    });
    return result;
  }, [deliveries]);

  const farmsWithActivity = useMemo(() => {
    const set = new Set([...(deliveries || []).map((d) => d.farmCode)]);
    return [...set];
  }, [deliveries]);

  const handleOpenBulkDelivery = () => {
    let nextNumber = 1;

    (deliveries || []).forEach((d) => {
      if (d.referenceNo && d.referenceNo.startsWith("MIS-")) {
        const parts = d.referenceNo.split("-");
        if (parts.length > 1) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    });

    const nextMisNumber = `MIS-${String(nextNumber).padStart(4, "0")}`;

    setBulkFarm("");
    setBulkRef(nextMisNumber);
    setBulkItems([{ itemCode: "", quantity: "" }]);
    setIsBulkDeliveryOpen(true);
  };

  // BULK HANDLERS
  const addBulkRow = () =>
    setBulkItems((prev) => [...prev, { itemCode: "", quantity: "" }]);
  const removeBulkRow = (idx) =>
    setBulkItems((prev) => prev.filter((_, i) => i !== idx));
  const updateBulkRow = (idx, field, value) => {
    setBulkItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleBulkSubmit = async () => {
    try {
      if (!bulkFarm) {
        toast.warning("Please select a farm.");
        return;
      }
      const validItems = bulkItems.filter(
        (it) => it.itemCode && it.quantity > 0
      );
      if (validItems.length === 0) {
        toast.warning("Add at least one item with qty > 0.");
        return;
      }

      const newEntries = validItems.map((it) => ({
        date: bulkDate,
        farmCode: bulkFarm,
        itemCode: it.itemCode,
        quantity: Number(it.quantity),
        referenceNo: bulkRef,
      }));

      const { data, error } = await supabase
        .from("material_deliveries")
        .insert(newEntries)
        .select();

      if (error) {
        console.error("Insert error:", error);
        toast.error(
          "Failed to save deliveries to database: " +
            error.message +
            " (Check if Fix Deliveries SQL was run if this is an RLS policy issue)"
        );
        return;
      }

      if (data) {
        setDeliveries((prev) => [...data, ...prev]);
      }

      setIsBulkDeliveryOpen(false);

      // Reset
      setBulkFarm("");
      setBulkRef("");
      setBulkItems([{ itemCode: "", quantity: "" }]);
    } catch (err) {
      console.error("Critical error in handleBulkSubmit:", err);
      toast.error("A critical error prevented saving: " + err.message);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    const { error } = await supabase
      .from("material_deliveries")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
  };

  // ITEM MANAGEMENT (SUPABASE)
  const initialItemState = {
    item_code: "",
    item_name: "",
    supplier_details: "",
    unit: "",
    price_php: "",
    stock_in: 0,
    stock_out: 0,
  };
  const [newItem, setNewItem] = useState(initialItemState);
  const [batchItems, setBatchItems] = useState([{ ...initialItemState }]);

  const handleBatchInputChange = (index, e) => {
    const { name, value, type } = e.target;
    const newBatch = [...batchItems];
    const newValue =
      type === "number" ? (value === "" ? "" : Number(value)) : value;
    let updatedRow = { ...newBatch[index], [name]: newValue };
    if (name === "item_code") {
      const existingItem = inventoryItems.find(
        (item) => item.item_code === newValue
      );
      if (existingItem) {
        updatedRow = {
          ...updatedRow,
          id: existingItem.id,
          item_name: existingItem.item_name || "",
          supplier_details: existingItem.supplier_details || "",
          unit: existingItem.unit || "",
          price_php: existingItem.price_php || "",
          existing_stock_in: existingItem.stock_in || 0,
          existing_stock_out: existingItem.stock_out || 0,
          stock_in: 0,
          stock_out: 0,
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
      .filter((item) => item.item_code?.trim() && item.item_name?.trim())
      .map((item) => {
        const { existing_stock_in, existing_stock_out, ...rest } = item;
        return {
          ...rest,
          stock_in: (existing_stock_in || 0) + (Number(item.stock_in) || 0),
          stock_out: (existing_stock_out || 0) + (Number(item.stock_out) || 0),
          last_updated: new Date().toISOString(),
        };
      });
    if (payloads.length === 0) {
      setErrorMsg("⚠️ No valid items to submit.");
      return;
    }
    const { data, error } = await supabase
      .from("materials_inventory")
      .upsert(payloads)
      .select();
    if (error) {
      setErrorMsg(`⚠️ ${error.message}`);
      return;
    }
    if (data) {
      const ids = data.map((d) => d.id);
      setInventoryItems((prev) => [
        ...data,
        ...prev.filter((p) => !ids.includes(p.id)),
      ]);
      setIsBatchFormOpen(false);
      setBatchItems([{ ...initialItemState }]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setNewItem((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    // Strip computed/virtual fields and system-generated columns that don't exist as writable DB columns
    const { warehouseBalance, warehouseDelivered, id, created_at, ...cleanItem } = newItem;
    const payload = { ...cleanItem, last_updated: new Date().toISOString() };
    if (editItemId) {
      const { data, error } = await supabase
        .from("materials_inventory")
        .update(payload)
        .eq("id", editItemId)
        .select();
      if (error) {
        setErrorMsg(`⚠️ ${error.message}`);
        return;
      }
      if (data?.[0]) {
        setInventoryItems((prev) =>
          prev.map((i) => (i.id === editItemId ? data[0] : i))
        );
        closeModal();
      }
    } else {
      const { data, error } = await supabase
        .from("materials_inventory")
        .insert([payload])
        .select();
      if (error) {
        setErrorMsg(`⚠️ ${error.message}`);
        return;
      }
      if (data?.[0]) {
        setInventoryItems((prev) => [data[0], ...prev]);
        closeModal();
      }
    }
  };

  const handleDeleteInventoryItem = async (id) => {
    if (
      !window.confirm("Are you sure you want to permanently delete this item?")
    )
      return;
    const { error } = await supabase
      .from("materials_inventory")
      .delete()
      .eq("id", id);
    if (error) {
      setErrorMsg(`⚠️ Error deleting item: ${error.message}`);
    } else {
      setInventoryItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const closeModal = () => {
    setIsFormOpen(false);
    setEditItemId(null);
    setNewItem(initialItemState);
    setErrorMsg(null);
  };

  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document
      .write(`<html><head><title>Inventory Report</title><style>body{font-family:sans-serif;padding:2rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}.header-container{display:flex;align-items:center;margin-bottom:20px}.logo-img{width:60px;height:auto;margin-right:15px}</style></head>
        <body>
        <div class="header-container">
            <img src="${LAvcLogo}" class="logo-img" alt="LAVC Logo" onload="window.print()" onerror="window.print()" />
            <div>
                <h1 style="margin:0">LFJ AGRI VENTURES CORP.</h1>
                <h2 style="margin:5px 0 0 0; color:#555;">Materials Inventory Report</h2>
                <p style="margin:5px 0 0 0; font-size:12px">Generated: ${new Date().toLocaleString()}</p>
            </div>
        </div>
        <table><tr><th>Item Code</th><th>Name</th><th>Warehouse Stock</th></tr>
        ${warehouseStock
          .map(
            (i) =>
              `<tr><td>${i.item_code}</td><td>${i.item_name}</td><td>${i.warehouseBalance}</td></tr>`
          )
          .join("")}
        </table></body></html>`);
    printWindow.document.close();
  };

  const handlePrintMIS = (misNumber, date, farmCode) => {
    // Collect all delivery records with this MIS Number, Date, and Farm
    const deliveredItems = deliveries.filter(
      (d) =>
        d.referenceNo === misNumber &&
        d.date === date &&
        d.farmCode === farmCode
    );

    if (deliveredItems.length === 0) {
      toast.warning("No items found for this MIS Number.");
      return;
    }

    const farmName =
      farms.find((f) => (f.farmCode || f.code) === farmCode)?.name || farmCode;

    const dateObj = new Date(date);
    const formattedDate = !isNaN(dateObj)
      ? dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : date;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
            <html>
            <head>
                <title>Materials Issuance Slip - ${misNumber}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; font-size: 13px; margin: 0; padding: 40px; }
                    .header { text-align: center; margin-bottom: 20px; position: relative; }
                    .header h1 { font-family: 'Arial Black', Impact, sans-serif; font-size: 24px; margin: 0; letter-spacing: 1px; }
                    .header p { font-size: 11px; margin: 2px 0 0 0; }
                    .slip-title { text-align: center; margin: 25px 0 15px 0; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
                    .top-right-info { position: absolute; right: 0; top: 25px; text-align: right; }
                    .mis-no { color: #dc2626; font-weight: bold; font-size: 14px; margin-bottom: 5px; font-family: 'Courier New', monospace; }
                    .date-text { text-transform: uppercase; font-size: 11px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
                    th { font-weight: bold; font-size: 12px; }
                    td.desc { text-align: left; text-transform: uppercase; font-size: 11px; font-weight: bold; }
                    .signatures { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
                    .sig-line { border-top: 1px solid #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .sig-title { font-size: 10px; margin-top: 2px; }
                    .remarks-row { text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; border: 1px solid #000; border-top: none; padding: 6px 8px; }
                    .logo-img { position: absolute; left: 0; top: 0; width: 60px; height: auto; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${LAvcLogo}" class="logo-img" alt="LAVC Logo" onload="window.print()" onerror="window.print()" />
                    <h1>LFJ AGRI VENTURES CORP.</h1>
                    <p>PUROK 3, SAN VICENTE PANABO CITY DAVAO DEL NORTE</p>
                    
                    <div class="top-right-info">
                        <div class="mis-no">No. ${
                          misNumber || "__________"
                        }</div>
                        <div class="date-text">DATE: ${formattedDate}</div>
                    </div>
                </div>

                <div class="slip-title">MATERIALS ISSUANCE SLIP</div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%">ITEM CODE</th>
                            <th style="width: 40%">ITEM DESCRIPTION</th>
                            <th style="width: 10%">UOM</th>
                            <th style="width: 15%">QUANTITY</th>
                            <th style="width: 20%">PURPOSE/ACTIVITY</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deliveredItems
                          .map((item, idx) => {
                            const itemName =
                              inventoryItems.find(
                                (i) => i.item_code === item.itemCode
                              )?.item_name || item.itemCode;
                            // Infer UOM if possible, else default to PCS
                            let uom = "PCS";
                            if (
                              itemName.toUpperCase().includes("RUBBER BAND") ||
                              itemName.toUpperCase().includes("GLUE")
                            )
                              uom = "KILO";
                            if (itemName.toUpperCase().includes("STICKER"))
                              uom = "SHEET";

                            return `
                                <tr>
                                    <td>${item.itemCode}</td>
                                    <td class="desc">${itemName}</td>
                                    <td>${uom}</td>
                                    <td style="font-weight: bold">${
                                      item.quantity
                                    }</td>
                                    ${
                                      idx === 0
                                        ? `<td rowspan="${Math.max(
                                            deliveredItems.length,
                                            5
                                          )}" style="vertical-align: middle; font-size: 11px;">PACKING HOUSE USED</td>`
                                        : ""
                                    }
                                </tr>
                            `;
                          })
                          .join("")}
                        ${Array.from({
                          length: Math.max(0, 10 - deliveredItems.length),
                        })
                          .map(
                            (_, idx) => `
                            <tr>
                                <td>&nbsp;</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                ${
                                  deliveredItems.length === 0 && idx === 0
                                    ? `<td rowspan="10"></td>`
                                    : ""
                                }
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
                <div class="remarks-row">
                    REMARKS @ ${farmName.toUpperCase()}
                </div>

                <div class="signatures">
                    <div>
                        <div style="height: 40px;"></div>
                        <div class="sig-line">ISSUED BY</div>
                        <div class="sig-title">WAREHOUSEMAN</div>
                    </div>
                    <div>
                        <div style="height: 40px;"></div>
                        <div class="sig-line">TRUCK DRIVER/PLATE #</div>
                    </div>
                    <div>
                        <div style="height: 40px;"></div>
                        <div class="sig-line">RECEIVED BY</div>
                        <div class="sig-title">GROWER/END USER</div>
                    </div>
                </div>
            </body>
            </html>
        `);
    printWindow.document.close();
    // print is triggered by the logo img onload event
  };

  const filteredItems = warehouseStock.filter(
    (item) =>
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="materials-inventory-page animation-fade-in"
      style={{ padding: "1.5rem" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              margin: 0,
            }}
          >
            <Package size={28} color="var(--color-primary-dark)" />
            Materials Hub
          </h2>
          <p
            style={{
              color: "var(--text-tertiary)",
              margin: "0.25rem 0 0",
              fontSize: "0.9rem",
            }}
          >
            Comprehensive tracking of inventory stock and direct farm
            deliveries.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={handlePrintReport}>
            <Printer size={16} /> Print
          </button>
          <button
            className="btn-secondary"
            onClick={() => setIsScanOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "white",
              border: "none",
              fontWeight: 700,
            }}
          >
            <Camera size={16} /> Scan Receipt
          </button>
          <button className="btn-primary" onClick={() => setIsFormOpen(true)}>
            <Plus size={16} /> Register Item
          </button>
        </div>
      </div>
      {/* GLOBAL VIEW */}
      <div className="animation-fade-in">
        <div
          className="metrics-grid"
          style={{
            marginBottom: "1.5rem",
            gridTemplateColumns: "repeat(2, 1fr)",
          }}
        >
          <div className="metric-card">
            <span className="metric-label">Warehouse Items</span>
            <span className="metric-value">{inventoryItems.length}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total Stock Units</span>
            <span className="metric-value">
              {warehouseStock
                .reduce((a, c) => a + c.warehouseBalance, 0)
                .toLocaleString()}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div
            className="inventory-controls"
            style={{
              padding: "1rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
            }}
          >
            <div className="search-box" style={{ flex: 1, margin: 0 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="btn-secondary"
              onClick={() => setIsBatchFormOpen(true)}
            >
              <ListPlus size={16} /> Batch Update
            </button>
            <button
              className="btn-primary"
              onClick={handleOpenBulkDelivery}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Truck size={16} /> Physical Delivery
            </button>
          </div>
          <div className="table-responsive">
            <table className="banana-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="text-right">Units In</th>
                  <th className="text-right">Units Out</th>
                  <th className="text-right" style={{ color: "#ef4444" }}>
                    Delivered
                  </th>
                  <th className="text-right">Global Stock</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Material">
                      <div style={{ fontWeight: "700" }}>{item.item_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {item.item_code}
                      </div>
                    </td>
                    <td data-label="In" className="text-right">
                      {item.stock_in}
                    </td>
                    <td data-label="Out" className="text-right">
                      {item.stock_out}
                    </td>
                    <td
                      data-label="Delivered"
                      className="text-right"
                      style={{ color: "#ef4444", fontWeight: 600 }}
                    >
                      {totalDeliveredPerItem[item.item_code] || 0}
                    </td>
                    <td
                      data-label="Stock"
                      className="text-right highlight-col"
                      style={{ fontWeight: 800 }}
                    >
                      {item.warehouseBalance}
                    </td>
                    <td data-label="" className="text-center">
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            const {
                              warehouseBalance,
                              warehouseDelivered,
                              ...editItem
                            } = item;
                            setEditItemId(item.id);
                            setNewItem(editItem);
                            setIsFormOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleDeleteInventoryItem(item.id)}
                          style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                          title="Delete item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "2rem 0 1.5rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Farm Deliveries Log</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              Record and view direct deliveries to farms.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <select
            className="input-field"
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            style={{ maxWidth: "300px" }}
          >
            <option value="ALL">All Active Farms</option>
            {farmsWithActivity.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        {farmsWithActivity
          .filter((f) => farmFilter === "ALL" || f === farmFilter)
          .map((farmCode) => {
            const data = farmData[farmCode];
            const farmName =
              farms.find((f) => (f.farmCode || f.code) === farmCode)?.name ||
              farmCode;
            const isExpanded = expandedFarm === farmCode;

            return (
              <div
                key={farmCode}
                className="card"
                style={{ padding: 0, marginBottom: "1rem", overflow: "hidden" }}
              >
                <button
                  onClick={() => setExpandedFarm(isExpanded ? null : farmCode)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    background: "#f8fafc",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      textAlign: "left",
                    }}
                  >
                    <Tractor size={20} color="#16a34a" />
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "1rem" }}>
                        {farmCode} — {farmName}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {Object.keys(data.delivered).length} unique items
                        delivered
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>

                {isExpanded && (
                  <div className="animation-slide-down">
                    <div style={{ padding: "0 1rem 1rem", paddingTop: "1rem" }}>
                      <h4
                        style={{
                          fontSize: "0.85rem",
                          textTransform: "uppercase",
                          color: "#64748b",
                          marginBottom: "1rem",
                        }}
                      >
                        Delivery History
                      </h4>
                      <div className="table-responsive">
                        <table
                          className="banana-table"
                          style={{ fontSize: "0.85rem" }}
                        >
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Material</th>
                              <th className="text-right">Qty</th>
                              <th>Ref/OP</th>
                              <th className="text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.history
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((row) => (
                                <tr key={row.id}>
                                  <td data-label="Date">{row.date}</td>
                                  <td data-label="Item">{row.itemCode}</td>
                                  <td
                                    data-label="Qty"
                                    className="text-right"
                                    style={{
                                      fontWeight: 700,
                                      color: "#ef4444",
                                    }}
                                  >
                                    {row.quantity}
                                  </td>
                                  <td data-label="Ref">
                                    {row.referenceNo || "—"}
                                  </td>
                                  <td data-label="" className="text-center">
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "0.4rem",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <button
                                        onClick={() =>
                                          handleDeleteRecord(row.id)
                                        }
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#ef4444",
                                          cursor: "pointer",
                                        }}
                                        title="Delete History"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handlePrintMIS(
                                            row.referenceNo,
                                            row.date,
                                            farmCode
                                          )
                                        }
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#3b82f6",
                                          cursor: "pointer",
                                        }}
                                        title="Print MIS Slip"
                                      >
                                        <Printer size={16} />
                                      </button>
                                    </div>
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

      {/* MODALS */}
      {isBulkDeliveryOpen && (
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
      )}

      {/* SINGLE ITEM MODAL */}
      {isFormOpen && (
        <div className="inventory-form-overlay" onClick={closeModal}>
          <div
            className="inventory-form-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-modal-header">
              <h3>{editItemId ? "Update Material" : "New Material"}</h3>
              <button onClick={closeModal}>×</button>
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
      )}

      {/* BATCH MODAL */}
      {isBatchFormOpen && (
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
              <button onClick={() => setIsBatchFormOpen(false)}>×</button>
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
      )}

      {/* ── AI RECEIPT SCANNER MODAL ─────────────────────────────────── */}
      {isScanOpen && (
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
      )}

      {/* Spin keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MaterialsInventory;
