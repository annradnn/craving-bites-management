import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase"; // adjust the import path if needed
import "./wareProDetail.css";

interface StockItem {
  id?: string;
  code: string;
  quantity: number;
  unit: string;
  expiryDate?: Date | string;
  reason?: string;
  by?: string;
  type?: string;
  productId?: string;
  category?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const WareProDetail: React.FC = () => {
  const { id, productName } = useParams<{ id: string; productName: string }>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [assignedUsers, setAssignedUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id || !productName) return;
    const fetchStock = async () => {
      setLoading(true);
      try {
        const stockRef = collection(db, "warehouses", id, "stock");
        const q = query(stockRef, where("product", "==", productName));
        const querySnapshot = await getDocs(q);
        const stocks: StockItem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          stocks.push({
            id: doc.id,
            code: data.code,
            quantity: data.quantity,
            unit: data.unit,
            expiryDate: data.expiryDate,
            reason: data.reason,
            by: data.By || data.by,
            type: data.type,
            productId: data.productId || data.code,
            category: data.category
          });
        });
        setItems(stocks);

        const usersRef = collection(db, "users");
        await getDocs(usersRef);
        setAssignedUsers([]);
      } catch {
        setItems([]);
        setAssignedUsers([]);
      }
      setLoading(false);
    };
    fetchStock();
  }, [id, productName]);

  const handleEditClick = (item: StockItem) => {
    setEditingId(item.id || null);
    setEditQuantity(item.quantity);
  };

  const handleCancelClick = () => {
    setEditingId(null);
  };

  const handleSaveClick = async (item: StockItem) => {
    if (!id || !item.id) return;
    try {
      const stockRef = doc(db, "warehouses", id, "stock", item.id);
      await updateDoc(stockRef, { quantity: editQuantity, expiryDate: item.expiryDate || null });

      // Create transaction with original fields but updated quantity, By, expiryDate, timestamp
      const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const transactionId = `${id}-${item.code}-edit-${dateCode}`;
      await setDoc(doc(db, "warehouses", id, "transactions", transactionId), {
        id: transactionId,
        type: item.type || "StockIn",
        productId: item.productId || item.code,
        product: productName,
        code: item.code,
        quantity: editQuantity,
        unit: item.unit || "",
        expiryDate: item.expiryDate || null,
        reason: "Edit",
        timestamp: serverTimestamp(),
        By: localStorage.getItem("name") || "",
        category: item.category || "" // preserve original category
      });

      setItems((prevItems) =>
        prevItems.map((it) =>
          it.id === item.id
            ? { ...it, quantity: editQuantity, expiryDate: item.expiryDate }
            : it
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error("Error updating stock and transaction:", error);
    }
  };

  const handleDeleteClick = async (item: StockItem) => {
    if (!id || !item.id) return;
    try {
      const docRef = doc(db, "warehouses", id, "stock", item.id);
      await deleteDoc(docRef);
      setItems((prevItems) => prevItems.filter((it) => it.id !== item.id));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  return (
    <div className="warepro-detail-container">
      <div className="warepro-info-box">
        <button
          className="btn secondary-btn"
          onClick={() => navigate(`/warehouses/${id}`)}
        >
          ← Back to Warehouses
        </button>
        <h2 className="page-title">Stock Details for {productName}</h2>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>No stock items found for this product.</p>
      ) : (
        <>
          <div className="assigned-users">
            <strong>Assigned Staff:</strong>{" "}
            {assignedUsers.length > 0
              ? assignedUsers.map((u) => u.name).join(", ")
              : "-"}
          </div>
          <div className="table-container">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Expiry Date</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || item.code}>
                    <td>{item.code}</td>
                    <td>
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) =>
                            setEditQuantity(Number(e.target.value))
                          }
                          min={0}
                        />
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td>{item.unit}</td>
                    <td>
                      {item.expiryDate
                        ? typeof item.expiryDate === "object" &&
                          "toDate" in item.expiryDate
                          ? (item.expiryDate as { toDate: () => Date })
                              .toDate()
                              .toLocaleDateString()
                          : String(item.expiryDate)
                        : "-"}
                    </td>
                    <td>{item.reason || "-"}</td>
                    <td>{item.by || "-"}</td>
                    <td>
                      {editingId === item.id ? (
                        <>
                          <button
                            className="btn primary-btn"
                            onClick={() => handleSaveClick(item)}
                          >
                            Save
                          </button>
                          <button
                            className="btn secondary-btn"
                            onClick={handleCancelClick}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn primary-btn"
                            onClick={() => handleEditClick(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn danger-btn"
                            onClick={() => handleDeleteClick(item)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default WareProDetail;