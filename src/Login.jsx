import React, { useState } from "react";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please enter your SCADA Supervisor Badge ID or Username.");
      return;
    }

    if (!password) {
      setError("Please enter your Security Passcode.");
      return;
    }

    if (password.length < 4) {
      setError("Passcode must be at least 4 characters long.");
      return;
    }

    // Demo authentication check
    if (
      (username.toLowerCase() === "operator" || username.toLowerCase() === "admin" || username.toLowerCase() === "sup-8842") &&
      (password === "scada2026" || password === "admin123" || password === "password")
    ) {
      const session = {
        username: username.toUpperCase(),
        role: "Senior SCADA Operator",
        badgeId: "SUP-8842",
        site: "Substation Alpha",
        authenticatedAt: new Date().toISOString(),
      };
      if (rememberMe) {
        try {
          localStorage.setItem("vitalsgrid_session", JSON.stringify(session));
        } catch (e) {}
      }
      onLoginSuccess(session);
    } else {
      setError("Invalid credentials. Use Quick Demo Login or enter operator / scada2026.");
    }
  };

  const handleQuickDemo = () => {
    setUsername("operator");
    setPassword("scada2026");
    setError("");
    const session = {
      username: "OPERATOR",
      role: "Senior SCADA Operator",
      badgeId: "SUP-8842",
      site: "Substation Alpha",
      authenticatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("vitalsgrid_session", JSON.stringify(session));
    } catch (e) {}
    onLoginSuccess(session);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-mark large">V</div>
          <h2>VitalsGrid Control Hub</h2>
          <span className="eyebrow">Air-Gapped Intranet Authentication</span>
          <p>Enterprise 50 Hz Power Grid Worker Safety & SCADA Surveillance System</p>
        </div>

        {error && <div className="login-error-alert" role="alert">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Supervisor Badge ID / Username</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. operator or SUP-8842"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Security Passcode</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember SCADA Workstation Session</span>
            </label>
          </div>

          <button type="submit" className="login-submit-btn">
            🔓 Sign In to SCADA Console
          </button>
        </form>

        <div className="login-divider"><span>OR</span></div>

        <button type="button" className="quick-demo-btn" onClick={handleQuickDemo}>
          ⚡ 1-Click Quick Demo Sign In (operator / scada2026)
        </button>

        <div className="login-footer-meta">
          <span>IEC 62443 Security Compliant</span>
          <span>Zero Cloud WAN IP Binding</span>
        </div>
      </div>
    </div>
  );
}
