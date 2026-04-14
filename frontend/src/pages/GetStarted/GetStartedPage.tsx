import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../../services/authService";
import "../Login/loginPage.css";
import "./getStartedPage.css";
import GetStartedStep2 from "./GetStartedStep2";
import GetStartedStep3 from "./GetStartedStep3";

// Requires at least 8 characters, one uppercase letter, and one special character
const PASSWORD_RULES =
  /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function GetStartedPage() {
  const navigate = useNavigate();

  // Tracks which step of the 3-step account creation flow is active
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Error message displayed in red below the form fields
  const [error, setError] = useState("");
  // Disables the next arrow while the registration request is in flight
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (step === 1) navigate("/login");
    else if (step === 2) setStep(1);
    else setStep(2);
  };

  const handleNext = async () => {
    if (step === 1) {
      setError("");

      // Client-side validation before hitting the network
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        setError("All fields are required.");
        return;
      }

      if (!PASSWORD_RULES.test(password)) {
        setError(
          "Password must be at least 8 characters and include an uppercase letter and a special character."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      // Submit the registration request; on success navigate to the home page
      try {
        setLoading(true);
        await register(firstName, lastName, email, password);
        navigate("/");
      } catch (err: unknown) {
        // Display the error message returned by the backend (e.g. duplicate email)
        setError(err instanceof Error ? err.message : "Registration failed.");
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      setStep(3);
    } else {
      navigate("/");
    }
  };

  const handleSkip = () => {
    if (step === 2) setStep(3);
  };

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
          onClick={handleBack}
          aria-label="Go back"
        >
          ←
        </button>

        {/* Step 1: account info form */}
        {step === 1 ? (
          <div className="gs-card">
            <h2 className="gs-card-title">
              Create Your Account{" "}
              <span className="gs-step-label">1/3</span>
            </h2>

            <div className="gs-field">
              <label htmlFor="gs-firstName">First Name</label>
              <input
                id="gs-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>

            <div className="gs-field">
              <label htmlFor="gs-lastName">Last Name</label>
              <input
                id="gs-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>

            <div className="gs-field">
              <label htmlFor="gs-email">Email</label>
              <input
                id="gs-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="gs-field">
              <label htmlFor="gs-password">Password</label>
              <input
                id="gs-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="gs-field">
              <label htmlFor="gs-confirmPassword">Confirm Password</label>
              <input
                id="gs-confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* Validation and server errors are shown here in red */}
            {error && <p className="gs-error">{error}</p>}
          </div>
        ) : step === 2 ? (
          <GetStartedStep2 onSkip={handleSkip} />
        ) : (
          <GetStartedStep3 onSkip={() => {}} />
        )}

        {/* Arrow is disabled while the registration request is in flight */}
        <button
          className="gs-arrow gs-arrow--right"
          type="button"
          onClick={handleNext}
          disabled={loading}
          aria-label="Go to next step"
        >
          {loading ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}
