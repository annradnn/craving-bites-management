import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import './Product.css';

interface Product {
  id?: string;
  name: string;
  category: string;
  unit: string;
}

interface Category {
  id?: string;
  name: string;
  description: string;
}

interface Unit {
  id?: string;
  name: string;
  description: string;
}

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  saveLabel?: string;
}> = ({ title, onClose, onSave, children, saveLabel = "Save" }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
};

const Product: React.FC = () => {
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // Firestore: Fetch products, categories, units in real-time
  useEffect(() => {
    // Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
      );
    });
    // Categories
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Category[]
      );
    });
    // Units
    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      setUnits(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Unit[]
      );
    });
    return () => {
      unsubProducts();
      unsubCategories();
      unsubUnits();
    };
  }, []);

  const [productForm, setProductForm] = useState<Product>({
    name: '',
    category: '',
    unit: '',
  });

  const [categoryForm, setCategoryForm] = useState<Category>({ name: '', description: '' });
  const [unitForm, setUnitForm] = useState<Unit>({ name: '', description: '' });

  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [deleteCategoryIndex, setDeleteCategoryIndex] = useState<number | null>(null);

  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [deleteUnitIndex, setDeleteUnitIndex] = useState<number | null>(null);

  const openModal = (modal: string) => setModalOpen(modal);
  const closeModal = () => {
    setModalOpen(null);
    setSelectedProductIndex(null);
    setSelectedCategoryIndex(null);
    setSelectedUnitIndex(null);
    setDeleteIndex(null);
    setDeleteCategoryIndex(null);
    setDeleteUnitIndex(null);
    setProductForm({
      name: '',
      category: '',
      unit: '',
    });
    setCategoryForm({ name: '', description: '' });
    setUnitForm({ name: '', description: '' });
  };

  // Handlers
  const handleProductChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCategoryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUnitForm(prev => ({ ...prev, [name]: value }));
  };

  // Save
  // Product Save Handlers
  const saveNewProduct = async () => {
    if (!productForm.name) return;
    await addDoc(collection(db, 'products'), {
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit,
    });
    closeModal();
  };
  const saveEditedProduct = async () => {
    if (selectedProductIndex === null) return;
    if (!productForm.name) return;
    const product = products[selectedProductIndex];
    if (!product.id) return;
    await updateDoc(doc(db, 'products', product.id), {
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit,
    });
    closeModal();
  };
  // Category Save Handlers
  const saveNewCategory = async () => {
    if (!categoryForm.name) return;
    await addDoc(collection(db, 'categories'), {
      name: categoryForm.name,
      description: categoryForm.description,
    });
    closeModal();
  };
  const saveEditedCategory = async () => {
    if (selectedCategoryIndex === null) return;
    if (!categoryForm.name) return;
    const category = categories[selectedCategoryIndex];
    if (!category.id) return;
    await updateDoc(doc(db, 'categories', category.id), {
      name: categoryForm.name,
      description: categoryForm.description,
    });
    closeModal();
  };
  // Unit Save Handlers
  const saveNewUnit = async () => {
    if (!unitForm.name) return;
    await addDoc(collection(db, 'units'), {
      name: unitForm.name,
      description: unitForm.description,
    });
    closeModal();
  };
  const saveEditedUnit = async () => {
    if (selectedUnitIndex === null) return;
    if (!unitForm.name) return;
    const unit = units[selectedUnitIndex];
    if (!unit.id) return;
    await updateDoc(doc(db, 'units', unit.id), {
      name: unitForm.name,
      description: unitForm.description,
    });
    closeModal();
  };

  const editProduct = (index: number) => {
    const product = products[index];
    setSelectedProductIndex(index);
    setProductForm({
      name: product.name,
      category: product.category,
      unit: product.unit,
    });
    openModal('editProduct');
  };

  const confirmDeleteProduct = (index: number) => {
    setDeleteIndex(index);
    openModal('deleteProduct');
  };

  const deleteProduct = async () => {
    if (deleteIndex === null) return;
    const product = products[deleteIndex];
    if (!product.id) return;
    await deleteDoc(doc(db, 'products', product.id));
    if (selectedProductIndex === deleteIndex) {
      setSelectedProductIndex(null);
      setProductForm({
        name: '',
        category: '',
        unit: '',
      });
    }
    closeModal();
  };

  const editCategory = (index: number) => {
    const category = categories[index];
    setSelectedCategoryIndex(index);
    setCategoryForm({
      name: category.name,
      description: category.description,
    });
    openModal('editCategory');
  };

  const confirmDeleteCategory = (index: number) => {
    setDeleteCategoryIndex(index);
    openModal('deleteCategory');
  };

  const deleteCategory = async () => {
    if (deleteCategoryIndex === null) return;
    const category = categories[deleteCategoryIndex];
    if (!category.id) return;
    await deleteDoc(doc(db, 'categories', category.id));
    // Also remove category from products that have this category
    const productsToUpdate = products.filter((p) => p.category === category.name);
    for (const p of productsToUpdate) {
      if (p.id) {
        await updateDoc(doc(db, 'products', p.id), { ...p, category: '' });
      }
    }
    closeModal();
  };

  const editUnit = (index: number) => {
    const unit = units[index];
    setSelectedUnitIndex(index);
    setUnitForm({
      name: unit.name,
      description: unit.description,
    });
    openModal('editUnit');
  };

  const confirmDeleteUnit = (index: number) => {
    setDeleteUnitIndex(index);
    openModal('deleteUnit');
  };

  const deleteUnit = async () => {
    if (deleteUnitIndex === null) return;
    const unit = units[deleteUnitIndex];
    if (!unit.id) return;
    await deleteDoc(doc(db, 'units', unit.id));
    // Also remove unit from products that have this unit
    const productsToUpdate = products.filter((p) => p.unit === unit.name);
    for (const p of productsToUpdate) {
      if (p.id) {
        await updateDoc(doc(db, 'products', p.id), { ...p, unit: '' });
      }
    }
    closeModal();
  };

  return (
    <div className="product-wrapper flex">
      <Sidebar />
      <div className="product-container" style={{ marginLeft: '18rem' }}>
        <h1>🍨 Product Management</h1>

        {/* Product Master List */}
        <section className="product-section">
          <h2>Product Master List</h2>
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4}>No products available.</td></tr>
              ) : (
                products.map((p, i) => (
                  <tr key={p.id || i}>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.unit}</td>
                    <td>
                      {localStorage.getItem("role") === "admin" && (
                        <>
                          <button className="btn btn-secondary" onClick={() => editProduct(i)}>Edit</button>{' '}
                          <button className="btn btn-danger" onClick={() => confirmDeleteProduct(i)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="button-group" style={{ marginTop: '1rem' }}>
            {localStorage.getItem("role") === "admin" && (
              <button className="btn btn-primary" onClick={() => openModal('addProduct')}>Add New Product</button>
            )}
          </div>
        </section>

        {/* Categories */}
        <section className="product-section">
          <h2>Categories</h2>
          <p style={{ margin: '0.5rem 0 1rem 0', color: '#555', fontSize: '0.97rem' }}>
            List of all categories
          </p>
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={3}>No categories</td></tr>
              ) : (
                categories.map((c, i) => (
                  <tr key={c.id || i}>
                    <td>{c.name}</td>
                    <td>{c.description}</td>
                    <td>
                      {localStorage.getItem("role") === "admin" && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => editCategory(i)}>Edit</button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => confirmDeleteCategory(i)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="button-group">
            {localStorage.getItem("role") === "admin" && (
              <button className="btn btn-primary" onClick={() => openModal('addCategory')}>Add Category</button>
            )}
          </div>
        </section>

        {/* Units */}
        <section className="product-section">
          <h2>Units</h2>
          <p style={{ margin: '0.5rem 0 1rem 0', color: '#555', fontSize: '0.97rem' }}>
            List of all units
          </p>
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr><td colSpan={3}>No units</td></tr>
              ) : (
                units.map((u, i) => (
                  <tr key={u.id || i}>
                    <td>{u.name}</td>
                    <td>{u.description}</td>
                    <td>
                      {localStorage.getItem("role") === "admin" && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => editUnit(i)}>Edit</button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => confirmDeleteUnit(i)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="button-group">
            {localStorage.getItem("role") === "admin" && (
              <button className="btn btn-primary" onClick={() => openModal('addUnit')}>Add Unit</button>
            )}
          </div>
        </section>

        {/* Modals */}
        {modalOpen === 'addProduct' && (
          <Modal title="Add Product" onClose={closeModal} onSave={saveNewProduct}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Product Name:</label>
                <input name="name" placeholder="Product Name" value={productForm.name} onChange={handleProductChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Category:</label>
                <select name="category" value={productForm.category} onChange={handleProductChange}>
                  <option value="">Select Category</option>
                  {categories.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Unit:</label>
                <select name="unit" value={productForm.unit} onChange={handleProductChange}>
                  <option value="">Select Unit</option>
                  {units.map((u, i) => (
                    <option key={i} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'editProduct' && selectedProductIndex !== null && (
          <Modal title="Edit Product" onClose={closeModal} onSave={saveEditedProduct}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Product Name:</label>
                <input name="name" placeholder="Product Name" value={productForm.name} onChange={handleProductChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Category:</label>
                <select name="category" value={productForm.category} onChange={handleProductChange}>
                  <option value="">Select Category</option>
                  {categories.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Unit:</label>
                <select name="unit" value={productForm.unit} onChange={handleProductChange}>
                  <option value="">Select Unit</option>
                  {units.map((u, i) => (
                    <option key={i} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'addCategory' && (
          <Modal title="Add Category" onClose={closeModal} onSave={saveNewCategory}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <label style={{ width: '120px' }}>Category Name:</label>
                <input name="name" placeholder="Category Name" value={categoryForm.name} onChange={handleCategoryChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Category Description:</label>
                <textarea name="description" placeholder="Category Description" value={categoryForm.description} onChange={handleCategoryChange} />
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'editCategory' && selectedCategoryIndex !== null && (
          <Modal title="Edit Category" onClose={closeModal} onSave={saveEditedCategory}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <label style={{ width: '120px' }}>Category Name:</label>
                <input name="name" placeholder="Category Name" value={categoryForm.name} onChange={handleCategoryChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Category Description:</label>
                <textarea name="description" placeholder="Category Description" value={categoryForm.description} onChange={handleCategoryChange} />
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'addUnit' && (
          <Modal title="Add Unit" onClose={closeModal} onSave={saveNewUnit}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <label style={{ width: '120px' }}>Unit Name:</label>
                <input name="name" placeholder="Unit Name" value={unitForm.name} onChange={handleUnitChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Unit Description:</label>
                <textarea name="description" placeholder="Unit Description" value={unitForm.description} onChange={handleUnitChange} />
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'editUnit' && selectedUnitIndex !== null && (
          <Modal title="Edit Unit" onClose={closeModal} onSave={saveEditedUnit}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <label style={{ width: '120px' }}>Unit Name:</label>
                <input name="name" placeholder="Unit Name" value={unitForm.name} onChange={handleUnitChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '120px' }}>Unit Description:</label>
                <textarea name="description" placeholder="Unit Description" value={unitForm.description} onChange={handleUnitChange} />
              </div>
            </div>
          </Modal>
        )}

        {modalOpen === 'deleteProduct' && deleteIndex !== null && (
          <Modal title="Delete Product" onClose={closeModal} onSave={deleteProduct} saveLabel="Delete">
            <p>Are you sure you want to delete the product "{products[deleteIndex]?.name}"?</p>
          </Modal>
        )}

        {modalOpen === 'deleteCategory' && deleteCategoryIndex !== null && (
          <Modal title="Delete Category" onClose={closeModal} onSave={deleteCategory} saveLabel="Delete">
            <p>Are you sure you want to delete the category "{categories[deleteCategoryIndex]?.name}"?</p>
          </Modal>
        )}

        {modalOpen === 'deleteUnit' && deleteUnitIndex !== null && (
          <Modal title="Delete Unit" onClose={closeModal} onSave={deleteUnit} saveLabel="Delete">
            <p>Are you sure you want to delete the unit "{units[deleteUnitIndex]?.name}"?</p>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default Product;