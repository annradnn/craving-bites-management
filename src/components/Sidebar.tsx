import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import "./Sidebar.css";
import Logo from "../assets/LOGO.png";

export default function Sidebar() {
  const [userName, setUserName] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserName = async () => {
      if (auth.currentUser?.email) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", auth.currentUser.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setUserName(data.name || "");
        }
      }
    };
    fetchUserName();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      // Optionally handle error
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="sidebar-wrapper">
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        ☰
      </button>
      {isOpen && (
        <div className="sidebar-container">
          <img src={Logo} alt="Logo" className="sidebar-logo" />
          <p className="sidebar-welcome">Welcome, {userName} 🍦</p>
          <Link to="/Inventory" className="sidebar-button">Inventory</Link>
          <Link to="/Product" className="sidebar-button">Products</Link>
          <Link to="/Warehouse" className="sidebar-button">Warehouses</Link>
          <Link to="/Settings" className="sidebar-button">Settings</Link>
          <button className="sidebar-button" onClick={handleLogout}>Sign Out</button>
        </div>
      )}
    </div>
  );
}