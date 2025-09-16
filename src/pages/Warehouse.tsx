import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
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
  };
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  // State to store the full list of warehouses (unfiltered)
  const [allWarehouses, setAllWarehouses] = useState<WarehouseType[]>([]);
  // Staff assigned state: maps warehouseId to staff list
  const [staffAssigned, setStaffAssigned] = useState<Record<string, { staffEmail: string, name: string, role: string }[]>>({});
  // Fetch staffAssigned: for each warehouse, get staffAssigned subcollection
  const fetchStaffAssignments = useCallback(async () => {
    try {
      // Get all warehouses
      const warehouseSnap = await getDocs(collection(db, "warehouses"));
      const warehouseIds = warehouseSnap.docs.map(doc => doc.id);
      // Prepare warehouseId => staff[] mapping
      const assignments: Record<string, { staffEmail: string, name: string, role: string }[]> = {};
      await Promise.all(
        warehouseIds.map(async (warehouseId) => {
          const staffSnap = await getDocs(collection(db, "warehouses", warehouseId, "staffAssigned"));
          assignments[warehouseId] = staffSnap.docs.map(staffDoc => {
            const data = staffDoc.data();
            return {
              staffEmail: data.staffEmail,
              name: data.name,
              role: data.role,
            };
          });
        })
      );
      setStaffAssigned(assignments);
    } catch {
      setStaffAssigned({});
    }
  }, []);

  // Product Master List
  type Product = {
    id: string;
    name: string;
    code: string;
    category: string;
    unit: string;
    expiryDate: string;
    // lowStockThreshold is NOT in the local type, as it's only in the database
  };
  // WarehouseType defined above
  type Stock = {
    id?: string;
    product: string;
    productId: string;
    code: string;
    quantity: number;
    unit: string;
    expiryDate: string;
    reason: string;
    createdAt?: Date;
    By?: string;
    category?: string;
  };

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(
        data as Product[]
      );
    };
    fetchProducts();
  }, []);

  const [warehouseStock, setWarehouseStock] = useState<Record<string, Stock[]>>({});
  // State for low stock alerts
  const [lowStockAlerts, setLowStockAlerts] = useState<
    { warehouseName: string; productName: string; code: string; quantity: number }[]
  >([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    warehouseId: string;
    name: string;
    location: string;
    status: string;
  }>({
    warehouseId: "",
    name: "",
    location: "",
    status: "Active",
  });

  const [confirmModal, setConfirmModal] = useState<{
    type: "delete" | null;
    warehouseId: string | null;
  }>({ type: null, warehouseId: null });

  // New states for stock modals
  const [stockModal, setStockModal] = useState<{
    type: "stockIn" | "stockOut" | null;
    warehouseId: string | null;
  }>({ type: null, warehouseId: null });

  const [transferModal, setTransferModal] = useState<{
    fromWarehouseId: string | null;
  }>({ fromWarehouseId: null });

  // Form states for stock and transfer modals
  const [stockForm, setStockForm] = useState<{
    productId: string | "";
    code: string;
    quantity: number;
    expiryDate: string;
    reason: string;
    availableQty?: number;
    unit?: string;
  }>({
    productId: "",
    code: "",
    quantity: 0,
    expiryDate: "",
    reason: "",
    availableQty: undefined,
    unit: "",
  });

  const [transferForm, setTransferForm] = useState<{
    toWarehouseId: string | null;
    productId: string | "";
    quantity: number;
    availableQty?: number;
    unit?: string;
  }>({
    toWarehouseId: null,
    productId: "",
    quantity: 0,
    availableQty: undefined,
    unit: "",
  });

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
    });
  };

  // Save new or edited warehouse to Firestore
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
        });
      }
      handleCloseModal();
    } catch (error) {
      alert("Failed to save warehouse: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const openConfirmModal = (type: "delete", warehouseId: string) => {
    setConfirmModal({ type, warehouseId });
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

  const handleEditWarehouse = (warehouseId: string) => {
    const warehouseToEdit = warehouses.find((w: WarehouseType) => w.id === warehouseId);
    if (warehouseToEdit) {
      setForm({
        ...warehouseToEdit,
        id: warehouseToEdit.id,
        warehouseId: warehouseToEdit.id, // set warehouseId for edit, but keep field disabled
      });
      setShowModal(true);
    }
  };

  // Helper to update totalItems in Firestore for a warehouse
  const updateTotalItems = async (warehouseId: string) => {
    try {
      const stockSnap = await getDocs(collection(db, "warehouses", warehouseId, "stock"));
      let total = 0;
      stockSnap.forEach(doc => {
        const data = doc.data();
        total += Number(data.quantity) || 0;
      });
      const warehouseRef = doc(db, "warehouses", warehouseId);
      await updateDoc(warehouseRef, { totalItems: total });
    } catch {
      // Optionally log error
    }
  };

  // Firestore-based stock in - create a new batch for each stock in, code is entered by user and used as doc ID
  const handleStockIn = async (
    warehouseId: string,
    productId: string,
    code: string, // code is entered by user and used as doc ID
    quantity: number,
    expiryDate: string,
    reason: string
  ) => {
    const productObj = products.find(p => p.id === productId);
    if (!productObj) return;
    try {
      // Check if code is provided
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        alert("Please enter a batch code.");
        return;
      }
      // Check if batch with this code already exists in this warehouse for this product
      const stockSnap = await getDocs(collection(db, "warehouses", warehouseId, "stock"));
      const exists = stockSnap.docs.find(
        d => (d.data().code === trimmedCode)
      );
      if (exists) {
        alert("A batch with this code already exists in this warehouse. Please enter a unique code.");
        return;
      }
      // Set doc with code as ID, productId is the same as code (batch code)
      const stockRef = doc(db, "warehouses", warehouseId, "stock", trimmedCode);
      await setDoc(stockRef, {
        product: productObj.name,
        productId: trimmedCode, // productId is same as batch code
        code: trimmedCode,
        quantity,
        unit: productObj.unit,
        expiryDate,
        reason,
        createdAt: serverTimestamp(),
        By: localStorage.getItem('name') || "", // Store staff name
        category: productObj.category,
      });
      // Generate custom transactionId for transaction log
      const dateCode = new Date().toISOString().slice(0,10).replace(/-/g,"");
      const transactionId = `${warehouseId}-${trimmedCode}-stockIn-${reason}-${dateCode}`;
      // Log transaction, code = trimmedCode
      await setDoc(doc(db, "warehouses", warehouseId, "transactions", transactionId), {
        id: transactionId,
        type: "stockIn",
        productId: trimmedCode,
        product: productObj.name,
        code: trimmedCode,
        quantity,
        unit: productObj.unit,
        expiryDate,
        reason,
        timestamp: serverTimestamp(),
        By: localStorage.getItem('name') || "",
        category: productObj.category,
      });
      fetchWarehouseStock();
      await updateTotalItems(warehouseId);
    } catch (error) {
      alert("Failed to stock in: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Firestore-based stock out (per batch)
  const handleStockOut = async (
    warehouseId: string,
    productId: string,
    code: string,
    quantity: number
  ) => {
    const productObj = products.find(p => p.id === productId);
    if (!productObj) return;
    try {
      // Find the batch (document) for the given code in this warehouse
      const stockArr = warehouseStock[warehouseId] || [];
      const batchStock = stockArr.find(s => s.product === productObj.name && s.code === code);
      if (!batchStock || !batchStock.id) {
        alert(`Batch with code ${code} not found for product ${productObj.name} in this warehouse.`);
        return;
      }
      const stockRef = doc(db, "warehouses", warehouseId, "stock", batchStock.id);
      const stockSnap = await getDoc(stockRef);
      if (!stockSnap.exists()) {
        alert(`Batch with code ${code} not found for product ${productObj.name} in this warehouse.`);
        return;
      }
      const currentQty = Number(stockSnap.data().quantity || 0);
      if (currentQty < quantity) {
        alert(`Not enough stock in batch ${code} of ${productObj.name}. Current: ${currentQty}, Tried: ${quantity}`);
        return;
      }
      const newQty = currentQty - quantity;
      await updateDoc(stockRef, { quantity: newQty });
      // Generate custom transactionId for transaction log
      const dateCode = new Date().toISOString().slice(0,10).replace(/-/g,"");
      const reason = stockForm.reason;
      const transactionId = `${warehouseId}-${batchStock.code}-stockOut-${reason}-${dateCode}`;
      // Log transaction
      await setDoc(doc(db, "warehouses", warehouseId, "transactions", transactionId), {
        id: transactionId,
        type: "stockOut",
        productId: batchStock.code, // productId is same as batch code
        product: productObj.name,
        code,
        quantity,
        unit: productObj.unit,
        reason,
        timestamp: serverTimestamp(),
        By: localStorage.getItem('name') || "",
        category: productObj.category,
      });
      fetchWarehouseStock();
      await updateTotalItems(warehouseId);
    } catch (error) {
      alert("Failed to stock out: " + (error instanceof Error ? error.message : String(error)));
    }
  };
  // Firestore-based transfer (per batch)
  const handleTransfer = async (
    fromId: string,
    toId: string,
    productId: string,
    code: string,
    quantity: number
  ) => {
    const productObj = products.find(p => p.id === productId);
    if (!productObj) return;
    try {
      // Find the batch (document) for the given code in the source warehouse
      const fromStockArr = warehouseStock[fromId] || [];
      const fromBatch = fromStockArr.find(s => s.product === productObj.name && s.code === code);
      if (!fromBatch || !fromBatch.id) {
        alert(`Batch with code ${code} not found for product ${productObj.name} in source warehouse.`);
        return;
      }
      const fromStockRef = doc(db, "warehouses", fromId, "stock", fromBatch.id);
      const fromSnap = await getDoc(fromStockRef);
      if (!fromSnap.exists()) {
        alert(`Batch with code ${code} not found for product ${productObj.name} in source warehouse.`);
        return;
      }
      const currentQty = Number(fromSnap.data().quantity || 0);
      if (currentQty < quantity) {
        alert(`Not enough stock in batch ${code} of ${productObj.name} in source warehouse. Current: ${currentQty}, Tried: ${quantity}`);
        return;
      }
      const newFromQty = currentQty - quantity;
      await updateDoc(fromStockRef, { quantity: newFromQty });

      // To warehouse: check if batch with same code exists
      const toStockArr = warehouseStock[toId] || [];
      const toBatch = toStockArr.find(s => s.product === productObj.name && s.code === code);
      if (toBatch && toBatch.id) {
        const toStockRef = doc(db, "warehouses", toId, "stock", toBatch.id);
        const toSnap = await getDoc(toStockRef);
        if (toSnap.exists()) {
          const destQty = Number(toSnap.data().quantity || 0) + quantity;
          await updateDoc(toStockRef, { quantity: destQty });
        }
      } else {
        // Create new batch in destination warehouse with same code
        // productId is the batch code
        const toStockRef = doc(db, "warehouses", toId, "stock", code);
        await setDoc(toStockRef, {
          product: productObj.name,
          productId: code, // productId is batch code
          code: code,
          quantity: quantity,
          unit: productObj.unit,
          expiryDate: fromBatch.expiryDate,
          reason: "Transfer",
          createdAt: serverTimestamp(),
          By: localStorage.getItem('name') || "",
          category: productObj.category,
        });
      }
      // Generate unique transaction IDs with date and time (hours, minutes, seconds)
      const now = new Date();
      const dateCode = now.toISOString().slice(0,10).replace(/-/g,"");
      const timeCode = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      const transactionIdFrom = `${fromId}-${code}-transferOut-Transfer-${dateCode}-${timeCode}`;
      const transactionIdTo = `${toId}-${code}-transferIn-Transfer-${dateCode}-${timeCode}`;
      // Log transactions for both warehouses with unique IDs
      await setDoc(doc(db, "warehouses", fromId, "transactions", transactionIdFrom), {
        id: transactionIdFrom,
        type: "transferOut",
        productId: code, // batch code
        product: productObj.name,
        code,
        quantity,
        unit: productObj.unit,
        toWarehouseId: toId,
        reason: "Transfer",
        timestamp: serverTimestamp(),
        By: localStorage.getItem('name') || "",
        category: productObj.category,
      });
      await setDoc(doc(db, "warehouses", toId, "transactions", transactionIdTo), {
        id: transactionIdTo,
        type: "transferIn",
        productId: code, // batch code
        product: productObj.name,
        code,
        quantity,
        unit: productObj.unit,
        fromWarehouseId: fromId,
        reason: "Transfer",
        timestamp: serverTimestamp(),
        By: localStorage.getItem('name') || "",
        category: productObj.category,
      });
      fetchWarehouseStock();
      await updateTotalItems(fromId);
      await updateTotalItems(toId);
    } catch (error) {
      alert("Failed to transfer: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Handlers for opening stock modals
  const openStockModal = (type: "stockIn" | "stockOut", warehouseId: string) => {
    setStockForm({
      productId: "",
      code: "",
      quantity: 0,
      expiryDate: "",
      reason: "",
      availableQty: undefined,
      unit: "",
    });
    setStockModal({ type, warehouseId });
  };

  const closeStockModal = () => {
    setStockModal({ type: null, warehouseId: null });
    setStockForm({
      productId: "",
      code: "",
      quantity: 0,
      expiryDate: "",
      reason: "",
      availableQty: undefined,
      unit: "",
    });
  };

  const handleStockFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "productId") {
      const prodId = value;
      let availableQty = 0;
      let unit = "";
      let expiryDate = "";
      if (stockModal.warehouseId !== null && prodId !== "") {
        const productObj = products.find(p => p.id === prodId);
        // For stockIn: use product defaults. For stockOut: clear code until batch is selected.
        const stockArr = warehouseStock[stockModal.warehouseId] || [];
        if (stockModal.type === "stockIn") {
          availableQty = stockArr
            .filter(s => s.product === (productObj?.name ?? ""))
            .reduce((sum, s) => sum + s.quantity, 0);
          unit = productObj ? productObj.unit : "";
          expiryDate = productObj ? productObj.expiryDate : "";
        } else if (stockModal.type === "stockOut") {
          // For stockOut, code is selected separately, clear code and availableQty for now
          availableQty = 0;
          unit = productObj ? productObj.unit : "";
          expiryDate = "";
        }
      }
      setStockForm(prev => ({
        ...prev,
        productId: prodId,
        // For stockIn, code is auto-assigned, so clear it
        code: "",
        expiryDate,
        availableQty,
        unit,
      }));
    } else if (name === "code") {
      // On batch code selection (for stockOut), update availableQty and expiryDate/unit
      if (stockModal.type === "stockOut" && stockModal.warehouseId && stockForm.productId) {
        const productObj = products.find(p => p.id === stockForm.productId);
        const stockArr = warehouseStock[stockModal.warehouseId] || [];
        const batch = stockArr.find(s => s.product === (productObj?.name ?? "") && s.code === value);
        setStockForm(prev => ({
          ...prev,
          code: value,
          availableQty: batch ? batch.quantity : 0,
          unit: batch ? batch.unit : productObj?.unit || "",
          expiryDate: batch ? batch.expiryDate : "",
        }));
      } else {
        setStockForm(prev => ({
          ...prev,
          code: value,
        }));
      }
    } else if (name === "quantity") {
      setStockForm(prev => ({
        ...prev,
        quantity: Number(value),
      }));
    } else {
      setStockForm(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const submitStock = () => {
    if (
      stockForm.productId === "" ||
      stockForm.quantity <= 0 ||
      (stockModal.type === "stockIn" && stockForm.expiryDate.trim() === "") ||
      !stockForm.reason.trim()
    ) {
      alert("Please fill in all fields with valid values.");
      return;
    }
    if (stockModal.warehouseId === null || stockModal.type === null) return;

    const productId = stockForm.productId as string;
    const qty = Number(stockForm.quantity);
    const code = stockForm.code;
    const expiryDate = stockForm.expiryDate;
    const reason = stockForm.reason;

    if (stockModal.type === "stockIn") {
      // For stock in, code is manually entered by user and must be provided
      if (!code.trim()) {
        alert("Please enter a batch code.");
        return;
      }
      handleStockIn(stockModal.warehouseId, productId, code, qty, expiryDate, reason);
      closeStockModal();
    } else if (stockModal.type === "stockOut") {
      // Validate that quantity does not exceed availableQty for the batch
      if ((stockForm.availableQty ?? 0) < qty) {
        alert("Not enough stock in the selected batch.");
        return;
      }
      if (code.trim() === "") {
        alert("Please select a batch.");
        return;
      }
      handleStockOut(stockModal.warehouseId, productId, code, qty);
      closeStockModal();
    }
  };

  // Handlers for transfer modal
  // Transfer form state now needs code (batch) selection
  const [transferBatchList, setTransferBatchList] = useState<{ code: string, availableQty: number, expiryDate: string, unit: string }[]>([]);
  const [transferSelectedBatch, setTransferSelectedBatch] = useState<string>("");

  const openTransferModal = (fromWarehouseId: string) => {
    setTransferForm({ toWarehouseId: null, productId: "", quantity: 0, availableQty: undefined, unit: "" });
    setTransferModal({ fromWarehouseId });
    setTransferBatchList([]);
    setTransferSelectedBatch("");
  };

  const closeTransferModal = () => {
    setTransferModal({ fromWarehouseId: null });
    setTransferForm({ toWarehouseId: null, productId: "", quantity: 0, availableQty: undefined, unit: "" });
  };

  const handleTransferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "productId") {
      const prodId = value;
      let unit = "";
      let batchList: { code: string, availableQty: number, expiryDate: string, unit: string }[] = [];
      if (transferModal.fromWarehouseId !== null && prodId !== "") {
        const productObj = products.find((p: Product) => p.id === prodId);
        const stockArr = warehouseStock[transferModal.fromWarehouseId] || [];
        // List all batches for this product in the source warehouse
        batchList = productObj
          ? stockArr
              .filter((s: Stock) => s.product === productObj.name)
              .map((s: Stock) => ({
                code: s.code,
                availableQty: s.quantity,
                expiryDate: s.expiryDate,
                unit: s.unit
              }))
          : [];
        unit = productObj ? productObj.unit : "";
      }
      setTransferBatchList(batchList);
      setTransferSelectedBatch("");
      setTransferForm(prev => ({
        ...prev,
        productId: prodId,
        availableQty: undefined,
        unit,
      }));
    } else if (name === "batchCode") {
      setTransferSelectedBatch(value);
      // Find batch details
      const batch = transferBatchList.find(b => b.code === value);
      setTransferForm(prev => ({
        ...prev,
        availableQty: batch ? batch.availableQty : 0,
        unit: batch ? batch.unit : prev.unit,
      }));
    } else if (name === "quantity") {
      setTransferForm(prev => ({
        ...prev,
        quantity: Number(value),
      }));
    } else if (name === "toWarehouseId") {
      setTransferForm(prev => ({
        ...prev,
        toWarehouseId: value === "" ? null : value,
      }));
    } else {
      setTransferForm(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const submitTransfer = async () => {
    if (
      transferModal.fromWarehouseId === null ||
      transferForm.toWarehouseId === null ||
      transferForm.toWarehouseId === transferModal.fromWarehouseId ||
      transferForm.productId === "" ||
      transferSelectedBatch === "" ||
      transferForm.quantity <= 0
    ) {
      alert("Please fill in all fields with valid values and select a different warehouse and batch.");
      return;
    }

    const productId = transferForm.productId as string;
    const qty = Number(transferForm.quantity);
    const code = transferSelectedBatch;

    // Validate quantity does not exceed batch's availableQty
    const batch = transferBatchList.find(b => b.code === code);
    if (!batch || batch.availableQty < qty) {
      alert("Not enough stock in the selected batch.");
      return;
    }

    await handleTransfer(transferModal.fromWarehouseId, transferForm.toWarehouseId, productId, code, qty);
    closeTransferModal();
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

  // Fetch all stock for all warehouses, include category from product, and update stock doc if product details changed
  const fetchWarehouseStock = useCallback(async () => {
    try {
      const stockObj: Record<string, Stock[]> = {};
      const snapshot = await getDocs(collection(db, "warehouses"));
      for (const warehouseDoc of snapshot.docs) {
        const warehouseId = warehouseDoc.id;
        const stockSnap = await getDocs(collection(db, "warehouses", warehouseId, "stock"));
        // Map for each stock doc
        stockObj[warehouseId] = await Promise.all(
          stockSnap.docs.map(async docSnap => {
            const data = docSnap.data();
            // Find matching product
            const prod =
              products.find(p => p.id === data.productId) ||
              products.find(p => p.code === data.code) ||
              products.find(p => p.name === data.product);
            // Check and update doc if product details changed
            if (
              prod &&
              (
                data.product !== prod.name ||
                data.unit !== prod.unit ||
                data.category !== prod.category
              )
            ) {
              // Update Firestore doc with new product info
              try {
                await updateDoc(
                  doc(db, "warehouses", warehouseId, "stock", docSnap.id),
                  {
                    product: prod.name,
                    unit: prod.unit,
                    category: prod.category,
                  }
                );
              } catch {
                // Optionally log error, but don't block
              }
            }
            // Use updated product info from prod if available
            return {
              id: docSnap.id,
              product: prod ? prod.name : data.product,
              productId: data.productId ?? "",
              code: data.code,
              quantity: data.quantity,
              unit: prod ? prod.unit : data.unit,
              expiryDate: data.expiryDate,
              reason: data.reason,
              createdAt: data.createdAt ? data.createdAt.toDate?.() : undefined,
              By: data.By ?? "",
              category: prod ? prod.category : (data.category || ""),
            };
          })
        );
      }
      setWarehouseStock(stockObj);
    } catch {
      setWarehouseStock({});
    }
  }, [products]);

  // Function to check for low stock alerts (per-product, summed across all batches)
  const checkLowStockAlerts = useCallback(async () => {
    // Fallback threshold if not set in DB
    const DEFAULT_THRESHOLD = 10;
    // Build a map of product name to threshold by fetching lowStockThreshold from Firestore for each product
    // This is async, so use Promise.all for all products
    const productThresholdMap: Record<string, number> = {};
    await Promise.all(
      products.map(async (p: Product) => {
        try {
          const docSnap = await getDoc(doc(db, "products", p.id));
          const data = docSnap.exists() ? docSnap.data() : {};
          if (typeof data.lowStockThreshold === "number" && !isNaN(data.lowStockThreshold)) {
            productThresholdMap[p.name] = data.lowStockThreshold;
          } else {
            productThresholdMap[p.name] = DEFAULT_THRESHOLD;
          }
        } catch {
          productThresholdMap[p.name] = DEFAULT_THRESHOLD;
        }
      })
    );
    const alerts: { warehouseName: string; productName: string; code: string; quantity: number }[] = [];
    warehouses.forEach((warehouse) => {
      const stockArr = warehouseStock[warehouse.id] || [];
      // Group stock by product name, sum quantities
      const productSums: Record<string, { totalQty: number, batches: { code: string, qty: number }[] }> = {};
      stockArr.forEach((stock) => {
        // Only consider positive quantities
        if (typeof stock.quantity === "number" && stock.quantity > 0) {
          if (!productSums[stock.product]) {
            productSums[stock.product] = { totalQty: 0, batches: [] };
          }
          productSums[stock.product].totalQty += stock.quantity;
          productSums[stock.product].batches.push({ code: stock.code, qty: stock.quantity });
        }
      });
      // For each product, check if totalQty <= threshold
      Object.entries(productSums).forEach(([productName, { totalQty, batches }]) => {
        const threshold = productThresholdMap[productName] ?? DEFAULT_THRESHOLD;
        if (totalQty <= threshold) {
          // Alert for each batch of this product in this warehouse, as per requirements
          batches.forEach(batch => {
            alerts.push({
              warehouseName: warehouse.name,
              productName,
              code: batch.code,
              quantity: batch.qty,
            });
          });
        }
      });
    });
    setLowStockAlerts(alerts);
  }, [warehouses, warehouseStock, products]);

  // Real-time listeners for warehouses and stock, and staffAssigned
  useEffect(() => {
    // Warehouses
    const unsubWarehouses = onSnapshot(collection(db, "warehouses"), () => {
      fetchWarehouses();
      fetchWarehouseStock();
      fetchStaffAssignments();
    });
    // For each warehouse, listen to its staffAssigned subcollection
    let staffUnsubs: (() => void)[] = [];
    // Set up listeners for staffAssigned subcollections
    (async () => {
      const warehouseSnap = await getDocs(collection(db, "warehouses"));
      staffUnsubs = warehouseSnap.docs.map((warehouseDoc) => {
        const warehouseId = warehouseDoc.id;
        return onSnapshot(collection(db, "warehouses", warehouseId, "staffAssigned"), () => {
          fetchStaffAssignments();
        });
      });
    })();
    // Initial fetch
    fetchWarehouses();
    fetchWarehouseStock();
    fetchStaffAssignments();
    return () => {
      unsubWarehouses();
      staffUnsubs.forEach(unsub => unsub && unsub());
    };
  }, [fetchWarehouses, fetchWarehouseStock, fetchStaffAssignments]);
  // Remove previous effect that syncs staffAssigned from users collection, now handled in fetchStaffAssignments

  // Show all warehouses to all users, no filtering by staffAssigned or email
  useEffect(() => {
    setWarehouses(allWarehouses);
  }, [allWarehouses]);

  // Check low stock alerts whenever warehouses or warehouseStock change
  useEffect(() => {
    // Call the async version and ignore unhandled promise
    checkLowStockAlerts();
  }, [warehouses, warehouseStock, checkLowStockAlerts]);

  return (
    <div className="product-wrapper flex">
      <Sidebar />
      <div className="product-container">
        <h1>🏭 Warehouse</h1>
        {/* Low Stock Alerts - displayed as a table */}
        {lowStockAlerts.length > 0 && (
          <div style={{ background: "#fffbe7", border: "1px solid #ffe58f", borderRadius: "6px", padding: "1rem", marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#ad6800", margin: "0 0 0.5em 0" }}>⚠️ Low Stock Alerts</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fffbe7" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ffe58f", textAlign: "left", padding: "4px" }}>Warehouse</th>
                  <th style={{ borderBottom: "1px solid #ffe58f", textAlign: "left", padding: "4px" }}>Product Name</th>
                  <th style={{ borderBottom: "1px solid #ffe58f", textAlign: "left", padding: "4px" }}>Code</th>
                  <th style={{ borderBottom: "1px solid #ffe58f", textAlign: "left", padding: "4px" }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map(
                  (
                    alert: { warehouseName: string; productName: string; code: string; quantity: number },
                    idx: number
                  ) => (
                    <tr key={alert.warehouseName + alert.productName + alert.code + idx}>
                      <td style={{ padding: "4px" }}>{alert.warehouseName}</td>
                      <td style={{ padding: "4px" }}>{alert.productName}</td>
                      <td style={{ padding: "4px" }}>{alert.code}</td>
                      <td style={{ padding: "4px" }}>{alert.quantity}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
        <table className="product-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th>Total Items</th>
              <th>Actions</th>
              <th>Assigned Staff</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>No warehouses</td>
              </tr>
            ) : (
              warehouses.map((warehouse: WarehouseType) => {
                // Filter out zero-quantity stock items for total calculation
                const filteredStock = (warehouseStock[warehouse.id] || []).filter((s: Stock) => s.quantity !== 0);
                const totalQuantity = filteredStock.reduce((sum: number, s: Stock) => sum + s.quantity, 0) || 0;
                const staffList = staffAssigned[warehouse.id] || [];
                return (
                  <tr key={warehouse.id}>
                    <td>{warehouse.name}</td>
                    <td>{warehouse.location}</td>
                    <td>{warehouse.status}</td>
                    <td>{totalQuantity}</td>
                    <td>
                      {localStorage.getItem("role") === "admin" && (
                        <>
                          <button className="btn action-btn" onClick={() => handleEditWarehouse(warehouse.id)}>Edit</button>
                          <button className="btn action-btn" onClick={() => openConfirmModal("delete", warehouse.id)}>Delete</button>
                        </>
                      )}
                    </td>
                    <td>
                      {staffList.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {staffList.map((s, idx) => (
                            <li key={s.staffEmail + idx}>
                              {s.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "#888" }}>-</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="button-group">
          {localStorage.getItem("role") === "admin" && (
            <button className="btn primary-btn" onClick={handleAddWarehouse}>Add Warehouse</button>
          )}
        </div>

        {warehouses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            {warehouses.map((warehouse) => {
              // Filter out zero-quantity stock items for display and total
              const filteredStock = (warehouseStock[warehouse.id] || []).filter((s: Stock) => s.quantity !== 0);
              const totalQuantity = filteredStock.reduce((sum: number, s: Stock) => sum + s.quantity, 0) || 0;
              // const staffList = staffAssigned[warehouse.id] || [];
              return (
                <div key={warehouse.id} style={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  width: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxSizing: 'border-box',
                }}>
                  <h3 style={{ margin: 0 }}>{warehouse.name}</h3>
                  <p style={{ margin: 0 }}><strong>Location:</strong> {warehouse.location}</p>
                  <p style={{ margin: 0 }}><strong>Status:</strong> {warehouse.status}</p>
                  <p style={{ margin: 0 }}>
                    <strong>Total Items:</strong> {totalQuantity}
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Product Name</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Category</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Code</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Quantity</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Unit</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Expiry Date</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>Reason</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px' }}>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.length > 0 ? (
                        filteredStock.map((s: Stock, idx: number) => (
                          <tr key={s.id || idx}>
                            <td style={{ padding: '4px' }}>{s.product}</td>
                            <td style={{ padding: '4px' }}>{s.category || "-"}</td>
                            <td style={{ padding: '4px' }}>{s.code}</td>
                            <td style={{ padding: '4px' }}>{s.quantity}</td>
                            <td style={{ padding: '4px' }}>{s.unit}</td>
                            <td style={{ padding: '4px' }}>{s.expiryDate}</td>
                            <td style={{ padding: '4px' }}>{s.reason}</td>
                            <td style={{ padding: '4px' }}>{s.By || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                          <td style={{ padding: '4px' }}>-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn secondary-btn" onClick={() => openStockModal("stockIn", warehouse.id)}>Stock In</button>
                    <button className="btn secondary-btn" onClick={() => openStockModal("stockOut", warehouse.id)}>Stock Out</button>
                    <button className="btn secondary-btn" onClick={() => openTransferModal(warehouse.id)}>Transfer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
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
                minWidth: "320px",
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
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
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
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
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
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Status:<br />
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleInputChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>
              {/* Total Items input removed */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button className="btn secondary-btn" onClick={handleCloseModal}>Cancel</button>
                <button className="btn primary-btn" onClick={handleSaveWarehouse}>Save</button>
              </div>
            </div>
          </div>
        )}

        {stockModal.type && stockModal.warehouseId !== null && (
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
                minWidth: "420px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                position: "relative",
              }}
            >
              <h2>{stockModal.type === "stockIn" ? "Stock In" : "Stock Out"}</h2>
              {/* Stock In Modal Fields */}
              {stockModal.type === "stockIn" ? (
                <>
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Product:<br />
                      <select
                        name="productId"
                        value={stockForm.productId}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      >
                        <option value="">Select product</option>
                        {products.map((p: Product) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {/* Code input for stock in */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Batch Code:<br />
                      <input
                        type="text"
                        name="code"
                        value={stockForm.code}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                        placeholder="Enter unique batch code"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Quantity:<br />
                      <input
                        type="number"
                        name="quantity"
                        min={1}
                        value={stockForm.quantity}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      />
                    </label>
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Expiry Date:<br />
                      <input
                        type="date"
                        name="expiryDate"
                        value={stockForm.expiryDate}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      />
                    </label>
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Reason:<br />
                      <select
                        name="reason"
                        value={stockForm.reason}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      >
                        <option value="">Select Reason</option>
                        <option value="New Supply">New Supply</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Return">Return</option>
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Stock Out Modal Fields */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Product:<br />
                      <select
                        name="productId"
                        value={stockForm.productId}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      >
                        <option value="">Select product</option>
                        {products.map((p: Product) => {
                          // Only show products available in this warehouse with quantity > 0
                          if (stockModal.warehouseId === null) return null;
                          const stockArr = warehouseStock[stockModal.warehouseId] || [];
                          if (
                            !stockArr.find(
                              (s: Stock) => s.product === p.name && s.quantity !== 0
                            )
                          ) {
                            return null;
                          }
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                  {/* Batch code dropdown */}
                  {stockForm.productId && (
                    <div style={{ marginBottom: "1rem" }}>
                      <label>
                        Batch (Code):<br />
                        <select
                          name="code"
                          value={stockForm.code}
                          onChange={handleStockFormChange}
                          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                        >
                          <option value="">Select batch</option>
                          {(warehouseStock[stockModal.warehouseId] || [])
                            .filter(s => {
                              const productObj = products.find(p => p.id === stockForm.productId);
                              return (
                                s.product === (productObj?.name ?? "") &&
                                s.quantity !== 0
                              );
                            })
                            .map((s, idx) => (
                              <option key={s.code + idx} value={s.code}>
                                {s.code} (Qty: {s.quantity}, Exp: {s.expiryDate})
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Quantity:<br />
                      <input
                        type="number"
                        name="quantity"
                        min={1}
                        value={stockForm.quantity}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                        disabled={!stockForm.code}
                      />
                    </label>
                    {stockForm.code && (
                      <div style={{ fontSize: "0.9em", marginTop: "0.2em", color: "#555" }}>
                        Available: {stockForm.availableQty} {stockForm.unit}
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label>
                      Reason:<br />
                      <select
                        name="reason"
                        value={stockForm.reason}
                        onChange={handleStockFormChange}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                      >
                        <option value="">Select Reason</option>
                        <option value="Spoil">Spoil</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Used">Used</option>
                        <option value="Delivery">Delivery</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button className="btn secondary-btn" onClick={closeStockModal}>Cancel</button>
                <button className="btn primary-btn" onClick={submitStock}>Submit</button>
              </div>
            </div>
          </div>
        )}

        {transferModal.fromWarehouseId !== null && (
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
                minWidth: "420px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                position: "relative",
              }}
            >
              <h2>Transfer Stock</h2>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  From Warehouse:<br />
                  <input
                    value={warehouses.find(w => w.id === transferModal.fromWarehouseId)?.name || ""}
                    disabled
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem", background: "#f2f2f2" }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  To Warehouse:<br />
                  <select
                    name="toWarehouseId"
                    value={transferForm.toWarehouseId ?? ""}
                    onChange={handleTransferFormChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.filter((w: WarehouseType) => w.id !== transferModal.fromWarehouseId).map((w: WarehouseType) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Product:<br />
                  <select
                    name="productId"
                    value={transferForm.productId}
                    onChange={handleTransferFormChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                  >
                    <option value="">Select product</option>
                    {products.map((p: Product) => {
                      // Only show products that exist in source warehouse with quantity > 0
                      if (transferModal.fromWarehouseId === null) return null;
                      const stockArr = warehouseStock[transferModal.fromWarehouseId] || [];
                      const prodStock = stockArr.find(
                        (s: Stock) => s.product === p.name && s.quantity !== 0
                      );
                      if (!prodStock) return null;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              {/* Batch code dropdown */}
              {transferForm.productId && (
                <div style={{ marginBottom: "1rem" }}>
                  <label>
                    Batch (Code):<br />
                    <select
                      name="batchCode"
                      value={transferSelectedBatch}
                      onChange={handleTransferFormChange}
                      style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                    >
                      <option value="">Select batch</option>
                      {transferBatchList
                        .filter(b => b.availableQty !== 0)
                        .map((b, idx) => (
                          <option key={b.code + idx} value={b.code}>
                            {b.code} (Qty: {b.availableQty}, Exp: {b.expiryDate})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Quantity:<br />
                  <input
                    type="number"
                    name="quantity"
                    min={1}
                    value={transferForm.quantity}
                    onChange={handleTransferFormChange}
                    style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                    disabled={!transferSelectedBatch}
                  />
                </label>
                {transferSelectedBatch && (
                  <div style={{ fontSize: "0.9em", marginTop: "0.2em", color: "#555" }}>
                    Available: {transferForm.availableQty} {transferForm.unit}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button className="btn secondary-btn" onClick={closeTransferModal}>Cancel</button>
                <button className="btn primary-btn" onClick={submitTransfer}>Submit</button>
              </div>
            </div>
          </div>
        )}

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