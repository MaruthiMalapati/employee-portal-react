import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{6,}$/;

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const targetPath = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async event => {
    event.preventDefault();
    setError("");

    const username = form.username.trim();
    const password = form.password;

    if (username.length < 3) {
      setError("Enter a valid username or email.");
      return;
    }

    if (!passwordRegex.test(password)) {
      setError("Password must include uppercase, lowercase, number, and 6+ characters.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      login({
        token: result.token,
        sessionId: result.sessionId,
        employee: {
          ...result.employee,
          username
        }
      });

      navigate(targetPath, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-left-panel">
          <div>
            <h2 className="mb-2">Welcome</h2>
            <p className="mb-0 text-white-50">Employee Login Portal</p>
          </div>
        </div>

        <div className="login-form-panel">
          <h3 className="login-title">Login</h3>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Username or Email</label>
              <input
                className="form-control"
                value={form.username}
                onChange={event => setForm(current => ({ ...current, username: event.target.value }))}
              />
            </div>

            <div className="mb-3 position-relative">
              <label className="form-label">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control pe-5"
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(current => !current)}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
              </button>
            </div>

            {error ? <div className="alert alert-danger py-2">{error}</div> : null}

            <button className="btn btn-brand w-100 mt-2" disabled={submitting}>
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
