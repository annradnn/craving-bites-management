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
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<InventoryItem[]>([]);
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());

  // Fetch inventory from all warehouse transactions subcollections
  const fetchInventory = async () => {
    try {
      const db = getFirestore();
      const warehousesSnapshot = await getDocs(collection(db, "warehouses"));
      const inventoryItems: InventoryItem[] = [];

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
            type: typeof data.type === "string" ? data.type : undefined,
          });
        }
      }

      inventoryItems.sort((a, b) => {
        const dateA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
        const dateB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
        return dateB - dateA; // latest first
      });
      // Show all transactions (each transaction individually)
      setItems(inventoryItems);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  // Filter the current inventory items by selected month and year,
  // showing the filtered results in searchResults without overwriting items.
  const applyMonthYearFilter = () => {
    const filteredItems = items.filter(item => {
      if (!item.lastUpdatedAt) return false;
      // Try parsing as 'dd/MM/yyyy, HH:mm:ss' or fallback to Date parsing
      let date: Date;
      try {
        date = parse(item.lastUpdatedAt, 'dd/MM/yyyy, HH:mm:ss', new Date());
      } catch {
        date = new Date(item.lastUpdatedAt);
      }
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
    if (filteredItems.length === 0) {
      setSearchResults([]); // clear previous results
      alert(`No data found for ${new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })} ${selectedYear}`);
    } else {
      setSearchResults(filteredItems);
    }
  };

  React.useEffect(() => {
    fetchInventory();
  }, []);

  // Filter items by search term (dynamically on all string values)
  const filterItemsBySearch = (allItems: InventoryItem[], term: string) => {
    const lowerTerm = term.toLowerCase();
    return allItems.filter((item) => {
      return Object.values(item).some((value) =>
        typeof value === "string" && value.toLowerCase().includes(lowerTerm)
      );
    });
  };

  React.useEffect(() => {
    if (searchTerm.trim() !== "") {
      setSearchResults(filterItemsBySearch(items, searchTerm));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, items]);

  const highlightText = (text: string | undefined, searchTerm: string) => {
    if (!text) return text;
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
  };

  const exportCSV = () => {
    const displayedItems = searchTerm.trim() !== "" ? searchResults : items;
    const worksheet = XLSXUtils.json_to_sheet(displayedItems);
    const workbook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(workbook, worksheet, "Inventory");
    writeXLSXFile(workbook, "inventory.csv");
  };

  const exportPDF = () => {
    const displayedItems = searchTerm.trim() !== "" ? searchResults : items;
    const doc = new jsPDF();
    const tableColumn = ["Product", "Code", "Category", "Quantity", "Unit", "Expiry Date", "Warehouse", "By", "Updated At", "Reason", "Transfer Direction"];
    const tableRows: (string | number)[][] = [];

    displayedItems.forEach(item => {
      tableRows.push([
        item.product,
        item.code,
        item.category,
        item.quantity,
        item.unit,
        item.expiry || "",
        item.warehouse || "",
        item.updatedByName || "",
        item.lastUpdatedAt || "",
        item.reason || "",
        item.type === "transferOut" && item.toWarehouse ? `OUT ${item.toWarehouse}` :
        item.type === "transferIn" && item.fromWarehouse ? `IN ${item.fromWarehouse}` : ""
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
    });

    doc.save("inventory.pdf");
  };

  const renderSearchFlatTableHeader = () => (
    <thead>
      <tr>
        <th>Product</th>
        <th>Code</th>
        <th>Category</th>
        <th>Quantity</th>
        <th>Unit</th>
        <th>Expiry Date</th>
        <th>Warehouse</th>
        <th>By</th>
        <th>Updated At</th>
        <th>Reason</th>
        <th>Transfer Direction</th>
      </tr>
    </thead>
  );

  const renderSearchFlatRow = (item: InventoryItem, idx: number) => (
    <tr key={(item.code || idx) + "-flat"}>
      <td onClick={() => setSelectedItem(item)} className="clickable">{highlightText(item.product, searchTerm)}</td>
      <td>{highlightText(item.code, searchTerm)}</td>
      <td>{highlightText(item.category, searchTerm)}</td>
      <td>{item.quantity}</td>
      <td>{highlightText(item.unit, searchTerm)}</td>
      <td>{highlightText(item.expiry, searchTerm)}</td>
      <td>{highlightText(item.warehouse, searchTerm)}</td>
      <td>{highlightText(item.updatedByName, searchTerm)}</td>
      <td>{highlightText(item.lastUpdatedAt, searchTerm)}</td>
      <td>{highlightText(item.reason, searchTerm)}</td>
      <td>
        {highlightText(
          item.type === "transferOut" && item.toWarehouse ? `OUT ${item.toWarehouse}` :
          item.type === "transferIn" && item.fromWarehouse ? `IN ${item.fromWarehouse}` :
          "", searchTerm)}
      </td>
    </tr>
  );

  return (
    <div className="inventory-wrapper flex">
      <Sidebar />
      <div className="inventory-container">
        <div className="inventory-header">
          <h1>Inventory</h1>
          <hr style={{ marginBottom: "1rem" }} />
          <div className="month-year-search">
            <label>
              Month:
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                {[...Array(12).keys()].map(m => (
                  <option key={m} value={m}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </label>

            <label>
              Year:
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>

            <button onClick={applyMonthYearFilter}>OK</button>
          </div>
          <div className="inventory-search">
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* quick-nav-container removed as per instructions */}

        <div className="inventory-section" id="stock-list">
          <h2>📦 Stock List</h2>
          <div className="stock-list-box">
            <table className="inventory-table">
              {renderSearchFlatTableHeader()}
              <tbody>
                {(() => {
                  const displayedItems = searchTerm.trim() !== "" ? searchResults : items;
                  return displayedItems.length > 0 ? (
                    displayedItems.map((item, idx) => renderSearchFlatRow(item, idx))
                  ) : (
                    <tr>
                      <td colSpan={11} style={{ textAlign: "center" }}>No results found.</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
            <div className="table-actions">
              <button className="btn btn-primary" onClick={exportCSV}>Export CSV</button>
              <button className="btn btn-primary" onClick={exportPDF}>Export PDF</button>
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
      </div>

      {/* Styling for category-links and quick-nav buttons */}
      <style>{`
        .category-links button,
        .quick-nav-container button {
          margin-right: 10px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}