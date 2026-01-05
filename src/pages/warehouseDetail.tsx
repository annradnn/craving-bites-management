import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, increment, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust this import if your firestore instance is elsewhere
import './warehouseDetail.css';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  // staff: string[]; // Removed: staff is no longer used here
  category: string;
}

interface StockItem {
  id: string;
  product: string;
  category: string;
  quantity: number;
  code: string;
  expiryDate?: string;
}

const WarehouseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  // Staff editing modal
  const [showEditStaff, setShowEditStaff] = useState(false);
  // Also keep allUsers for mapping display name/email to user id
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; assignedWarehouse: string[] }[]>([]);
  const [editStaffSelection, setEditStaffSelection] = useState<string[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<StockItem[]>([]);
  const [lowStockSettings, setLowStockSettings] = useState<{ [productName: string]: number }>({});
  const [loading, setLoading] = useState(true);

  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // State for Stock Out modal selections
  const [stockOutProduct, setStockOutProduct] = useState<string>('');
  const [stockOutCode, setStockOutCode] = useState<string>('');
  const [stockOutQuantity, setStockOutQuantity] = useState<number>(0);
  const [stockOutAvailableQty, setStockOutAvailableQty] = useState<number>(0);

  // State for Transfer modal selections
  const [transferToWarehouse, setTransferToWarehouse] = useState<string>('');
  const [transferProduct, setTransferProduct] = useState<string>('');
  const [transferBatch, setTransferBatch] = useState<string>('');
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferAvailableQty, setTransferAvailableQty] = useState<number>(0);

  // State for Stock In modal selections
  const [stockInProduct, setStockInProduct] = useState<string>('');
  const [stockInBatchCode, setStockInBatchCode] = useState<string>('');
  const [stockInQuantity, setStockInQuantity] = useState<number>(0);
  const [stockInExpiryDate, setStockInExpiryDate] = useState<string>('');
  const [stockInReason, setStockInReason] = useState<string>('');

  // Reason options for Stock In and Stock Out (could be fetched from DB or hardcoded)
  const reasonOptions = [
    'New Supply',
    'Return',
    'Adjustment',
    'Damage',
    'Other',
  ];

  // State for Stock Out reason
  const [stockOutReason, setStockOutReason] = useState<string>('');

  // Helper to reload stock after actions and update totalItems in Firestore
  const reloadWarehouseStockAndUpdateTotal = async () => {
    if (!id) return;
    const stockRef = collection(db, 'warehouses', id, 'stock');
    const stockSnapshot = await getDocs(stockRef);
    const stockItems: StockItem[] = [];
    stockSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      stockItems.push({
        id: docSnap.id,
        product: data.product,
        category: data.category,
        quantity: data.quantity || 0,
        code: data.code || '',
        expiryDate: data.expiryDate || '',
      });
    });
    setWarehouseStock(stockItems);
    // Update totalItems in Firestore after fetching new stock
    const totalQuantity = stockItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    try {
      await updateDoc(doc(db, 'warehouses', id), { totalItems: totalQuantity });
    } catch (error) {
      console.error("Failed to update warehouse totalItems:", error);
    }
  };

  // --- Firestore Stock In Functionality ---
  const handleStockIn = async () => {
    if (!id) return;
    if (!stockInProduct || !stockInBatchCode || !stockInQuantity || !stockInReason) {
      alert("Please fill in all required fields.");
      return;
    }
    // Find product info
    const productObj = products.find(p => p.name === stockInProduct);
    if (!productObj) {
      alert("Selected product not found.");
      return;
    }
    const userName = localStorage.getItem('name') || "Unknown";
    const stockDocRef = doc(db, 'warehouses', id, 'stock', stockInBatchCode);
    const stockDocSnap = await getDoc(stockDocRef);
    if (stockDocSnap.exists()) {
      // Add to existing batch
      await updateDoc(stockDocRef, {
        quantity: increment(stockInQuantity),
        expiryDate: stockInExpiryDate,
      });
    } else {
      // Only use allowed fields when creating new batch
      await setDoc(stockDocRef, {
        By: userName,
        category: productObj.category,
        code: stockInBatchCode,
        createdAt: serverTimestamp(),
        expiryDate: stockInExpiryDate,
        product: stockInProduct,
        productId: stockInBatchCode,
        quantity: stockInQuantity,
        reason: stockInReason,
        unit: productObj.unit,
      });
    }
    // Log transaction with custom transactionId and only allowed fields
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g,''); // YYYYMMDD
    const transactionId = `${id}-${stockInBatchCode}-stockIn-${stockInReason}-${dateCode}`;
    const transactionDocRef = doc(db, 'warehouses', id, 'transactions', transactionId);
    await setDoc(transactionDocRef, {
      id: transactionId,
      type: "stockIn",
      productId: stockInBatchCode,
      product: stockInProduct,
      code: stockInBatchCode,
      quantity: stockInQuantity,
      unit: productObj.unit,
      expiryDate: stockInExpiryDate,
      reason: stockInReason,
      timestamp: serverTimestamp(),
      By: userName,
      category: productObj.category,
    });
    // Reset modal state
    setShowStockIn(false);
    setStockInProduct('');
    setStockInBatchCode('');
    setStockInQuantity(0);
    setStockInExpiryDate('');
    setStockInReason('');
    await reloadWarehouseStockAndUpdateTotal();
  };

  // --- Firestore Stock Out Functionality ---
  const handleStockOut = async () => {
    if (!id) return;
    if (!stockOutProduct || !stockOutCode || !stockOutQuantity || !stockOutReason) {
      alert("Please fill in all required fields.");
      return;
    }
    // Find batch doc
    const stockDocRef = doc(db, 'warehouses', id, 'stock', stockOutCode);
    const stockDocSnap = await getDoc(stockDocRef);
    if (!stockDocSnap.exists()) {
      alert("Batch not found.");
      return;
    }
    if (((stockDocSnap.data().quantity) || 0) < stockOutQuantity) {
      alert(`Quantity exceeds available stock (${stockDocSnap.data().quantity || 0}).`);
      return;
    }
    // Find product info
    const productObj = products.find(p => p.name === stockOutProduct);
    // Update batch quantity (decrement)
    await updateDoc(stockDocRef, {
      quantity: increment(-stockOutQuantity)
    });
    // Log transaction with custom transactionId and only allowed fields
    const userName = localStorage.getItem('name') || "Unknown";
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g,''); // YYYYMMDD
    const transactionId = `${id}-${stockOutCode}-stockOut-${stockOutReason}-${dateCode}`;
    const transactionDocRef = doc(db, 'warehouses', id, 'transactions', transactionId);
    // Record the transaction quantity as a positive number
    await setDoc(transactionDocRef, {
      id: transactionId,
      type: "stockOut",
      productId: stockOutCode,
      product: stockOutProduct,
      code: stockOutCode,
      quantity: stockOutQuantity, // always positive
      unit: productObj?.unit,
      expiryDate: stockDocSnap.data().expiryDate || "",
      reason: stockOutReason,
      timestamp: serverTimestamp(),
      By: userName,
      category: productObj?.category || "",
    });
    // Reset modal state
    setShowStockOut(false);
    setStockOutProduct('');
    setStockOutCode('');
    setStockOutQuantity(0);
    setStockOutAvailableQty(0);
    setStockOutReason('');
    await reloadWarehouseStockAndUpdateTotal();
  };

  // --- Firestore Transfer Functionality ---
  const handleTransfer = async () => {
    if (!id) return;
    if (!transferToWarehouse || !transferProduct || !transferBatch || !transferQuantity) {
      alert("Please fill in all required fields.");
      return;
    }
    if (transferQuantity > transferAvailableQty) {
      alert(`Quantity exceeds available stock (${transferAvailableQty}).`);
      return;
    }
    // Get source batch doc
    const srcBatchRef = doc(db, 'warehouses', id, 'stock', transferBatch);
    const srcBatchSnap = await getDoc(srcBatchRef);
    if (!srcBatchSnap.exists()) {
      alert("Batch not found.");
      return;
    }
    const srcData = srcBatchSnap.data();
    // Prepare dest warehouse batch doc
    const destBatchRef = doc(db, 'warehouses', transferToWarehouse, 'stock', transferBatch);
    const destBatchSnap = await getDoc(destBatchRef);
    // Find product info
    const productObj = products.find(p => p.name === transferProduct);
    const userName = localStorage.getItem('name') || "Unknown";
    // Start batch write
    const batch = writeBatch(db);
    // Deduct from source
    batch.update(srcBatchRef, { quantity: increment(-transferQuantity) });
    // Add to dest
    if (destBatchSnap.exists()) {
      batch.update(destBatchRef, { quantity: increment(transferQuantity) });
    } else {
      batch.set(destBatchRef, {
        By: userName,
        category: productObj?.category || srcData.category || "",
        code: transferBatch,
        createdAt: serverTimestamp(),
        expiryDate: srcData.expiryDate || '',
        product: transferProduct,
        productId: transferBatch,
        quantity: transferQuantity,
        reason: "Transfer In",
        unit: productObj?.unit,
      });
    }
    // Log transaction in both warehouses with custom transactionId and only allowed fields
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g,''); // YYYYMMDD
    const srcTransactionId = `${id}-${transferBatch}-transferOut-${transferToWarehouse}-${dateCode}`;
    const destTransactionId = `${transferToWarehouse}-${transferBatch}-transferIn-${id}-${dateCode}`;
    const srcTransDocRef = doc(db, 'warehouses', id, 'transactions', srcTransactionId);
    const destTransDocRef = doc(db, 'warehouses', transferToWarehouse, 'transactions', destTransactionId);
    // Ensure quantity is always positive in transaction logs
    const srcTransferLog = {
      id: srcTransactionId,
      type: "transferOut",
      productId: transferBatch,
      product: transferProduct,
      code: transferBatch,
      quantity: transferQuantity, // always positive
      unit: productObj?.unit,
      expiryDate: srcData.expiryDate || '',
      reason: `Transfer to ${transferToWarehouse}`,
      timestamp: serverTimestamp(),
      By: userName,
      category: productObj?.category || srcData.category || "",
    };
    const destTransferLog = {
      id: destTransactionId,
      type: "transferIn",
      productId: transferBatch,
      product: transferProduct,
      code: transferBatch,
      quantity: transferQuantity, // always positive
      unit: productObj?.unit,
      expiryDate: srcData.expiryDate || '',
      reason: `Transfer from ${id}`,
      timestamp: serverTimestamp(),
      By: userName,
      category: productObj?.category || srcData.category || "",
    };
    await batch.commit();
    await Promise.all([
      setDoc(srcTransDocRef, srcTransferLog),
      setDoc(destTransDocRef, destTransferLog),
    ]);
    // Reset modal state
    setShowTransfer(false);
    setTransferToWarehouse('');
    setTransferProduct('');
    setTransferBatch('');
    setTransferQuantity(0);
    setTransferAvailableQty(0);
    await reloadWarehouseStockAndUpdateTotal();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);

      // Fetch warehouse document by document ID
      const warehouseDocRef = doc(db, 'warehouses', id);
      const warehouseDocSnap = await getDoc(warehouseDocRef);
      if (warehouseDocSnap.exists()) {
        const data = warehouseDocSnap.data() as Warehouse;
        setWarehouse({
          id: warehouseDocSnap.id,
          name: data.name || '',
          location: data.location || '',
          // staff: data.staff || [], // No longer used
          category: data.category || '',
        });
      } else {
        setWarehouse(null);
      }

      // Fetch all warehouses for Transfer modal
      const warehousesSnapshot = await getDocs(collection(db, 'warehouses'));
      const warehousesList: Warehouse[] = [];
      warehousesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        warehousesList.push({
          id: docSnap.id,
          name: data.name || '',
          location: data.location || '',
          // staff: data.staff || [], // No longer used
          category: data.category || '',
        });
      });
      setAllWarehouses(warehousesList);

      // Fetch products collection for Stock In modal
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsList: Product[] = [];
      productsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        productsList.push({
          id: docSnap.id,
          name: data.name || '',
          category: data.category || '',
          unit: data.unit || 'unit',
        });
      });
      setProducts(productsList);

      // Fetch all users for staff selection
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList: { id: string; name: string; email: string; assignedWarehouse: string[] }[] = [];
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersList.push({
          id: docSnap.id,
          name: data.name || '',
          email: data.email || '',
          assignedWarehouse: Array.isArray(data.assignedWarehouse) ? data.assignedWarehouse : [],
        });
      });
      setAllUsers(usersList);

      // Fetch stock items from the warehouse's 'stock' subcollection for Stock Out and Transfer modals
      const stockRef = collection(db, 'warehouses', id, 'stock');
      const stockSnapshot = await getDocs(stockRef);
      const stockItems: StockItem[] = [];
      stockSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        stockItems.push({
          id: docSnap.id,
          product: data.product,
          category: data.category,
          quantity: data.quantity || 0,
          code: data.code || '',
          expiryDate: data.expiryDate || '',
        });
      });
      setWarehouseStock(stockItems);

      // Fetch low stock thresholds for this warehouse
      const lowStockRef = collection(db, 'warehouses', id, 'lowStockSettings');
      const lowStockSnap = await getDocs(lowStockRef);
      const lowStockData: { [productName: string]: number } = {};
      lowStockSnap.forEach((docSnap) => {
        const data = docSnap.data();
        lowStockData[docSnap.id] = data.threshold || 0;
      });
      setLowStockSettings(lowStockData);

      setLoading(false);
    };
    fetchData();
  }, [id]);

  // Handle Stock Out product change: update batch list and available quantity
  useEffect(() => {
    if (stockOutProduct) {
      const batches = warehouseStock.filter(s => s.product === stockOutProduct);
      if (batches.length > 0) {
        setStockOutCode(batches[0].code);
        setStockOutAvailableQty(batches[0].quantity);
        setStockOutQuantity(0);
      } else {
        setStockOutCode('');
        setStockOutAvailableQty(0);
        setStockOutQuantity(0);
      }
    } else {
      setStockOutCode('');
      setStockOutAvailableQty(0);
      setStockOutQuantity(0);
    }
  }, [stockOutProduct, warehouseStock]);

  // Handle Stock Out code change: update available quantity
  useEffect(() => {
    if (stockOutCode) {
      const batchItem = warehouseStock.find(s => s.product === stockOutProduct && s.code === stockOutCode);
      if (batchItem) {
        setStockOutAvailableQty(batchItem.quantity);
        setStockOutQuantity(0);
      } else {
        setStockOutAvailableQty(0);
        setStockOutQuantity(0);
      }
    }
  }, [stockOutCode, stockOutProduct, warehouseStock]);

  // Handle Transfer product change: update batch list and available quantity
  useEffect(() => {
    if (transferProduct) {
      const batches = warehouseStock.filter(s => s.product === transferProduct);
      if (batches.length > 0) {
        setTransferBatch(batches[0].code);
        setTransferAvailableQty(batches[0].quantity);
        setTransferQuantity(0);
      } else {
        setTransferBatch('');
        setTransferAvailableQty(0);
        setTransferQuantity(0);
      }
    } else {
      setTransferBatch('');
      setTransferAvailableQty(0);
      setTransferQuantity(0);
    }
  }, [transferProduct, warehouseStock]);

  // Handle Transfer batch change: update available quantity
  useEffect(() => {
    if (transferBatch) {
      const batchItem = warehouseStock.find(s => s.product === transferProduct && s.code === transferBatch);
      if (batchItem) {
        setTransferAvailableQty(batchItem.quantity);
        setTransferQuantity(0);
      } else {
        setTransferAvailableQty(0);
        setTransferQuantity(0);
      }
    }
  }, [transferBatch, transferProduct, warehouseStock]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!warehouse) {
    return <div>Warehouse not found.</div>;
  }

  // Group products in warehouseStock by product name with total quantity for display table
  const groupedProductsInWarehouse: { [name: string]: { category: string; quantity: number; id: string } } = {};
  warehouseStock.forEach(stockItem => {
    if (!groupedProductsInWarehouse[stockItem.product]) {
      groupedProductsInWarehouse[stockItem.product] = {
        category: stockItem.category,
        quantity: stockItem.quantity,
        id: stockItem.id,
      };
    } else {
      groupedProductsInWarehouse[stockItem.product].quantity += stockItem.quantity;
    }
  });
  const productsInWarehouse = Object.entries(groupedProductsInWarehouse)
    .map(([name, info]) => ({
      id: info.id,
      name,
      category: info.category,
      quantity: info.quantity,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Warehouses except current for Transfer modal
  const otherWarehouses = allWarehouses.filter(w => w.id !== warehouse.id);

  // Save assigned staff for this warehouse:
  // Admin can select multiple staff, and for each user, update their assignedWarehouse array.
  const handleSaveEditStaff = async () => {
    if (!id) return;
    try {
      // For each user in allUsers, determine if they should have this warehouse assigned or not,
      // then update only those whose assignment changes.
      const updates: Promise<void>[] = [];
      allUsers.forEach(user => {
        const currentlyAssigned = Array.isArray(user.assignedWarehouse) && user.assignedWarehouse.includes(id);
        const shouldBeAssigned = editStaffSelection.includes(user.id);
        if (currentlyAssigned && !shouldBeAssigned) {
          // Remove this warehouse from their assignedWarehouse array
          const newAssigned = user.assignedWarehouse.filter(wid => wid !== id);
          updates.push(
            updateDoc(doc(db, "users", user.id), { assignedWarehouse: newAssigned })
          );
        } else if (!currentlyAssigned && shouldBeAssigned) {
          // Add this warehouse to their assignedWarehouse array
          const newAssigned = Array.isArray(user.assignedWarehouse)
            ? [...user.assignedWarehouse, id]
            : [id];
          // Remove duplicates just in case
          updates.push(
            updateDoc(doc(db, "users", user.id), {
              assignedWarehouse: Array.from(new Set(newAssigned)),
            })
          );
        }
        // else: no change needed
      });
      await Promise.all(updates);
      setShowEditStaff(false);
      // Optionally reload users from Firestore to reflect latest assignments
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList: { id: string; name: string; email: string; assignedWarehouse: string[] }[] = [];
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersList.push({
          id: docSnap.id,
          name: data.name || '',
          email: data.email || '',
          assignedWarehouse: Array.isArray(data.assignedWarehouse) ? data.assignedWarehouse : [],
        });
      });
      setAllUsers(usersList);
    } catch (error) {
      alert("Failed to update assigned staff. " + (error as Error).message);
    }
  };


  // Admin check: You may want to replace this logic with a real admin check
  const isAdmin = (localStorage.getItem("role") || "").toLowerCase() === "admin";

  // Helper to display all assigned staff names/emails in warehouse info
  // Show all users who have this warehouse's id in their assignedWarehouse array
  // (No limit: display all assigned staff, even if 100+)
  const assignedStaff = allUsers.filter(
    (u) => Array.isArray(u.assignedWarehouse) && u.assignedWarehouse.includes(id!)
  );
  // Show all names/emails, comma separated
  const assignedStaffDisplay = assignedStaff.map((user) =>
    user.name ? user.name : user.email
  ).filter(Boolean);

  return (
    <div className="warehouse-detail-container">
      <div className="warehouse-info-box">
        <button className="btn secondary-btn" onClick={() => navigate("/warehouse")}>
          ← Back to Warehouses
        </button>
        <h1>{warehouse.name}</h1>
        <p><strong>Location:</strong> {warehouse.location}</p>
        <p>
          <strong>Staff:</strong>{" "}
          {assignedStaffDisplay.length > 0 ? (
            // Show all staff, comma separated, with wrapping for many staff
            <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-line' }}>
              {assignedStaffDisplay.join(', ')}
            </span>
          ) : (
            <span style={{ color: '#888' }}>None assigned</span>
          )}
          {isAdmin && (
            <button
              className="btn secondary-btn"
              style={{ marginLeft: "0.5rem", padding: "0.2rem 0.6rem", fontSize: "0.9em" }}
              onClick={() => {
                setEditStaffSelection(assignedStaff.map(u => u.id));
                setShowEditStaff(true);
              }}
              title="Edit Staff"
            >
              Edit
            </button>
          )}
        </p>
        {/* Warehouse category display */}
        <p>
          <strong>Category:</strong>{" "}
          {warehouse.category ? warehouse.category : "None"}
        </p>
        <p>
          <strong>Total Items:</strong>{" "}
          {warehouseStock.reduce((sum, item) => sum + (item.quantity || 0), 0)}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="btn secondary-btn" onClick={() => setShowStockIn(true)}>Stock In</button>
          <button className="btn secondary-btn" onClick={() => setShowStockOut(true)}>Stock Out</button>
          <button className="btn secondary-btn" onClick={() => setShowTransfer(true)}>Transfer</button>
        </div>
      </div>
      {/* Edit Staff Modal */}
      {showEditStaff && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit Assigned Staff</h2>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveEditStaff();
              }}
            >
              <div className="form-group">
                <label>Assigned Staff</label>
                <select
                  multiple
                  value={editStaffSelection}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setEditStaffSelection(selected);
                  }}
                  style={{ minHeight: Math.min(300, Math.max(5 * 24, allUsers.length * 24)) + "px", width: "100%" }}
                >
                  {allUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name ? user.name : user.email}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "0.9em", marginTop: "0.5em" }}>
                  Hold Ctrl (Cmd on Mac) to select multiple staff.
                </div>
                <div style={{ fontSize: "0.85em", color: "#888", marginTop: "0.25em" }}>
                  {allUsers.length > 20 && "Scroll to see all staff."}
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: "1rem" }}>
                <button type="submit" className="btn primary-btn">Save</button>
                <button
                  type="button"
                  className="btn secondary-btn"
                  onClick={() => setShowEditStaff(false)}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Low Stock Alert Section */}
      <div className="low-stock-alert-box">
        <h3>Low Stock Alerts</h3>
        {productsInWarehouse.filter(p => {
          const threshold = lowStockSettings[p.name] || 0;
          return threshold > 0 && p.quantity <= threshold;
        }).length > 0 ? (
          <ul>
            {productsInWarehouse
              .filter(p => {
                const threshold = lowStockSettings[p.name] || 0;
                return threshold > 0 && p.quantity <= threshold;
              })
              .map((p) => (
                <li key={p.id}>
                  ⚠️ <strong>{p.name}</strong> — Qty: {p.quantity} (Threshold: {lowStockSettings[p.name]})
                </li>
              ))}
          </ul>
        ) : (
          <p>No low stock alerts for this warehouse.</p>
        )}
      </div>

      {showStockIn && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Stock In</h2>
            <form onSubmit={e => {
              e.preventDefault();
              handleStockIn();
            }}>
              <div className="form-group">
                <label>Product</label>
                <select
                  value={stockInProduct}
                  onChange={e => setStockInProduct(e.target.value)}
                  required
                >
                  <option value="" disabled>Select product</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.name}>{prod.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Batch Code</label>
                <input
                  type="text"
                  placeholder="Enter batch code"
                  value={stockInBatchCode}
                  onChange={e => setStockInBatchCode(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Enter quantity"
                  value={stockInQuantity}
                  onChange={e => setStockInQuantity(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Expiry Date (optional)</label>
                <input
                  type="date"
                  value={stockInExpiryDate}
                  onChange={e => setStockInExpiryDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select
                  value={reasonOptions.includes(stockInReason) ? stockInReason : 'custom'}
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setStockInReason('');
                    } else {
                      setStockInReason(e.target.value);
                    }
                  }}
                  required
                >
                  <option value="" disabled>Select reason</option>
                  {reasonOptions
                    .filter(reason => reason !== 'Other')
                    .map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  <option value="custom">Other</option>
                </select>

                {!reasonOptions.includes(stockInReason) && (
                  <input
                    type="text"
                    placeholder="Enter custom reason"
                    value={stockInReason}
                    onChange={e => setStockInReason(e.target.value)}
                    required
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn primary-btn">Save</button>
                <button
                  type="button"
                  className="btn secondary-btn"
                  onClick={() => {
                    setShowStockIn(false);
                    // Reset Stock In modal state
                    setStockInProduct('');
                    setStockInBatchCode('');
                    setStockInQuantity(0);
                    setStockInExpiryDate('');
                    setStockInReason('');
                  }}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockOut && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Stock Out</h2>
            <form onSubmit={e => {
              e.preventDefault();
              if (stockOutQuantity > stockOutAvailableQty) {
                alert(`Quantity exceeds available stock (${stockOutAvailableQty}).`);
                return;
              }
              handleStockOut();
            }}>
              <div className="form-group">
                <label>Product</label>
                <select
                  value={stockOutProduct}
                  onChange={e => setStockOutProduct(e.target.value)}
                  required
                >
                  <option value="" disabled>Select product</option>
                  {productsInWarehouse.map((prod) => (
                    <option key={prod.id} value={prod.name}>{prod.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Batch Code</label>
                <select
                  value={stockOutCode}
                  onChange={e => setStockOutCode(e.target.value)}
                  required
                  disabled={!stockOutProduct}
                >
                  <option value="" disabled>Select batch</option>
                  {warehouseStock
                    .filter(s => s.product === stockOutProduct && s.quantity > 0)
                    .map(batch => (
                      <option key={batch.id} value={batch.code}>
                        {batch.code} (Qty: {batch.quantity}{batch.expiryDate ? `, Exp: ${batch.expiryDate}` : ''})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity (Available: {stockOutAvailableQty})</label>
                <input
                  type="number"
                  min={1}
                  max={stockOutAvailableQty}
                  placeholder="Enter quantity"
                  value={stockOutQuantity}
                  onChange={e => setStockOutQuantity(Number(e.target.value))}
                  required
                  disabled={!stockOutCode}
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select
                  value={reasonOptions.includes(stockOutReason) ? stockOutReason : 'custom'}
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setStockOutReason('');
                    } else {
                      setStockOutReason(e.target.value);
                    }
                  }}
                  required
                >
                  <option value="" disabled>Select reason</option>
                  {reasonOptions
                    .filter(reason => reason !== 'Other')
                    .map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  <option value="custom">Other</option>
                </select>

                {!reasonOptions.includes(stockOutReason) && (
                  <input
                    type="text"
                    placeholder="Enter custom reason"
                    value={stockOutReason}
                    onChange={e => setStockOutReason(e.target.value)}
                    required
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn primary-btn">Save</button>
                <button
                  type="button"
                  className="btn secondary-btn"
                  onClick={() => {
                    setShowStockOut(false);
                    // Reset Stock Out modal state
                    setStockOutProduct('');
                    setStockOutCode('');
                    setStockOutQuantity(0);
                    setStockOutAvailableQty(0);
                    setStockOutReason('');
                  }}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Transfer</h2>
            <form onSubmit={e => {
              e.preventDefault();
              if (transferQuantity > transferAvailableQty) {
                alert(`Quantity exceeds available stock (${transferAvailableQty}).`);
                return;
              }
              if (!transferToWarehouse) {
                alert("Please select a destination warehouse.");
                return;
              }
              handleTransfer();
            }}>
              <div className="form-group">
                <label>From Warehouse</label>
                <input type="text" value={warehouse.name} readOnly />
              </div>
              <div className="form-group">
                <label>To Warehouse</label>
                <select
                  value={transferToWarehouse}
                  onChange={e => setTransferToWarehouse(e.target.value)}
                  required
                >
                  <option value="" disabled>Select warehouse</option>
                  {otherWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Product</label>
                <select
                  value={transferProduct}
                  onChange={e => setTransferProduct(e.target.value)}
                  required
                >
                  <option value="" disabled>Select product</option>
                  {productsInWarehouse.map(prod => (
                    <option key={prod.id} value={prod.name}>{prod.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Batch Code</label>
                <select
                  value={transferBatch}
                  onChange={e => setTransferBatch(e.target.value)}
                  required
                  disabled={!transferProduct}
                >
                  <option value="" disabled>Select batch</option>
                  {warehouseStock
                    .filter(s => s.product === transferProduct && s.quantity > 0)
                    .map(batch => (
                      <option key={batch.id} value={batch.code}>
                        {batch.code} (Qty: {batch.quantity}{batch.expiryDate ? `, Exp: ${batch.expiryDate}` : ''})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity (Available: {transferAvailableQty})</label>
                <input
                  type="number"
                  min={1}
                  max={transferAvailableQty}
                  placeholder="Enter quantity"
                  value={transferQuantity}
                  onChange={e => setTransferQuantity(Number(e.target.value))}
                  required
                  disabled={!transferBatch}
                />
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn primary-btn">Save</button>
                <button
                  type="button"
                  className="btn secondary-btn"
                  onClick={() => {
                    setShowTransfer(false);
                    // Reset Transfer modal state
                    setTransferToWarehouse('');
                    setTransferProduct('');
                    setTransferBatch('');
                    setTransferQuantity(0);
                    setTransferAvailableQty(0);
                  }}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <div className="table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Product Code</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {productsInWarehouse.map((product) => {
              const isLowStock = product.quantity <= (lowStockSettings[product.name] || 0);
              // Find the first code for this product for display
              const codeForProduct =
                warehouseStock.find(s => s.product === product.name)?.code || "";
              return (
                <tr
                  key={product.id}
                  className={isLowStock ? "low-stock-row" : ""}
                >
                  <td>
                    <Link
                      to={`/warehouses/${id}/products/${encodeURIComponent(product.name)}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {isLowStock ? <span title="Low stock" style={{ color: '#e67e22', fontWeight: 'bold', marginRight: '0.3em' }}>⚠️</span> : null}
                      {product.name}
                    </Link>
                  </td>
                  <td>{product.category}</td>
                  <td>{codeForProduct}</td>
                  <td>{product.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WarehouseDetail;