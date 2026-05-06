import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";

export default function LoginTimePage() {
  const { token } = useAuth();
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [message, setMessage] = useState("Loading session status...");

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const result = await apiRequest("/api/login/employee-session-status", withAuth(token));
      setSession(result.session || null);
      setAttendance(result.attendance || null);
      setMessage("");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to load session status.");
    }
  };

  const logout = async () => {
    setMessage("Logging out...");
    try {
      await apiRequest("/api/login/logout", withAuth(token, { method: "POST" }));
      await loadSession();
      setMessage("Logout successful. Working hours updated.");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to logout.");
    }
  };

  const formatTime = value =>
    value
      ? new Date(value).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      : "--:--";

  return (
    <div className="page-grid">
      <div className="content-card">
        <h2 className="section-title mb-3">Login & Logout Time</h2>
        <div className="alert alert-light border">
          {session?.logout_time
            ? `Logged out at ${formatTime(session.logout_time)} (${session.logout_type || "manual"})`
            : session?.login_time
              ? `Logged in at ${formatTime(session.login_time)}. Auto logout is set for 6:30 PM IST.`
              : "No login record found for today."}
        </div>

        <div className="stats-grid mt-4">
          <div className="stat-box">
            <div className="stat-label">Login Time</div>
            <div className="stat-value">{formatTime(attendance?.first_login_time)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Logout Time</div>
            <div className="stat-value">{formatTime(attendance?.last_logout_time)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Working Hours</div>
            <div className="stat-value">{attendance?.working_hours || "0.00"} hrs</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Status</div>
            <div className="stat-value">{attendance?.status || "—"}</div>
          </div>
        </div>

        <div className="mt-4 d-flex gap-2">
          <button className="btn btn-brand" onClick={logout}>Logout</button>
          <button className="btn btn-outline-primary" onClick={loadSession}>Refresh</button>
        </div>

        {message ? <div className="text-muted mt-3">{message}</div> : null}
      </div>
    </div>
  );
}
