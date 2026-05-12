import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/authService';
import './loginPage.css';
import '../GetStarted/getStartedPage.css';

export default function LoginFormPage() {
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Error message displayed in red below the form fields
  const [error, setError] = useState('');
  // Disables the login arrow while the request is in flight
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    // Client-side validation before hitting the network
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    // Submit credentials; on success navigate to the home page
    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      // Display the error message returned by the backend (e.g. invalid credentials)
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
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
          onClick={() => navigate('/login')}
          aria-label="Go back"
        >
          ←
        </button>

        <div className="gs-card">
          <h2 className="gs-card-title">Input your account information</h2>

          <div className="gs-field">
            <label htmlFor="lf-email">Email</label>
            <input
              id="lf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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

          {/* Validation and server errors are shown here in red */}
          {error && <p className="gs-error">{error}</p>}
        </div>

        {/* Arrow is disabled while the login request is in flight */}
        <button
          className="gs-arrow gs-arrow--right"
          type="button"
          onClick={handleLogin}
          disabled={loading}
          aria-label="Log in"
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}
