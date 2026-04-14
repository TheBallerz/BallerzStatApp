import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Login/loginPage.css";
import "./getStartedPage.css";
import GetStartedStep2 from "./GetStartedStep2";
import GetStartedStep3 from "./GetStartedStep3";

export default function GetStartedPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleBack = () => {
    if (step === 1) navigate("/login");
    else if (step === 2) setStep(1);
    else setStep(2);
  };
  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else navigate("/");
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
          </div>
        ) : step === 2 ? (
          <GetStartedStep2 onSkip={handleSkip} />
        ) : (
          <GetStartedStep3 onSkip={() => {}} />
        )}

        <button
          className="gs-arrow gs-arrow--right"
          type="button"
          onClick={handleNext}
          aria-label="Go to next step"
        >
          →
        </button>
      </div>
    </div>
  );
}
