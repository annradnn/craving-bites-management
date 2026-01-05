import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import "./Settings.css";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, getDocs } from "firebase/firestore";
import { db } from '../firebase';

const Settings: React.FC = () => {
  const [staff, setStaff] = useState<{ id: string; name: string; email: string; role: string; assignedWarehouse: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<{ id?: string; name: string; email: string; role: string; assignedWarehouse: string } | null>(null);

  const [formInputs, setFormInputs] = useState({
    id: '',
    name: '',
    email: '',
    role: 'staff',
    assignedWarehouse: ''
  });

  const [products, setProducts] = useState<{ id: string; name: string; lowStockThreshold: number }[]>([]);
  // Collapsible state for staff table
  const [showStaffTable, setShowStaffTable] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [warehouseLowStockSettings, setWarehouseLowStockSettings] = useState<{ [productId: string]: number }>({});

  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const usersCollection = collection(db, "users");
    const unsubscribe = onSnapshot(usersCollection, snapshot => {
      const usersData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (!data) return null;
          return {
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            role: data.role || '',
            assignedWarehouse: data.assignedWarehouse || ''
          };
        })
        .filter(user => user !== null) as {
          id: string;
          name: string;
          email: string;
          role: string;
          assignedWarehouse: string;
        }[];

      console.log("Mapped users:", usersData);
      setStaff(usersData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsCollection = collection(db, "products");
    const unsubscribe = onSnapshot(productsCollection, snapshot => {
      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.name || doc.id,
          name: data.name || '',
          lowStockThreshold: data.lowStockThreshold || 0
        };
      });
      setProducts(productsData);

      // Initialize low stock settings if not already
      const initialSettings: { [productId: string]: number } = {};
      productsData.forEach(p => { initialSettings[p.id] = p.lowStockThreshold || 0; });
      setWarehouseLowStockSettings(initialSettings);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const warehousesCollection = collection(db, "warehouses");
    const unsubscribe = onSnapshot(warehousesCollection, snapshot => {
      const warehousesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || ''
        };
      });
      setWarehouses(warehousesData);
    });

    return () => unsubscribe();
  }, []);

  const handleAddStaff = () => {
    setCurrentStaff(null);
    setFormInputs({
      id: '',
      name: '',
      email: '',
      role: 'staff',
      assignedWarehouse: warehouses.length > 0 ? warehouses[0].id : ''
    });
    setIsModalOpen(true);
  };

  const handleEditStaff = (member: { id: string; name: string; email: string; role: string; assignedWarehouse: string }) => {
    setCurrentStaff(member);
    setFormInputs({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      assignedWarehouse: member.assignedWarehouse
    });
    setIsModalOpen(true);
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, "users", id));
    } catch (error) {
      console.error("Error deleting staff:", error);
    }
  };

  const handleSaveStaff = async () => {
    if (
      formInputs.id.trim() === '' ||
      formInputs.name.trim() === '' ||
      formInputs.email.trim() === '' ||
      formInputs.role.trim() === '' ||
      (formInputs.role === "staff" && formInputs.assignedWarehouse.trim() === '')
    ) {
      return; // can add validation or alert if needed
    }
    try {
      if (currentStaff) {
        // Editing existing staff
        const userRef = doc(db, "users", currentStaff.id!);
        await updateDoc(userRef, {
          name: formInputs.name,
          email: formInputs.email,
          role: formInputs.role,
          assignedWarehouse: formInputs.role === "staff" ? formInputs.assignedWarehouse : ''
        });

        // Update staffAssigned subcollections for non-admin users
        if (formInputs.role === "staff") {
          // Remove staffAssigned from previous warehouses
          const warehousesCollection = collection(db, "warehouses");
          const warehousesSnapshot = await getDocs(warehousesCollection);
          for (const warehouseDoc of warehousesSnapshot.docs) {
            const staffAssignedCollection = collection(db, "warehouses", warehouseDoc.id, "staffAssigned");
            const q = query(staffAssignedCollection, where("staffEmail", "==", currentStaff.email));
            const assignedSnapshot = await getDocs(q);
            for (const docSnap of assignedSnapshot.docs) {
              await deleteDoc(docSnap.ref);
            }
          }

          // Add new staffAssigned document in assigned warehouse
          const warehouseId = formInputs.assignedWarehouse;
          const staffAssignedRef = doc(db, "warehouses", warehouseId, "staffAssigned", formInputs.email);
          await setDoc(staffAssignedRef, {
            staffEmail: formInputs.email,
            name: formInputs.name,
            role: formInputs.role
          });
        } else {
          // If role changed to admin, remove all staffAssigned entries for this staff
          const warehousesCollection = collection(db, "warehouses");
          const warehousesSnapshot = await getDocs(warehousesCollection);
          for (const warehouseDoc of warehousesSnapshot.docs) {
            const staffAssignedCollection = collection(db, "warehouses", warehouseDoc.id, "staffAssigned");
            const q = query(staffAssignedCollection, where("staffEmail", "==", currentStaff.email));
            const assignedSnapshot = await getDocs(q);
            for (const docSnap of assignedSnapshot.docs) {
              await deleteDoc(docSnap.ref);
            }
          }
        }
      } else {
        // Adding new user with manual ID
        const newUserRef = doc(db, "users", formInputs.id);
        await setDoc(newUserRef, {
          name: formInputs.name,
          email: formInputs.email,
          role: formInputs.role,
          assignedWarehouse: formInputs.role === "staff" ? formInputs.assignedWarehouse : ''
        });

        // For non-admin users, create staffAssigned subcollections inside assigned warehouse
        if (formInputs.role === "staff") {
          const warehouseId = formInputs.assignedWarehouse;
          const staffAssignedRef = doc(db, "warehouses", warehouseId, "staffAssigned", formInputs.email);
          await setDoc(staffAssignedRef, {
            staffEmail: formInputs.email,
            name: formInputs.name,
            role: formInputs.role
          });
        }
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving staff:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormInputs(prev => ({ ...prev, [name]: value }));
  };

  const userRole = localStorage.getItem("role");


  return (
    <div className="settings-wrapper">
      <Sidebar />
      <div className="settings-content">
        <div className="settings-container">
          <h1>Settings</h1>

          <section className="settings-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Staff Management</h2>
              <button
                className="btn secondary-btn"
                onClick={() => setShowStaffTable((prev) => !prev)}
                style={{ marginLeft: "1rem", minWidth: "120px" }}
                aria-expanded={showStaffTable}
                aria-controls="staff-table-section"
              >
                {showStaffTable ? "Hide Table" : "Show Table"}
              </button>
            </div>
            {showStaffTable && (
              <>
                <div className="table-controls">
                  {userRole === "admin" && (
                    <button className="btn primary-btn" onClick={handleAddStaff}>Add Staff</button>
                  )}
                </div>
                <div
                  className="table-responsive"
                  style={{ maxHeight: '400px', overflowY: 'auto' }}
                  id="staff-table-section"
                >
                  {staff.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>No staff available.</div>
                  ) : (
                    <table className="inventory-table staff-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                      {/* <th>Assigned Warehouse</th> */}
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map(member => (
                          <tr key={member.id}>
                            <td>{member.id}</td>
                            <td>{member.name}</td>
                            <td>{member.email}</td>
                            <td>{member.role}</td>
                            {/* <td>{warehouses.find(w => w.id === member.assignedWarehouse)?.name || member.assignedWarehouse}</td> */}
                            <td>
                              {userRole === "admin" && (
                                <>
                                  <button className="btn primary-btn" onClick={() => handleEditStaff(member)}>Edit</button>
                                  <button className="btn secondary-btn" onClick={() => handleDeleteStaff(member.id)}>Delete</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="settings-section">
            <h2>Low Stock Alert Settings</h2>

            {/* Warehouse Selector */}
            <div className="table-controls">
              <label style={{ marginRight: '10px' }}>Select Warehouse:</label>
              <select
                value={selectedWarehouse}
                onChange={async (e) => {
                  const wid = e.target.value;
                  setSelectedWarehouse(wid);

                  if (!wid) {
                    setWarehouseLowStockSettings({});
                    return;
                  }

                  // Fetch warehouse-specific low stock settings
                  const lowStockCollection = collection(db, "warehouses", wid, "lowStockSettings");
                  const snapshot = await getDocs(lowStockCollection);
                  const settings: { [productId: string]: number } = {};
                  snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    settings[docSnap.id] = data.threshold || 0;
                  });

                  // Fetch the warehouse's stock collection to get only products available in this warehouse
                  const stockCollection = collection(db, "warehouses", wid, "stock");
                  const stockSnapshot = await getDocs(stockCollection);
                  const productMap: { [productName: string]: { id: string; name: string; lowStockThreshold: number } } = {};
                  stockSnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.product) {
                      const productName = data.product;
                      if (!productMap[productName]) {
                        productMap[productName] = {
                          id: productName,
                          name: productName,
                          lowStockThreshold: settings[productName] || 0
                        };
                      }
                    }
                  });
                  const warehouseProducts = Object.values(productMap);
                  setProducts(warehouseProducts);
                  setWarehouseLowStockSettings(settings);
                }}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedWarehouse ? (
              <div className="table-responsive" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table className="inventory-table staff-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Current Threshold</th>
                      <th>Update Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{warehouseLowStockSettings[product.id]}</td>
                        <td>
                          {userRole === "admin" ? (
                            <input
                              type="number"
                              value={warehouseLowStockSettings[product.id] || 0}
                              onChange={(e) =>
                                setWarehouseLowStockSettings((prev) => ({
                                  ...prev,
                                  [product.id]: parseInt(e.target.value),
                                }))
                              }
                            />
                          ) : (
                            warehouseLowStockSettings[product.id]
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ textAlign: "center", marginTop: "1rem" }}>Please select a warehouse.</p>
            )}

            {userRole === "admin" && selectedWarehouse && (
              <button
                className="btn primary-btn"
                onClick={async () => {
                  try {
                    const promises = Object.entries(warehouseLowStockSettings).map(([productId, threshold]) => {
                      const ref = doc(db, "warehouses", selectedWarehouse, "lowStockSettings", productId);
                      return setDoc(ref, { threshold }, { merge: true });
                    });
                    await Promise.all(promises);
                    alert("Low stock thresholds updated successfully for this warehouse.");
                  } catch (error) {
                    console.error("Error updating warehouse thresholds:", error);
                  }
                }}
              >
                Save Thresholds
              </button>
            )}
          </section>

          {isModalOpen && userRole === "admin" && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>{currentStaff ? 'Edit Staff' : 'Add Staff'}</h3>
                <form onSubmit={e => { e.preventDefault(); handleSaveStaff(); }}>
                  {!currentStaff && (
                    <label>
                      Staff ID:
                      <input type="text" name="id" value={formInputs.id} onChange={handleInputChange} required />
                    </label>
                  )}
                  <label>
                    Name:
                    <input type="text" name="name" value={formInputs.name} onChange={handleInputChange} required />
                  </label>
                  <label>
                    Email:
                    <input type="email" name="email" value={formInputs.email} onChange={handleInputChange} required />
                  </label>
                  <label>
                    Role:
                    <select name="role" value={formInputs.role} onChange={handleInputChange} required>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  {/* Assigned Warehouse field removed from edit modal */}
                  <div className="modal-buttons">
                    <button type="submit" className="btn primary-btn">Save</button>
                    <button type="button" className="btn secondary-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
