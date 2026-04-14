import { useNavigate } from "react-router-dom";
import { logout, getUser } from "../services/authService";
import "./placeholderPage.css";

export default function AccountPage() {
  const navigate = useNavigate();

  // Read the user object saved to localStorage at login/registration
  const user = getUser();

  const handleLogout = () => {
    // Clear the JWT and user object from localStorage before redirecting
    logout();
    navigate("/login");
  };

  return (
    <div className="placeholder-page">
      Account
      {/* Display the logged-in user's name and email if a session exists */}
      {user && (
        <div>
          <p>{user.firstName} {user.lastName}</p>
          <p>{user.email}</p>
        </div>
      )}
      <button className="logout-btn" type="button" onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}
