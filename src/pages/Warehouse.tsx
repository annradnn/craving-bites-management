import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  setDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import "./Product.css";

const Warehouse = () => {
  type WarehouseType = {
    id: string;
    name: string;
    location: string;
    status: string;
    totalItems: number;
    category: string;
  };
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  // State to store the full list of warehouses (unfiltered)
  const [allWarehouses, setAllWarehouses] = useState<WarehouseType[]>([]);
  // State for all staff (for assignment)
  const [availableStaff, setAvailableStaff] = useState<{id: string; name: string; email: string}[]>([]);


  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    warehouseId: string;
    name: string;
    location: string;
    status: string;
    category: string;
    assignedStaff?: string[];
  }>({
    warehouseId: "",
    name: "",
    location: "",
    status: "Active",
    category: "warehouse",
    assignedStaff: [],
  });

  const [confirmModal, setConfirmModal] = useState<{
    type: "delete" | null;
    warehouseId: string | null;
  }>({ type: null, warehouseId: null });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddWarehouse = () => {
    setForm({
      warehouseId: "",
      name: "",
      location: "",
      status: "Active",
      category: "warehouse",
      assignedStaff: [],
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm({
      warehouseId: "",
      name: "",
      location: "",
      status: "Active",
      category: "warehouse",
      assignedStaff: [],
    });
  };

  // Fetch all staff (for multi-select assignment)
  useEffect(() => {
    const fetchStaff = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const staffList: {id: string; name: string; email: string}[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === "staff") {
          staffList.push({ id: docSnap.id, name: data.name, email: data.email });
        }
      });
      setAvailableStaff(staffList);
    };
    fetchStaff();
  }, []);

  // Save new or edited warehouse to Firestore, and update assignedWarehouse for staff
  const handleSaveWarehouse = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.warehouseId.trim()) {
      alert("Please fill in all fields, including Warehouse ID.");
      return;
    }
    try {
      if (form.id) {
        // Update existing warehouse
        const warehouseRef = doc(db, "warehouses", form.id);
        await updateDoc(warehouseRef, {
          name: form.name,
          location: form.location,
          status: form.status,
          category: form.category,
        });
      } else {
        // Add new warehouse with manual ID (code)
        const warehouseRef = doc(db, "warehouses", form.warehouseId.trim());
        const existing = await getDoc(warehouseRef);
        if (existing.exists()) {
          alert("A warehouse with this ID already exists. Please choose another Warehouse ID.");
          return;
        }
        await setDoc(warehouseRef, {
          name: form.name,
          location: form.location,
          status: form.status,
          totalItems: 0,
          category: form.category,
        });
      }

      // Update assignedWarehouse for all staff
      // 1. Fetch all staff
      const staffSnapshot = await getDocs(collection(db, "users"));
      const warehouseId = form.id || form.warehouseId.trim();
      const selectedStaff = form.assignedStaff || [];
      // 2. For each staff: update their assignedWarehouse array accordingly
      await Promise.all(
        staffSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (data.role === "staff") {
            const staffId = docSnap.id;
            let assigned: string[] = Array.isArray(data.assignedWarehouse) ? [...data.assignedWarehouse] : [];
            if (selectedStaff.includes(staffId)) {
              // Add warehouseId if not present
              if (!assigned.includes(warehouseId)) assigned.push(warehouseId);
            } else {
              // Remove warehouseId if present
              assigned = assigned.filter(wid => wid !== warehouseId);
            }
            await updateDoc(doc(db, "users", staffId), { assignedWarehouse: assigned });
          }
        })
      );

      handleCloseModal();
    } catch (error) {
      alert("Failed to save warehouse: " + (error instanceof Error ? error.message : String(error)));
    }
  };


  const closeConfirmModal = () => {
    setConfirmModal({ type: null, warehouseId: null });
  };

  const handleConfirmDelete = async () => {
    if (confirmModal.warehouseId !== null) {
      try {
        await deleteDoc(doc(db, "warehouses", confirmModal.warehouseId));
        // Optionally: delete all stock docs under this warehouse
        // (not implemented for brevity)
      } catch (error) {
        alert("Failed to delete warehouse: " + (error instanceof Error ? error.message : String(error)));
      }
    }
    closeConfirmModal();
  };



  // Fetch warehouses from Firestore (no more assignedWarehouse logic)
  const fetchWarehouses = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "warehouses"));
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<WarehouseType, "id">),
      }));
      setAllWarehouses(data); // Save the full data for later filtering
    } catch {
      // fallback: empty
      setAllWarehouses([]);
      setWarehouses([]);
    }
  }, []);

  // (Removed fetchWarehouseStock and all stock management logic)


  // Real-time listener for warehouses
  useEffect(() => {
    const unsubWarehouses = onSnapshot(collection(db, "warehouses"), () => {
      fetchWarehouses();
    });
    // Initial fetch
    fetchWarehouses();
    return () => {
      unsubWarehouses();
    };
  }, [fetchWarehouses]);

  // Show all warehouses to all users (admin and staff)
  useEffect(() => {
    setWarehouses(allWarehouses);
  }, [allWarehouses]);


  // Table open/close toggle state, persisted in localStorage
  const [showTable, setShowTable] = useState<boolean>(() => {
    const stored = localStorage.getItem("warehouseShowTable");
    if (stored === "false") return false;
    return true;
  });

  // Persist showTable to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("warehouseShowTable", showTable ? "true" : "false");
  }, [showTable]);


  // Delete handler for new table
  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (!window.confirm("Are you sure you want to delete this warehouse and all its details?")) return;

    try {
      // Helper to delete all documents in a subcollection
      const deleteSubcollection = async (subcolName: string) => {
        const subcolSnap = await getDocs(collection(db, "warehouses", warehouseId, subcolName));
        const batchDeletes = subcolSnap.docs.map(docSnap => deleteDoc(doc(db, "warehouses", warehouseId, subcolName, docSnap.id)));
        await Promise.all(batchDeletes);
      };

      // Delete all subcollections
      await deleteSubcollection("stock");
      await deleteSubcollection("transactions");

      // Delete the warehouse document itself
      await deleteDoc(doc(db, "warehouses", warehouseId));

      // Remove from local state to update UI
      setWarehouses(ws => ws.filter(w => w.id !== warehouseId));

    } catch (error) {
      alert("Failed to delete warehouse: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="product-wrapper flex">
      <Sidebar />
      <div className="product-container">
        <h1>🏭 Warehouse</h1>
        {/* Table open/close toggle button */}
        <div style={{ margin: "1rem 0" }}>
          <button
            className="btn secondary-btn"
            style={{ marginBottom: "1rem" }}
            onClick={() => setShowTable((prev) => !prev)}
          >
            {showTable ? "Hide Table" : "Show Table"}
          </button>
        </div>
        {showTable && (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="product-table">
              <thead>
                <tr>
                  <th>Warehouse Name</th>
                  <th>Location</th>
                  {/* Removed Assigned Staff column */}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>No warehouses</td>
                  </tr>
                ) : (
                  warehouses.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <Link to={`/warehouses/${w.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {w.name}
                        </Link>
                      </td>
                      <td>{w.location}</td>
                      {/* Assigned Staff column removed */}
                      <td>
                        <button
                          className="btn action-btn"
                          style={{ marginRight: 6 }}
                          onClick={async () => {
                            // Find all staff assigned to this warehouse
                            // (assignedWarehouse in user doc includes this warehouse)
                            const staffSnapshot = await getDocs(collection(db, "users"));
                            const assignedStaffIds: string[] = [];
                            staffSnapshot.forEach(docSnap => {
                              const data = docSnap.data();
                              if (data.role === "staff" && Array.isArray(data.assignedWarehouse) && data.assignedWarehouse.includes(w.id)) {
                                assignedStaffIds.push(docSnap.id);
                              }
                            });
                            setForm({
                              id: w.id,
                              warehouseId: w.id,
                              name: w.name,
                              location: w.location,
                              status: w.status,
                              category: w.category,
                              assignedStaff: assignedStaffIds,
                            });
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn action-btn"
                          onClick={() => handleDeleteWarehouse(w.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* Add Warehouse Button */}
        <div className="button-group">
          {localStorage.getItem("role") === "admin" && (
            <button className="btn primary-btn" onClick={handleAddWarehouse}>Add Warehouse</button>
          )}
        </div>

        {/* Warehouse Boxes Section */}
        {(() => {
          const groupedWarehouses = {
            warehouse: warehouses.filter(w => w.category === "warehouse"),
            production: warehouses.filter(w => w.category === "production"),
            customer: warehouses.filter(w => w.category === "customer")
          };
          return (
            <div style={{ marginTop: '2rem' }}>
              {/* WAREHOUSE CATEGORY */}
              {groupedWarehouses.warehouse.length > 0 && (
                <div style={{ width: "100%", marginBottom: "2rem" }}>
                  <h2 style={{ margin: "0 0 1rem 0" }}>🏷️ Warehouse</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {groupedWarehouses.warehouse.map((w) => (
                      <Link
                        key={w.id}
                        to={`/warehouses/${w.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          minWidth: 240,
                          flex: "1 1 260px",
                          maxWidth: 360,
                        }}
                      >
                        <div
                          style={{
                            border: '1px solid #aaa',
                            borderRadius: '8px',
                            padding: '1.2rem',
                            background: "#f9f9f9",
                            marginBottom: "0.5rem",
                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            cursor: "pointer"
                          }}
                        >
                          <h3 style={{ margin: "0 0 0.5em 0" }}>
                            {w.name}
                          </h3>
                          <p style={{ margin: "0 0 0.5em 0" }}><strong>Location:</strong> {w.location}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {/* PRODUCTION CATEGORY */}
              {groupedWarehouses.production.length > 0 && (
                <div style={{ width: "100%", marginBottom: "2rem" }}>
                  <h2 style={{ margin: "0 0 1rem 0" }}>🏭 Production</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {groupedWarehouses.production.map((w) => (
                      <Link
                        key={w.id}
                        to={`/warehouses/${w.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          minWidth: 240,
                          flex: "1 1 260px",
                          maxWidth: 360,
                        }}
                      >
                        <div
                          style={{
                            border: '1px solid #aaa',
                            borderRadius: '8px',
                            padding: '1.2rem',
                            background: "#f9f9f9",
                            marginBottom: "0.5rem",
                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            cursor: "pointer"
                          }}
                        >
                          <h3 style={{ margin: "0 0 0.5em 0" }}>
                            {w.name}
                          </h3>
                          <p style={{ margin: "0 0 0.5em 0" }}><strong>Location:</strong> {w.location}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {/* CUSTOMER CATEGORY */}
              {groupedWarehouses.customer.length > 0 && (
                <div style={{ width: "100%", marginBottom: "2rem" }}>
                  <h2 style={{ margin: "0 0 1rem 0" }}>👥 Customer</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {groupedWarehouses.customer.map((w) => (
                      <Link
                        key={w.id}
                        to={`/warehouses/${w.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          minWidth: 240,
                          flex: "1 1 260px",
                          maxWidth: 360,
                        }}
                      >
                        <div
                          style={{
                            border: '1px solid #aaa',
                            borderRadius: '8px',
                            padding: '1.2rem',
                            background: "#f9f9f9",
                            marginBottom: "0.5rem",
                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            cursor: "pointer"
                          }}
                        >
                          <h3 style={{ margin: "0 0 0.5em 0" }}>
                            {w.name}
                          </h3>
                          <p style={{ margin: "0 0 0.5em 0" }}><strong>Location:</strong> {w.location}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        
        {showModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "2rem",
                borderRadius: "8px",
                width: "90%",
                maxWidth: "480px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                position: "relative",
              }}
            >
              <h2>{form.id ? "Edit Warehouse" : "Add Warehouse"}</h2>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Warehouse ID:<br />
                  <input
                    type="text"
                    name="warehouseId"
                    value={form.warehouseId}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                    disabled={!!form.id}
                    placeholder="Enter unique warehouse ID"
                  />
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Name:<br />
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Location:<br />
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Category:<br />
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                  >
                    <option value="warehouse">Warehouse</option>
                    <option value="production">Production</option>
                    <option value="customer">Customer</option>
                  </select>
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Status:<br />
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>
              {/* Staff assignment multi-select */}
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Assign Staff:<br />
                  <select
                    multiple
                    name="assignedStaff"
                    value={form.assignedStaff || []}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                      setForm(prev => ({ ...prev, assignedStaff: selected }));
                    }}
                    style={{ width: "100%", minHeight: 80, padding: "0.5rem", marginTop: "0.25rem", boxSizing: "border-box" }}
                  >
                    {availableStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.email})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "0.9em", color: "#888" }}>Hold Ctrl/Cmd to select multiple staff</span>
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button className="btn secondary-btn" onClick={handleCloseModal}>Cancel</button>
                <button className="btn primary-btn" onClick={handleSaveWarehouse}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Stock and Transfer Modals removed */}

        {confirmModal.type && confirmModal.warehouseId !== null && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                minWidth: "320px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                position: "relative",
                textAlign: "center",
              }}
            >
              <p>Are you sure you want to delete {warehouses.find((w: WarehouseType) => w.id === confirmModal.warehouseId)?.name}?</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
                <button className="btn secondary-btn" onClick={closeConfirmModal}>Cancel</button>
                <button className="btn primary-btn" onClick={handleConfirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Warehouse;