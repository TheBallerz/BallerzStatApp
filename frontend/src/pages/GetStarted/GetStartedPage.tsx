import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../services/authService';
import { saveFavorites } from '../../services/favoritesService';
import '../Login/loginPage.css';
import './getStartedPage.css';
import GetStartedStep2, { type SelectedItem } from './GetStartedStep2';
import GetStartedStep3 from './GetStartedStep3';

// Requires at least 8 characters, one uppercase letter, and one special character
const PASSWORD_RULES =
  /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function GetStartedPage() {
  const navigate = useNavigate();

  // Tracks which step of the 3-step account creation flow is active
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Steps 2 & 3 — selections held at page level so they persist across steps
  // and are submitted when the user presses the forward arrow to leave each step
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedItem[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<SelectedItem[]>([]);

  // Error message displayed in red below the form fields
  const [error, setError] = useState('');
  // Disables the next arrow while a request is in flight
  const [loading, setLoading] = useState(false);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (step === 1) navigate('/login');
    else if (step === 2) setStep(1);
    else setStep(2);
  };

  const handleNext = async () => {
    // ── Step 1: validate and register ────────────────────────────────────────
    if (step === 1) {
      setError('');

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        setError('All fields are required.');
        return;
      }
      if (!PASSWORD_RULES.test(password)) {
        setError(
          'Password must be at least 8 characters and include an uppercase letter and a special character.',
        );
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      try {
        setLoading(true);
        await register(firstName, lastName, email, password);
        // Advance to step 2 — do not navigate away yet
        setStep(2);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Registration failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Step 2: save favorite players then advance ────────────────────────────
    if (step === 2) {
      if (selectedPlayers.length > 0) {
        try {
          setLoading(true);
          await saveFavorites({
            favoritePlayers: selectedPlayers.map((p) => Number(p.id)),
          });
          console.log('[GetStarted] favorite players saved successfully');
        } catch (err) {
          console.error('[GetStarted] failed to save favorite players:', err);
        } finally {
          setLoading(false);
        }
      }
      setStep(3);
      return;
    }

    // ── Step 3: save favorite teams then finish ───────────────────────────────
    if (selectedTeams.length > 0) {
      try {
        setLoading(true);
        await saveFavorites({
          favoriteTeams: selectedTeams.map((t) => Number(t.id)),
        });
        console.log('[GetStarted] favorite teams saved successfully');
      } catch (err) {
        console.error('[GetStarted] failed to save favorite teams:', err);
      } finally {
        setLoading(false);
      }
    }
    navigate('/');
  };

  // Skip advances without making an API call; the favorites field in the DB
  // is left untouched (not overwritten with an empty array)
  const handleSkip = () => {
    if (step === 2) setStep(3);
    else navigate('/');
  };

  // ── Selection helpers ───────────────────────────────────────────────────────

  const addPlayer = (p: SelectedItem) =>
    setSelectedPlayers((prev) => [...prev, p]);
  const removePlayer = (id: string) =>
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== id));

  const addTeam = (t: SelectedItem) => setSelectedTeams((prev) => [...prev, t]);
  const removeTeam = (id: string) =>
    setSelectedTeams((prev) => prev.filter((t) => t.id !== id));

  // ── Render ──────────────────────────────────────────────────────────────────

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

        {/* ── Step 1: account info ───────────────────────────── */}
        {step === 1 && (
          <div className="gs-card">
            <h2 className="gs-card-title">
              Create Your Account <span className="gs-step-label">1/3</span>
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

            {error && <p className="gs-error">{error}</p>}
          </div>
        )}

        {/* ── Step 2: choose favorite players ────────────────── */}
        {step === 2 && (
          <GetStartedStep2
            selectedPlayers={selectedPlayers}
            onAdd={addPlayer}
            onRemove={removePlayer}
            onSkip={handleSkip}
          />
        )}

        {/* ── Step 3: choose favorite teams ──────────────────── */}
        {step === 3 && (
          <GetStartedStep3
            selectedTeams={selectedTeams}
            onAdd={addTeam}
            onRemove={removeTeam}
            onSkip={handleSkip}
          />
        )}

        <button
          className="gs-arrow gs-arrow--right"
          type="button"
          onClick={handleNext}
          disabled={loading}
          aria-label="Go to next step"
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}
