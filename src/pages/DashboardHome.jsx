import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth, withSessionAuth } from "../lib/api";
import "./DashboardHome.css";

function getTodayISTDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getCurrentMonth() {
  return getTodayISTDate().slice(0, 7);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
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

function formatHours(value) {
  return `${Number(value || 0).toFixed(2)} hrs`;
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("complete") || normalized.includes("present") || normalized.includes("ready")) return "success";
  if (normalized.includes("pending") || normalized.includes("late") || normalized.includes("lop")) return "warning";
  if (normalized.includes("not") || normalized.includes("absent") || normalized.includes("overdue")) return "danger";
  return "primary";
}

function getEmployeeAttendanceStatus(attendance, session, activeSession) {
  if (session?.login_time && !session?.logout_time) return attendance?.status || "Present";
  if (session?.logout_time && activeSession && activeSession.id !== session.id) return "Active on another device";
  if (activeSession?.login_time && !activeSession?.logout_time) return attendance?.status || "Present";
  if (session?.logout_time) return "Logged out";
  if (attendance?.status && attendance.status !== "Present") return attendance.status;
  if (attendance?.first_login_time) return "Logged out";
  return "No record";
}

export default function DashboardHome() {
  const { token, sessionId, user, isAdmin } = useAuth();
  const today = getTodayISTDate();
  const month = getCurrentMonth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [session, setSession] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [payrollRows, setPayrollRows] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, [isAdmin]);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      if (isAdmin) {
        const [employeeResult, attendanceResult, taskResult, payrollResult] = await Promise.allSettled([
          apiRequest("/api/admin/employees", withAuth(token)),
          apiRequest(`/api/login/admin-attendance-summary?date=${today}`, withAuth(token)),
          apiRequest(`/api/tasks/admin?date=${today}`, withAuth(token)),
          apiRequest(`/api/payroll/preview?month=${month}`, withAuth(token))
        ]);

        if (employeeResult.status === "fulfilled") setEmployees(employeeResult.value.data || []);
        if (attendanceResult.status === "fulfilled") setAttendanceSummary(attendanceResult.value.summary || null);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value.data || []);
        if (payrollResult.status === "fulfilled") setPayrollRows(payrollResult.value.data || []);
      } else {
        const [sessionResult, taskResult, payrollResult] = await Promise.allSettled([
          apiRequest("/api/login/employee-session-status", withSessionAuth(token, sessionId)),
          apiRequest(`/api/tasks/my?date=${today}`, withAuth(token)),
          apiRequest(`/api/payroll/my-history?month=${month}`, withAuth(token))
        ]);

        if (sessionResult.status === "fulfilled") {
          setSession(sessionResult.value.session || null);
          setActiveSession(sessionResult.value.activeSession || null);
          setAttendance(sessionResult.value.attendance || null);
        }
        if (taskResult.status === "fulfilled") setTasks(taskResult.value.data || []);
        if (payrollResult.status === "fulfilled") setPayrollRows(payrollResult.value.data || []);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const taskStats = useMemo(() => {
    const pending = tasks.filter(task => String(task.status).toLowerCase() === "pending").length;
    const completed = tasks.filter(task => String(task.status).toLowerCase() === "completed").length;
    return { pending, completed, total: tasks.length };
  }, [tasks]);

  const payrollTotal = payrollRows.reduce((sum, row) => sum + Number(row.payable_amount || 0), 0);
  const employeeAttendanceStatus = getEmployeeAttendanceStatus(attendance, session, activeSession);
  const heroStatus = isAdmin
    ? `${attendanceSummary?.presentToday || 0} present today • ${attendanceSummary?.notLoggedIn || 0} not logged in`
    : session?.login_time && !session?.logout_time
      ? `Logged in at ${formatTime(session.login_time)}`
      : employeeAttendanceStatus;

  const stats = isAdmin ? [
    { label: "Employees", value: employees.length, icon: "bi-people", tone: "primary" },
    { label: "Present Today", value: attendanceSummary?.presentToday || 0, icon: "bi-person-check", tone: "success" },
    { label: "Not Logged In", value: attendanceSummary?.notLoggedIn || 0, icon: "bi-person-dash", tone: "danger" },
    { label: "Pending Tasks", value: taskStats.pending, icon: "bi-list-check", tone: "warning" },
    { label: "Payroll Preview", value: formatCurrency(payrollTotal), icon: "bi-wallet2", tone: "primary" }
  ] : [
    { label: "Attendance", value: employeeAttendanceStatus, icon: "bi-stopwatch", tone: statusTone(employeeAttendanceStatus) },
    { label: "Login Time", value: formatTime(attendance?.first_login_time || session?.login_time), icon: "bi-box-arrow-in-right", tone: "primary" },
    { label: "Working Hours", value: formatHours(attendance?.working_hours), icon: "bi-clock-history", tone: "success" },
    { label: "Pending Tasks", value: taskStats.pending, icon: "bi-list-task", tone: "warning" },
    { label: "Payslip", value: payrollRows.length ? formatCurrency(payrollRows[0]?.payable_amount) : "Not ready", icon: "bi-receipt", tone: payrollRows.length ? "primary" : "warning" }
  ];

  const quickActions = isAdmin ? [
    { label: "Add Employee", to: "/dashboard/employees", icon: "bi-person-plus", text: "Create and manage employee accounts." },
    { label: "Attendance", to: "/dashboard/login-time", icon: "bi-stopwatch", text: "Monitor live login coverage." },
    { label: "Assign Tasks", to: "/dashboard/tasks", icon: "bi-list-task", text: "Review and assign daily work." },
    { label: "Payroll", to: "/dashboard/payroll", icon: "bi-receipt", text: "Preview and finalize payslips." }
  ] : [
    { label: "Upload Work", to: "/dashboard/upload-works", icon: "bi-upload", text: "Submit completed work files." },
    { label: "My Tasks", to: "/dashboard/tasks", icon: "bi-list-task", text: "Check today’s assignments." },
    { label: "Login Times", to: "/dashboard/login-time", icon: "bi-stopwatch", text: "Review attendance and hours." },
    { label: "Payslip", to: "/dashboard/payroll", icon: "bi-receipt", text: "View salary and LOP details." }
  ];

  const alerts = isAdmin ? [
    attendanceSummary?.notLoggedIn ? `${attendanceSummary.notLoggedIn} employee${attendanceSummary.notLoggedIn === 1 ? "" : "s"} have not logged in today.` : "All tracked employees have login coverage or no attendance issue yet.",
    taskStats.pending ? `${taskStats.pending} task${taskStats.pending === 1 ? "" : "s"} are still pending for today.` : "No pending task pressure for today.",
    attendanceSummary?.lateLogins ? `${attendanceSummary.lateLogins} late login${attendanceSummary.lateLogins === 1 ? "" : "s"} need review.` : "No late-login pattern detected in the current summary."
  ] : [
    session?.login_time && !session?.logout_time
      ? `Your live session started at ${formatTime(session.login_time)}.`
      : activeSession?.login_time && !activeSession?.logout_time
        ? "Another device is still logged in for today."
        : "You do not have a running session right now.",
    taskStats.pending ? `${taskStats.pending} task${taskStats.pending === 1 ? "" : "s"} still need your attention.` : "No pending tasks for today.",
    payrollRows.length ? `This month's payslip is available for ${formatCurrency(payrollRows[0]?.payable_amount)}.` : "This month's payslip is not finalized yet."
  ];

  return (
    <div className="page-stack dashboard-home">
      <section className="page-hero dashboard-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Employee Portal</div>
            <h2 className="page-hero-title">Welcome, {user?.name || "Employee"}</h2>
            <p className="page-hero-text">
              {isAdmin
                ? "A focused control room for people, attendance, tasks, and payroll readiness."
                : "Your workday overview with attendance, tasks, uploads, and payslip status in one place."}
            </p>
          </div>
          <div className="page-hero-actions">
            <span className="hero-badge">{heroStatus}</span>
            <button className="btn btn-outline-secondary btn-action-pill" onClick={loadDashboard}>
              <i className="bi bi-arrow-clockwise"></i>
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <section className="dashboard-stat-grid">
        {stats.map(item => (
          <article className={`dashboard-stat-card tone-${item.tone}`} key={item.label}>
            <div className="dashboard-stat-icon"><i className={`bi ${item.icon}`}></i></div>
            <div>
              <span>{item.label}</span>
              <strong>{loading ? "..." : item.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <div className="content-card dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h3 className="section-title mb-1">{isAdmin ? "Command Center" : "Today’s Work"}</h3>
              <p className="text-muted mb-0">{isAdmin ? "Jump straight into the admin workflows that matter today." : "Continue the workflows most likely to be needed now."}</p>
            </div>
          </div>
          <div className="dashboard-action-grid">
            {quickActions.map(action => (
              <Link to={action.to} className="dashboard-action-card" key={action.label}>
                <span><i className={`bi ${action.icon}`}></i></span>
                <div>
                  <strong>{action.label}</strong>
                  <p>{action.text}</p>
                </div>
                <i className="bi bi-arrow-right-short"></i>
              </Link>
            ))}
          </div>
        </div>

        <aside className="content-card dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h3 className="section-title mb-1">Attention</h3>
              <p className="text-muted mb-0">Signals worth checking before moving on.</p>
            </div>
          </div>
          <div className="dashboard-alert-list">
            {alerts.map((alert, index) => (
              <div className="dashboard-alert-item" key={alert}>
                <span>{index + 1}</span>
                <p>{alert}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-main-grid dashboard-main-grid-bottom">
        <div className="content-card dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h3 className="section-title mb-1">{isAdmin ? "Today’s Task Flow" : "My Task Flow"}</h3>
              <p className="text-muted mb-0">{taskStats.completed} completed, {taskStats.pending} pending, {taskStats.total} total.</p>
            </div>
            <Link to="/dashboard/tasks" className="btn btn-sm btn-outline-primary">Open Tasks</Link>
          </div>
          <div className="dashboard-progress-track">
            <span style={{ width: `${taskStats.total ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%` }}></span>
          </div>
          <div className="dashboard-mini-list">
            {tasks.slice(0, 4).map(task => (
              <article key={task.id || task.task_title}>
                <div>
                  <strong>{task.task_title || "Untitled task"}</strong>
                  <p>{task.employees?.name || task.task_date || today}</p>
                </div>
                <span className={`dashboard-status-pill tone-${statusTone(task.status)}`}>{task.status || "Pending"}</span>
              </article>
            ))}
            {!tasks.length ? <div className="empty-state">No tasks found for today.</div> : null}
          </div>
        </div>

        <div className="content-card dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h3 className="section-title mb-1">{isAdmin ? "Attendance Snapshot" : "Attendance & Payroll"}</h3>
              <p className="text-muted mb-0">{isAdmin ? "Live coverage and working-hours health." : "Your current status and latest payslip signal."}</p>
            </div>
            <Link to={isAdmin ? "/dashboard/login-time" : "/dashboard/payroll"} className="btn btn-sm btn-outline-primary">
              {isAdmin ? "Open Attendance" : "Open Payslip"}
            </Link>
          </div>
          <div className="dashboard-insight-grid">
            {isAdmin ? (
              <>
                <div><span>Active Now</span><strong>{attendanceSummary?.activeNow || 0}</strong></div>
                <div><span>Logged Out</span><strong>{attendanceSummary?.loggedOut || 0}</strong></div>
                <div><span>Late Logins</span><strong>{attendanceSummary?.lateLogins || 0}</strong></div>
                <div><span>Avg Hours</span><strong>{formatHours(attendanceSummary?.averageWorkingHours)}</strong></div>
              </>
            ) : (
              <>
                <div><span>Status</span><strong>{attendance?.status || (session?.login_time ? "Present" : "No record")}</strong></div>
                <div><span>Login</span><strong>{formatTime(attendance?.first_login_time || session?.login_time)}</strong></div>
                <div><span>Hours</span><strong>{formatHours(attendance?.working_hours)}</strong></div>
                <div><span>Payslip</span><strong>{payrollRows.length ? formatCurrency(payrollRows[0]?.payable_amount) : "Pending"}</strong></div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
