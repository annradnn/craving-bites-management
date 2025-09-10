import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Inventory from "./pages/Inventory";
import Product from "./pages/Product";
import Warehouse from "./pages/Warehouse";
import Settings from "./pages/Settings";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/product" element={<Product />} />
        <Route path="/warehouse" element={<Warehouse />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);