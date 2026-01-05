// removed unused import: doc, getDoc
// Low Stock Alerts logic moved inside the Inventory component below
import React from "react";
import { getFirestore, collection, getDocs, Timestamp } from "firebase/firestore";
// removed unused import
import Sidebar from "../components/Sidebar";
import "./Inventory.css";
import { utils as XLSXUtils, writeFile as writeXLSXFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parse } from 'date-fns';

interface InventoryItem {
  product: string;
  code: string;
  category: string;
  unit: string;
  quantity: number;
  expiry?: string;
  warehouse?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  reason?: string;
  updatedByName?: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  type?: string;
}

export default function Inventory() {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = React.useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = React.useState<string>("All Warehouses");
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);
  // --- Export modal and filter states ---
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [filterCategory, setFilterCategory] = React.useState<string>("All");
  const [filterProduct, setFilterProduct] = React.useState<string>("All");
  const [filterType, setFilterType] = React.useState<string>("All");

  const parseDateString = (dateStr: string): Date => {
    try {
      return parse(dateStr, 'dd/MM/yyyy, HH:mm:ss', new Date());
    } catch {
      return new Date(dateStr);
    }
  };

  // Fetch warehouses list
  const fetchWarehouses = React.useCallback(async () => {
    try {
      const db = getFirestore();
      const warehousesSnapshot = await getDocs(collection(db, "warehouses"));
      const warehouseNames: string[] = warehousesSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.name || doc.id;
      });
      setWarehouses(warehouseNames);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  }, []);

  // Fetch inventory from transactions subcollections of selected warehouse or all warehouses
  const fetchInventory = React.useCallback(async () => {
    try {
      const db = getFirestore();
      const inventoryItems: InventoryItem[] = [];

      if (selectedWarehouse === "All Warehouses") {
        const warehousesSnapshot = await getDocs(collection(db, "warehouses"));

        for (const warehouseDoc of warehousesSnapshot.docs) {
          const warehouseData = warehouseDoc.data();
          const warehouseName = warehouseData.name || warehouseDoc.id;

          const transactionsSnapshot = await getDocs(
            collection(db, "warehouses", warehouseDoc.id, "transactions")
          );

          for (const docSnap of transactionsSnapshot.docs) {
            const data = docSnap.data();

            // Use 'By' field directly from transaction document
            let staffName: string | undefined = undefined;
            if (typeof data.By === "string" && data.By.trim() !== "") {
              staffName = data.By;
            }

            // Handle expiryDate display
            let expiryStr: string | undefined = undefined;
            if (data.expiryDate instanceof Timestamp) {
              expiryStr = data.expiryDate.toDate().toLocaleDateString();
            } else if (typeof data.expiryDate === "string") {
              expiryStr = data.expiryDate;
            }

            // Handle date/timestamp display (mapped to lastUpdatedAt)
            let lastUpdatedAtStr: string | undefined = undefined;
            if (data.date?.toDate) {
              lastUpdatedAtStr = data.date.toDate().toLocaleString();
            } else if (data.timestamp?.toDate) {
              lastUpdatedAtStr = data.timestamp.toDate().toLocaleString();
            } else if (typeof data.date === "string") {
              lastUpdatedAtStr = data.date;
            } else if (typeof data.timestamp === "string") {
              lastUpdatedAtStr = data.timestamp;
            }

            let reasonStr: string | undefined = undefined;
            if (data.type === "transferOut" && data.toWarehouse) {
              reasonStr = `Transfer OUT → ${data.toWarehouse}`;
            } else if (data.type === "transferIn" && data.fromWarehouse) {
              reasonStr = `Transfer IN ← ${data.fromWarehouse}`;
            } else if (typeof data.reason === "string") {
              reasonStr = data.reason;
            }

            // Each transaction document creates a new InventoryItem entry
            inventoryItems.push({
              product: typeof data.product === "string" ? data.product : "",
              code: typeof data.code === "string" ? data.code : "",
              category: typeof data.category === "string" ? data.category : "",
              unit: typeof data.unit === "string" ? data.unit : "",
              quantity: typeof data.quantity === "number" ? data.quantity : 0,
              expiry: expiryStr,
              warehouse: warehouseName,
              lastUpdatedBy: typeof data.lastUpdatedBy === "string" ? data.lastUpdatedBy : undefined,
              lastUpdatedAt: lastUpdatedAtStr,
              reason: reasonStr,
              updatedByName: staffName,
              fromWarehouse: typeof data.fromWarehouse === "string" ? data.fromWarehouse :
                             typeof data.fromWarehouseId === "string" ? data.fromWarehouseId : undefined,
              toWarehouse: typeof data.toWarehouse === "string" ? data.toWarehouse :
                           typeof data.toWarehouseId === "string" ? data.toWarehouseId : undefined,
              type:
                typeof data.type === "string"
                  ? (data.type.toLowerCase() === "stockin"
                      ? "stockIn"
                      : data.type.toLowerCase() === "stockout"
                      ? "stockOut"
                      : data.type)
                  : undefined,
            });
          }
        }
      } else {
        // Find warehouse doc ID by matching name or ID
        const warehousesSnapshot = await getDocs(collection(db, "warehouses"));
        const warehouseDoc = warehousesSnapshot.docs.find(doc => {
          const data = doc.data();
          const name = data.name || doc.id;
          return name === selectedWarehouse;
        });

        if (warehouseDoc) {
          const warehouseName = selectedWarehouse;
          const transactionsSnapshot = await getDocs(
            collection(db, "warehouses", warehouseDoc.id, "transactions")
          );

          for (const docSnap of transactionsSnapshot.docs) {
            const data = docSnap.data();

            let staffName: string | undefined = undefined;
            if (typeof data.By === "string" && data.By.trim() !== "") {
              staffName = data.By;
            }

            let expiryStr: string | undefined = undefined;
            if (data.expiryDate instanceof Timestamp) {
              expiryStr = data.expiryDate.toDate().toLocaleDateString();
            } else if (typeof data.expiryDate === "string") {
              expiryStr = data.expiryDate;
            }

            let lastUpdatedAtStr: string | undefined = undefined;
            if (data.date?.toDate) {
              lastUpdatedAtStr = data.date.toDate().toLocaleString();
            } else if (data.timestamp?.toDate) {
              lastUpdatedAtStr = data.timestamp.toDate().toLocaleString();
            } else if (typeof data.date === "string") {
              lastUpdatedAtStr = data.date;
            } else if (typeof data.timestamp === "string") {
              lastUpdatedAtStr = data.timestamp;
            }

            let reasonStr: string | undefined = undefined;
            if (data.type === "transferOut" && data.toWarehouse) {
              reasonStr = `Transfer OUT → ${data.toWarehouse}`;
            } else if (data.type === "transferIn" && data.fromWarehouse) {
              reasonStr = `Transfer IN ← ${data.fromWarehouse}`;
            } else if (typeof data.reason === "string") {
              reasonStr = data.reason;
            }

            inventoryItems.push({
              product: typeof data.product === "string" ? data.product : "",
              code: typeof data.code === "string" ? data.code : "",
              category: typeof data.category === "string" ? data.category : "",
              unit: typeof data.unit === "string" ? data.unit : "",
              quantity: typeof data.quantity === "number" ? data.quantity : 0,
              expiry: expiryStr,
              warehouse: warehouseName,
              lastUpdatedBy: typeof data.lastUpdatedBy === "string" ? data.lastUpdatedBy : undefined,
              lastUpdatedAt: lastUpdatedAtStr,
              reason: reasonStr,
              updatedByName: staffName,
              fromWarehouse: typeof data.fromWarehouse === "string" ? data.fromWarehouse :
                             typeof data.fromWarehouseId === "string" ? data.fromWarehouseId : undefined,
              toWarehouse: typeof data.toWarehouse === "string" ? data.toWarehouse :
                           typeof data.toWarehouseId === "string" ? data.toWarehouseId : undefined,
              type:
                typeof data.type === "string"
                  ? (data.type.toLowerCase() === "stockin"
                      ? "stockIn"
                      : data.type.toLowerCase() === "stockout"
                      ? "stockOut"
                      : data.type)
                  : undefined,
            });
          }
        }
      }

      inventoryItems.sort((a, b) => {
        const timeA = a.lastUpdatedAt ? parseDateString(a.lastUpdatedAt).getTime() : 0;
        const timeB = b.lastUpdatedAt ? parseDateString(b.lastUpdatedAt).getTime() : 0;
        return timeB - timeA; // latest updates first
      });
      setItems(inventoryItems);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  }, [selectedWarehouse]);

  React.useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  React.useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Filter items by selected warehouse
  const filteredByWarehouse = React.useMemo(() => {
    if (selectedWarehouse === "All Warehouses") {
      return items;
    }
    return items.filter(item => item.warehouse === selectedWarehouse);
  }, [items, selectedWarehouse]);

  // Remove search logic, so highlightText just returns the text.
  const highlightText = (text: string | undefined) => {
    return text;
  };

  // Helper to export filtered items (for modal)
  const handleFilteredExport = (format: "csv" | "pdf") => {
    let filtered = [...items];

    if (filterCategory !== "All") {
      filtered = filtered.filter(i => i.category === filterCategory);
    }
    if (filterProduct !== "All") {
      filtered = filtered.filter(i => i.product === filterProduct);
    }
    if (filterType !== "All") {
      filtered = filtered.filter(i => i.type === filterType);
    }

    if (format === "csv") {
      const worksheet = XLSXUtils.json_to_sheet(filtered);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, "Inventory");
      writeXLSXFile(workbook, "Craving Bites Inventory.csv");
    } else {
      const doc = new jsPDF();
      const tableColumn = ["Product", "Code", "Category", "Quantity", "Unit", "Expiry Date", "Warehouse", "By", "Updated At", "Reason"];
      const tableRows = filtered.map(item => [
        item.product,
        item.code,
        item.category,
        item.quantity,
        item.unit,
        item.expiry || "",
        item.warehouse || "",
        item.updatedByName || "",
        item.lastUpdatedAt || "",
        item.reason || ""
      ]);
      autoTable(doc, { head: [tableColumn], body: tableRows });
      doc.save("Craving Bites Inventory.pdf");
    }
  };



  // Group transactions by product (sorted alphabetically)
  const groupedByProduct = React.useMemo(() => {
    const map: { [product: string]: InventoryItem[] } = {};
    filteredByWarehouse.forEach(item => {
      if (!item.product) return;
      if (!map[item.product]) map[item.product] = [];
      map[item.product].push(item);
    });
    // Sort product keys alphabetically
    const sortedMap: { [product: string]: InventoryItem[] } = {};
    Object.keys(map).sort((a, b) => a.localeCompare(b)).forEach(key => {
      sortedMap[key] = map[key];
    });
    return sortedMap;
  }, [filteredByWarehouse]);

  // State to control expanded/collapsed products
  const [expandedProducts, setExpandedProducts] = React.useState<{ [product: string]: boolean }>({});

  // Toggle collapsible section for a product
  const toggleProduct = (product: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [product]: !prev[product]
    }));
  };

  // Render grouped inventory table header (without Total Quantity)
  const renderGroupedTableHeader = () => (
    <thead>
      <tr>
        <th>Product</th>
        <th>Category</th>
        <th>Unit</th>
      </tr>
    </thead>
  );

  // Render product row (without total quantity)
  const renderGroupedProductRow = (product: string, transactions: InventoryItem[]) => {
    // Use first transaction for static info (category, unit)
    const first = transactions[0];
    return (
      <React.Fragment key={product}>
        <tr
          className="grouped-product-row"
          onClick={() => toggleProduct(product)}
        >
          <td style={{ cursor: "pointer" }}>
            <span style={{ marginRight: 6 }}>
              {expandedProducts[product] ? "▼" : "►"}
            </span>
            {highlightText(product)}
          </td>
          <td>{highlightText(first.category)}</td>
          <td>{highlightText(first.unit)}</td>
        </tr>
        {expandedProducts[product] && (
          <tr>
            <td colSpan={3} style={{ padding: 0 }}>
              {renderTransactionsTable(transactions)}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // Render the list of transactions for a product (sorted by lastUpdatedAt descending)
  const renderTransactionsTable = (transactions: InventoryItem[]) => {
    // Sort transactions by lastUpdatedAt descending
    const sorted = [...transactions].sort((a, b) => {
      const timeA = a.lastUpdatedAt ? parseDateString(a.lastUpdatedAt).getTime() : 0;
      const timeB = b.lastUpdatedAt ? parseDateString(b.lastUpdatedAt).getTime() : 0;
      return timeB - timeA;
    });
    return (
      <table className="transactions-table" style={{ width: "100%", background: "#f8f8f8", margin: 0 }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Quantity</th>
            <th>Warehouse</th>
            <th>By</th>
            <th>
              <span style={{ fontSize: "0.85em" }}>Updated At</span>
            </th>
            <th>Expiry</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => (
            <tr key={item.lastUpdatedAt + "-" + idx}>
              <td>{highlightText(item.code)}</td>
              <td>{item.quantity}</td>
              <td>{highlightText(item.warehouse)}</td>
              <td>{highlightText(item.updatedByName)}</td>
              <td>
                <span style={{ fontSize: "0.85em" }}>{highlightText(item.lastUpdatedAt)}</span>
              </td>
              <td>{highlightText(item.expiry)}</td>
              <td>{highlightText(item.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="inventory-wrapper flex">
      <Sidebar />
      <div className="inventory-container">
        <div className="inventory-header">
          <h1>Inventory</h1>
          <hr style={{ marginBottom: "1rem" }} />
          <div className="month-year-search" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <label>
              Warehouse:
              <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} style={{ marginLeft: "0.5rem" }}>
                <option key="all" value="All Warehouses">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            </label>
          </div>
          {/* Search input removed */}
        </div>

        <div className="inventory-section" id="stock-list">
          <h2>
            📦 Stock List
            {selectedWarehouse !== "All Warehouses" && (
              <> - {selectedWarehouse}</>
            )}
          </h2>
          <div className="stock-list-box">
            <table className="inventory-table">
              {renderGroupedTableHeader()}
              <tbody>
                {Object.keys(groupedByProduct).length > 0 ? (
                  Object.entries(groupedByProduct).map(([product, transactions]) =>
                    renderGroupedProductRow(product, transactions)
                  )
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center" }}>No results found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-actions">
              <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>EXPORT</button>
            </div>
          </div>
        </div>

        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Product Details</h3>
              <table className="detail-table">
                <tbody>
                  <tr><td><strong>Product</strong></td><td>{selectedItem.product}</td></tr>
                  <tr><td><strong>Code</strong></td><td>{selectedItem.code}</td></tr>
                  <tr><td><strong>Category</strong></td><td>{selectedItem.category}</td></tr>
                  <tr><td><strong>Quantity</strong></td><td>{selectedItem.quantity}</td></tr>
                  <tr><td><strong>Unit</strong></td><td>{selectedItem.unit}</td></tr>
                  <tr><td><strong>Expiry</strong></td><td>{selectedItem.expiry}</td></tr>
                  <tr><td><strong>Warehouse</strong></td><td>{selectedItem.warehouse}</td></tr>
                  <tr><td><strong>By</strong></td><td>{selectedItem.updatedByName}</td></tr>
                  <tr><td><strong>Updated At</strong></td><td>{selectedItem.lastUpdatedAt}</td></tr>
                  <tr><td><strong>Reason</strong></td><td>{selectedItem.reason}</td></tr>
                </tbody>
              </table>
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Export modal */}
        {showExportModal && (
          <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Export Filters</h3>

              <label>
                Category:
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="All">All</option>
                  {[...new Set(items.map(i => i.category))].sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label>
                Product:
                <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
                  <option value="All">All</option>
                  {items
                    .filter(i => filterCategory === "All" ? true : i.category === filterCategory)
                    .map(i => i.product)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                </select>
              </label>

              <label>
                Type:
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="All">All</option>
                  {[...new Set(items.map(i => i.type))].filter(Boolean).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <button className="btn btn-primary" onClick={() => {
                setShowExportModal(false);
                handleFilteredExport("csv");
              }}>Export CSV</button>

              <button className="btn btn-primary" onClick={() => {
                setShowExportModal(false);
                handleFilteredExport("pdf");
              }}>Export PDF</button>
            </div>
          </div>
        )}
      </div>

      {/* Styling for category-links and quick-nav buttons, and improved table/modal readability */}
      <style>{`
        .category-links button,
        .quick-nav-container button {
          margin-right: 10px;
          cursor: pointer;
        }
        .grouped-product-row:hover {
          background: #ffe28a;
        }
        .transactions-table th, .transactions-table td {
          font-size: 1.1em;
          padding: 8px 10px;
        }
        .transactions-table tr:hover {
          background: #f0f0f0;
        }
        .detail-table td {
          font-size: 1.1em;
          padding: 6px 8px;
        }
        .detail-table tr td:first-child {
          font-weight: bold;
          width: 120px;
        }
        .modal-overlay {
          position: fixed;
          top:0; left:0; right:0; bottom:0;
          background: rgba(0,0,0,0.5);
          display:flex;
          align-items:center;
          justify-content:center;
          z-index:9999;
        }
        .modal-content {
          background:white;
          padding:20px;
          border-radius:8px;
          width:300px;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
      `}</style>
    </div>
  );
}