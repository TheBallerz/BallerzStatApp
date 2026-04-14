import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./loginPage.css";
import "../GetStarted/getStartedPage.css";

export default function LoginFormPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="gs-page">
      <div className="login-glow" />

      <header className="gs-header">
        <p className="login-welcome">Welcome To</p>
        <h1 className="login-title">Ballerz</h1>
      </header>

      <div className="gs-content">
        <button
          className="gs-arrow gs-arrow--left"
          type="button"
          onClick={() => navigate("/login")}
          aria-label="Go back"
        >
          ←
        </button>

        <div className="gs-card">
          <h2 className="gs-card-title">Input your account information</h2>

          <div className="gs-field">
            <label htmlFor="lf-username">Username</label>
            <input
              id="lf-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="gs-field">
            <label htmlFor="lf-password">Password</label>
            <input
              id="lf-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          className="gs-arrow gs-arrow--right"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Log in"
        >
          →
        </button>
      </div>
    </div>
  );
}
