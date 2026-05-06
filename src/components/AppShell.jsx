import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";
import { useState } from "react";

const navItems = [
  { to: "/dashboard/login-time", label: "Login Times", icon: "bi-stopwatch" },
  { to: "/dashboard/tasks", label: "Daily Tasks", icon: "bi-list-task" },
  { to: "/dashboard/upload-works", label: "Upload Works", icon: "bi-upload" },
  { to: "/dashboard/performance", label: "Performance", icon: "bi-bar-chart-line" },
  { to: "/dashboard/schedules", label: "Schedules", icon: "bi-calendar-week" },
  { to: "/dashboard/messages", label: "Messages", icon: "bi-chat-dots" },
  { to: "/dashboard/notifications", label: "Notifications", icon: "bi-bell" },
  { to: "/dashboard/dump-files", label: "Dump Files", icon: "bi-trash" },
  { to: "/dashboard/payroll", label: "PaySlips", icon: "bi-receipt" }
];

export default function AppShell() {
  const { token, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      if (token) {
        await apiRequest("/api/login/logout", withAuth(token, { method: "POST" }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      logout();
      navigate("/login");
    }
  };

  const initials = (user?.name || "EM")
    .split(" ")
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="dashboard-shell">
      <aside className={`portal-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="d-flex d-md-none justify-content-end mb-3">
          <button className="btn btn-outline-light btn-sm" onClick={() => setSidebarOpen(false)}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="avatar-pill">{initials}</div>
          <div>
            <div className="fw-semibold">{user?.name || "Employee"}</div>
            <div className="small text-white-50">{user?.role || "EMPLOYEE"}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <NavLink to="/dashboard/employees" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                <i className="bi bi-person-plus" />
                <span>Employees</span>
              </NavLink>
            </>
          ) : null}

          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className="sidebar-link"
              onClick={() => setSidebarOpen(false)}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="btn btn-outline-light rounded-pill mt-auto" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right me-2" />
          Log Out
        </button>
      </aside>

      {sidebarOpen ? <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} /> : null}

      <main className="portal-main">
        <div className="mobile-topbar">
          <div>
            <div className="fw-semibold">{user?.name || "Employee"}</div>
            <div className="small text-muted">{user?.role || "EMPLOYEE"}</div>
          </div>
          <button className="btn btn-primary rounded-pill px-3" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-list me-2" />
            Menu
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
