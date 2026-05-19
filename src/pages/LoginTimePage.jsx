import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth, withSessionAuth } from "../lib/api";
import "./LoginTimePage.css";

const AUTO_LOGOUT_LABEL = "6:30 PM IST";

function getTodayISTDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      })
    : "--:--";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatHours(value) {
  return `${Number(value || 0).toFixed(2)} hrs`;
}

function getCurrentSessionLogoutValue(session) {
  return session?.logout_time ? formatTime(session.logout_time) : "--:--";
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("present")) return "success";
  if (normalized.includes("late")) return "warning";
  if (normalized.includes("logged out")) return "primary";
  if (normalized.includes("not") || normalized.includes("absent") || normalized.includes("no record")) return "danger";
  return "muted";
}

function getDisplayStatus(attendance, session, activeSession) {
  if (session?.login_time && !session?.logout_time) return attendance?.status || "Present";
  if (session?.logout_time && activeSession && activeSession.id !== session.id) return "Active on another device";
  if (activeSession?.login_time && !activeSession?.logout_time) return attendance?.status || "Present";
  if (session?.logout_time) return "Logged out";
  if (attendance?.status && attendance.status !== "Present") return attendance.status;
  if (attendance?.first_login_time) return "Logged out";
  return "No record";
}

function getLiveSessionHours(session, now) {
  if (!session?.login_time || session?.logout_time) return null;
  const diffMs = now.getTime() - new Date(session.login_time).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

export default function LoginTimePage() {
  const { token, sessionId, isAdmin, user } = useAuth();
  const [session, setSession] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [adminDate, setAdminDate] = useState(getTodayISTDate());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("Loading attendance status...");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (isAdmin) {
      loadAdminAttendance();
    } else {
      loadSession();
    }
  }, [isAdmin, adminDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSession = async () => {
    try {
      const result = await apiRequest("/api/login/employee-session-status", withSessionAuth(token, sessionId));
      setSession(result.session || null);
      setActiveSession(result.activeSession || null);
      setAttendance(result.attendance || null);
      setTodaySessions(result.todaySessions || []);
      setRecentAttendance(result.recentAttendance || []);
      setMessage("");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to load session status.");
    }
  };

  const loadAdminAttendance = async () => {
    try {
      const result = await apiRequest(`/api/login/admin-attendance-summary?date=${adminDate}`, withAuth(token));
      setAdminRows(result.data || []);
      setAdminSummary(result.summary || null);
      setMessage("");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to load attendance summary.");
    }
  };

  const logout = async () => {
    setMessage("Logging out...");
    try {
      await apiRequest("/api/login/logout", withSessionAuth(token, sessionId, { method: "POST" }));
      await loadSession();
      setMessage("Logout successful. Working hours updated.");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to logout.");
    }
  };

  const filteredAdminRows = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return adminRows.filter(row => {
      const matchesSearch = !search || [
        row.employee_name,
        row.employee_code,
        row.employee_email,
        row.employee_role
      ].join(" ").toLowerCase().includes(search);
      const matchesStatus = !statusFilter || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [adminRows, employeeSearch, statusFilter]);

  const liveSessionHours = getLiveSessionHours(session, now);
  const displayStatus = getDisplayStatus(attendance, session, activeSession);
  const statusTone = getStatusTone(displayStatus);
  const currentSessionLogoutValue = getCurrentSessionLogoutValue(session);
  const timelineItems = [
    { label: "Login", value: formatTime(attendance?.first_login_time || session?.login_time), active: Boolean(attendance?.first_login_time || session?.login_time) },
    {
      label: "Current Session",
      value: liveSessionHours === null
        ? (activeSession?.login_time && !activeSession?.logout_time ? "Running elsewhere" : "Completed")
        : "Running",
      active: Boolean(session?.login_time && !session?.logout_time) || Boolean(activeSession?.login_time && !activeSession?.logout_time)
    },
    { label: "Logout", value: currentSessionLogoutValue, active: Boolean(session?.logout_time) },
    { label: "Auto Logout", value: AUTO_LOGOUT_LABEL, active: true }
  ];

  const exportAttendance = () => {
    const headers = ["Employee", "Code", "Role", "Status", "Login Time", "Logout Time", "Working Hours", "Sessions"];
    const rows = filteredAdminRows.map(row => [
      row.employee_name,
      row.employee_code || "",
      row.employee_role || "",
      row.status,
      formatTime(row.first_login_time),
      formatTime(row.last_logout_time),
      row.working_hours || "0.00",
      row.session_count || 0
    ]);
    const csv = [headers, ...rows]
      .map(columns => columns.map(value => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${adminDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack login-time-page">
      <section className="page-hero login-time-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Attendance Timeline</div>
            <h2 className="page-hero-title">{isAdmin ? "Attendance Monitor" : "Login & Logout Time"}</h2>
            <p className="page-hero-text">
              {isAdmin
                ? "Review today's login coverage, late arrivals, active sessions, and working-hours totals."
                : "Track today's session, confirm attendance status, and refresh your working-hours summary instantly."}
            </p>
          </div>
          <div className="page-hero-actions">
            {isAdmin ? (
              <>
                <button className="btn btn-brand btn-action-pill" onClick={loadAdminAttendance}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Refresh Attendance
                </button>
                <button className="btn btn-outline-secondary btn-action-pill" onClick={exportAttendance}>
                  <i className="bi bi-download me-1"></i> Export CSV
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-brand btn-action-pill" onClick={logout}>
                  <i className="bi bi-box-arrow-right me-1"></i> Logout
                </button>
                <button className="btn btn-outline-secondary btn-action-pill" onClick={loadSession}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <>
          <div className="content-card">
            {message ? <div className="alert alert-light border">{message}</div> : null}
            <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap mb-3">
              <div>
                <h2 className="section-title mb-1">Today&apos;s Attendance Overview</h2>
                <p className="text-muted mb-0">Admin view only. Employee logout actions are not shown here.</p>
              </div>
              <div className="login-filter-control">
                <label className="form-label">Attendance Date</label>
                <input type="date" className="form-control" value={adminDate} onChange={event => setAdminDate(event.target.value)} />
              </div>
            </div>

            <div className="stats-grid login-admin-stats">
              <div className="stat-box stat-box-emphasis"><div className="stat-label">Total Employees</div><div className="stat-value">{adminSummary?.totalEmployees || 0}</div></div>
              <div className="stat-box stat-box-positive"><div className="stat-label">Present Today</div><div className="stat-value text-success">{adminSummary?.presentToday || 0}</div></div>
              <div className="stat-box"><div className="stat-label">Active Now</div><div className="stat-value">{adminSummary?.activeNow || 0}</div></div>
              <div className="stat-box stat-box-danger"><div className="stat-label">Not Logged In</div><div className="stat-value text-danger">{adminSummary?.notLoggedIn || 0}</div></div>
              <div className="stat-box"><div className="stat-label">Avg Working Hours</div><div className="stat-value">{formatHours(adminSummary?.averageWorkingHours)}</div></div>
            </div>
          </div>

          <div className="content-card">
            <div className="login-filter-grid mb-3">
              <div>
                <label className="form-label">Search Employee</label>
                <input
                  className="form-control"
                  placeholder="Name, code, email, or role"
                  value={employeeSearch}
                  onChange={event => setEmployeeSearch(event.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Logged out">Logged out</option>
                  <option value="Not logged in">Not logged in</option>
                </select>
              </div>
            </div>

            <div className="table-responsive login-table-shell d-none d-lg-block">
              <table className="table login-table align-middle">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Login Time</th>
                    <th>Logout Time</th>
                    <th>Working Hours</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdminRows.length ? filteredAdminRows.map(row => (
                    <tr key={row.employee_id}>
                      <td>
                        <div className="fw-semibold">{row.employee_name}</div>
                        <div className="small text-muted">{row.employee_code || row.employee_email}</div>
                      </td>
                      <td>{row.employee_role || "Employee"}</td>
                      <td><span className={`login-status-badge tone-${getStatusTone(row.status)}`}>{row.status}</span></td>
                      <td>{formatTime(row.first_login_time)}</td>
                      <td>{formatTime(row.last_logout_time)}</td>
                      <td>{row.active_session ? "Live session" : formatHours(row.working_hours)}</td>
                      <td>{row.session_count || 0}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="text-center text-muted py-4">No attendance rows found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="login-mobile-list d-lg-none">
              {filteredAdminRows.length ? filteredAdminRows.map(row => (
                <article className="login-mobile-card" key={`${row.employee_id}-mobile`}>
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <h3>{row.employee_name}</h3>
                      <p>{row.employee_code || row.employee_role || "Employee"}</p>
                    </div>
                    <span className={`login-status-badge tone-${getStatusTone(row.status)}`}>{row.status}</span>
                  </div>
                  <div className="login-mobile-metrics">
                    <div><span>Login</span><strong>{formatTime(row.first_login_time)}</strong></div>
                    <div><span>Logout</span><strong>{formatTime(row.last_logout_time)}</strong></div>
                    <div><span>Hours</span><strong>{row.active_session ? "Live" : formatHours(row.working_hours)}</strong></div>
                    <div><span>Sessions</span><strong>{row.session_count || 0}</strong></div>
                  </div>
                </article>
              )) : <div className="empty-state">No attendance rows found.</div>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="content-card">
            <div className={`login-session-alert tone-${statusTone}`}>
              <div className="login-session-icon">
                <i className={`bi ${session?.login_time ? "bi-stopwatch" : "bi-info-circle"}`}></i>
              </div>
              <div>
                <div className="fw-semibold">
                  {session?.logout_time
                    ? `Logged out at ${formatTime(session.logout_time)} (${session.logout_type || "manual"})`
                    : session?.login_time
                      ? `Logged in at ${formatTime(session.login_time)}`
                      : "No login record found for today"}
                </div>
                <p className="mb-0">
                  {session?.login_time && !session?.logout_time
                    ? `Live session running. Auto logout is set for ${AUTO_LOGOUT_LABEL}.`
                    : "Your attendance status will update after login or logout activity is recorded."}
                </p>
              </div>
            </div>

            <div className="stats-grid login-employee-stats">
              <div className="stat-box"><div className="stat-label">Login Time</div><div className="stat-value">{formatTime(attendance?.first_login_time || session?.login_time)}</div></div>
              <div className="stat-box"><div className="stat-label">Logout Time</div><div className="stat-value">{currentSessionLogoutValue}</div></div>
              <div className="stat-box"><div className="stat-label">Working Hours</div><div className="stat-value">{liveSessionHours === null ? formatHours(attendance?.working_hours) : `${liveSessionHours.toFixed(2)} hrs`}</div></div>
              <div className={`stat-box login-status-card tone-${statusTone}`}><div className="stat-label">Status</div><div className="stat-value">{displayStatus}</div></div>
            </div>

            {message ? <div className="text-muted mt-3">{message}</div> : null}
          </div>

          <div className="login-employee-grid">
            <section className="content-card">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="section-title mb-1">Current Session Timeline</h2>
                  <p className="text-muted mb-0">Live status for {user?.name || "your account"}.</p>
                </div>
                <span className={`login-status-badge tone-${statusTone}`}>{displayStatus}</span>
              </div>
              <div className="login-timeline">
                {timelineItems.map(item => (
                  <div className={`login-timeline-item ${item.active ? "active" : ""}`} key={item.label}>
                    <span className="login-timeline-dot"></span>
                    <div className="login-timeline-copy">
                      <strong>{item.label}</strong>
                      <p>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-card">
              <h2 className="section-title mb-1">Weekly Working Hours</h2>
              <p className="text-muted mb-3">Recent attendance records from your account.</p>
              <div className="login-history-list">
                {recentAttendance.length ? recentAttendance.map(row => (
                  <article className="login-history-card" key={row.attendance_date}>
                    <div>
                      <h3>{formatDate(row.attendance_date)}</h3>
                      <p>{row.status || "No record"}</p>
                    </div>
                    <strong>{formatHours(row.working_hours)}</strong>
                  </article>
                )) : <div className="empty-state">No recent attendance history found.</div>}
              </div>
            </section>
          </div>

          <section className="content-card">
            <h2 className="section-title mb-1">Today&apos;s Login & Logout History</h2>
            <p className="text-muted mb-3">Each login session recorded for today.</p>
            <div className="login-day-session-list">
              {todaySessions.length ? todaySessions.map((entry, index) => (
                <article className="login-day-session-card" key={entry.id || `${entry.login_time}-${index}`}>
                  <div className="login-day-session-head">
                    <strong>Session {todaySessions.length - index}</strong>
                    <span className={`login-status-badge tone-${entry.logout_time ? "primary" : "success"}`}>
                      {entry.logout_time ? (entry.logout_type === "auto" ? "Auto logged out" : "Logged out") : "Active"}
                    </span>
                  </div>
                  <div className="login-day-session-metrics">
                    <div><span>Login</span><strong>{formatTime(entry.login_time)}</strong></div>
                    <div><span>Logout</span><strong>{entry.logout_time ? formatTime(entry.logout_time) : "--:--"}</strong></div>
                  </div>
                </article>
              )) : <div className="empty-state">No login or logout history recorded for today.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
