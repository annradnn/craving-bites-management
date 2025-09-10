import React from "react";
import { getFirestore, collection, getDocs, Timestamp } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import "./Inventory.css";

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
}

export default function Inventory() {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<InventoryItem[]>([]);

  // Fetch inventory from all warehouse stock subcollections
  const fetchInventory = async () => {
    try {
      const db = getFirestore();
      const warehousesSnapshot = await getDocs(collection(db, "warehouses"));
      const inventoryItems: InventoryItem[] = [];

      for (const warehouseDoc of warehousesSnapshot.docs) {
        const warehouseData = warehouseDoc.data();
        const warehouseName = warehouseData.name || warehouseDoc.id;

        const stockSnapshot = await getDocs(
          collection(db, "warehouses", warehouseDoc.id, "stock")
        );

        for (const docSnap of stockSnapshot.docs) {
          const data = docSnap.data();

          // Use 'By' field directly from stock document
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

          // Handle createdAt display (mapped to lastUpdatedAt)
          let lastUpdatedAtStr: string | undefined = undefined;
          if (data.createdAt?.toDate) {
            lastUpdatedAtStr = data.createdAt.toDate().toLocaleString();
          } else if (typeof data.createdAt === "string") {
            lastUpdatedAtStr = data.createdAt;
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
            reason: typeof data.reason === "string" ? data.reason : undefined,
            updatedByName: staffName,
          });
        }
      }

      setItems(inventoryItems);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  React.useEffect(() => {
    fetchInventory();
  }, []);

  // Filter items by search term
  const filterItemsBySearch = (allItems: InventoryItem[], term: string) => {
    const lowerTerm = term.toLowerCase();
    return allItems.filter((item) => {
      const stringFields: (string | undefined)[] = [
        item.product,
        item.code,
        item.category,
        item.unit,
        item.warehouse,
        item.updatedByName,
        item.lastUpdatedAt,
        item.expiry,
        item.reason,
      ];
      return stringFields.some(
        (field) => field?.toLowerCase().includes(lowerTerm)
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

  // Group items by category
  const groupedItems = items.reduce(
    (groups: { [key: string]: InventoryItem[] }, item) => {
      const category = item.category || "Uncategorized";
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    },
    {}
  );

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
      </tr>
    </thead>
  );

  const renderSearchFlatRow = (item: InventoryItem, idx: number) => (
    <tr key={(item.code || idx) + "-flat"}>
      <td onClick={() => setSelectedItem(item)} className="clickable">{item.product}</td>
      <td>{item.code}</td>
      <td>{item.category}</td>
      <td>{item.quantity}</td>
      <td>{item.unit}</td>
      <td>{item.expiry}</td>
      <td>{item.warehouse}</td>
      <td>{item.updatedByName}</td>
      <td>{item.lastUpdatedAt}</td>
      <td>{item.reason}</td>
    </tr>
  );

  return (
    <div className="inventory-wrapper flex">
      <Sidebar />
      <div className="inventory-container" style={{ marginLeft: "18rem" }}>
        <div className="inventory-header">
          <h1>Inventory</h1>
          <hr style={{ marginBottom: "1rem" }} />
          <div className="inventory-search">
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select>
              <option value="">Filter by Category</option>
              <option value="icecream">Ice Cream</option>
              <option value="cone">Cones</option>
              <option value="topping">Toppings</option>
            </select>
            <select>
              <option value="">Sort by</option>
              <option value="expiry">Expiry Date</option>
              <option value="stock">Stock Level</option>
            </select>
          </div>
        </div>

        <div className="quick-nav-container" style={{ marginBottom: "1rem" }}>
          {["Stock List", "Low Stock Alerts", "Expiring Soon", "Batch Management"].map((section) => (
            <button
              key={section}
              onClick={() => {
                const el = document.getElementById(section.replace(/\s+/g, '-').toLowerCase());
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {section}
            </button>
          ))}
        </div>

        <div className="inventory-section" id="stock-list">
          <h2>📦 Stock List</h2>
          <div className="stock-list-box">
            <div className="category-links" style={{ marginBottom: "1rem" }}>
              {["Product", "Fruits", "Raw Materials", "Packaging", "Tools", "Flavors", "Others"].map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    const el = document.getElementById(cat.replace(/\s+/g, '-').toLowerCase());
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <table className="inventory-table">
              {searchTerm.trim() !== "" ? (
                <>
                  {renderSearchFlatTableHeader()}
                  <tbody>
                    {searchResults.length > 0 ? (
                      searchResults.map((item, idx) => renderSearchFlatRow(item, idx))
                    ) : (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center" }}>No results found.</td>
                      </tr>
                    )}
                  </tbody>
                </>
              ) : (
                <>
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
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedItems).map(([category, itemsInCategory]) => (
                      <React.Fragment key={category}>
                        <tr
                          id={category.replace(/\s+/g, '-').toLowerCase()}
                          className="category-row"
                        >
                          <td colSpan={10} style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                            {category}
                          </td>
                        </tr>
                        {itemsInCategory.map((item, idx) => (
                          <tr key={item.code || idx}>
                            <td onClick={() => setSelectedItem(item)} className="clickable">{item.product}</td>
                            <td>{item.code}</td>
                            <td>{item.category}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td>{item.expiry}</td>
                            <td>{item.warehouse}</td>
                            <td>{item.updatedByName}</td>
                            <td>{item.lastUpdatedAt}</td>
                            <td>{item.reason}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </>
              )}
            </table>

            <div className="table-actions">
              <button className="btn btn-primary">Export CSV</button>
              <button className="btn btn-primary">Export PDF</button>
              <button className="btn btn-secondary">Print Report</button>
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