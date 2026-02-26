import { useNavigate } from "react-router-dom";
import "./placeholderPage.css";

export default function AccountPage() {
  const navigate = useNavigate();

  return (
    <div className="placeholder-page">
      Account
      <button
        className="logout-btn"
        type="button"
        onClick={() => navigate("/login")}
      >
        Log Out
      </button>
    </div>
  );
}
