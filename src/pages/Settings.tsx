import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import "./Settings.css";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from '../firebase';

const Settings: React.FC = () => {
  const [staff, setStaff] = useState<{ id: string; name: string; email: string; role: string; assignedWarehouse: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<{ id?: string; name: string; email: string; role: string; assignedWarehouse: string } | null>(null);

  const [formInputs, setFormInputs] = useState({
    id: '',
    name: '',
    email: '',
    role: '',
    assignedWarehouse: ''
  });

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

  const handleAddStaff = () => {
    setCurrentStaff(null);
    setFormInputs({
      id: '',
      name: '',
      email: '',
      role: '',
      assignedWarehouse: ''
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
      formInputs.assignedWarehouse.trim() === ''
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
          assignedWarehouse: formInputs.assignedWarehouse
        });
      } else {
        // Adding new user with manual ID
        const newUserRef = doc(db, "users", formInputs.id);
        await setDoc(newUserRef, {
          name: formInputs.name,
          email: formInputs.email,
          role: formInputs.role,
          assignedWarehouse: formInputs.assignedWarehouse
        });
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

  return (
    <div className="settings-wrapper">
      <Sidebar />
      <div className="settings-content">
        <div className="settings-container">
          <h1>Settings</h1>

          <section className="settings-section">
            <h2>Staff Management</h2>
            <div className="table-controls">
              {localStorage.getItem("role") === "admin" && (
                <button className="btn primary-btn" onClick={handleAddStaff}>Add Staff</button>
              )}
            </div>
            <div className="table-responsive">
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
                      <th>Assigned Warehouse</th>
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
                        <td>{member.assignedWarehouse}</td>
                        <td>
                          {localStorage.getItem("role") === "admin" && (
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
          </section>

          {isModalOpen && (
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
                    <input type="text" name="role" value={formInputs.role} onChange={handleInputChange} required />
                  </label>
                  <label>
                    Assigned Warehouse:
                    <input type="text" name="assignedWarehouse" value={formInputs.assignedWarehouse} onChange={handleInputChange} required />
                  </label>
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
