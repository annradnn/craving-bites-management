import Logo from "../assets/LOGO.png";
import "./Login.css";
import { auth, provider, db } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (!user.email) return;

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", user.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        console.log("Logged-in user data:", data);
        const role = String(data.role).toLowerCase();
        if (role === "admin" || role === "staff") {
          localStorage.setItem("role", role);
          localStorage.setItem("name", data.name);
          navigate("/inventory");
        } else {
          alert("You do not have permission to access this system");
        }
      } else {
        alert("User not found");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-inner">
        <img src={Logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">Craving Bites</h1>
        <p className="login-subtitle">Inventory Management System</p>
        <button
          onClick={handleGoogleLogin}
          className="login-button"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}