import { useAuth } from "../context/AuthContext";

export default function DashboardHome() {
  const { user } = useAuth();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Employee Portal</div>
            <h2 className="page-hero-title">Welcome, {user?.name || "Employee"}</h2>
            <p className="page-hero-text">
              Manage tasks, people, payroll, and attendance from one place with a cleaner and more focused workspace.
            </p>
          </div>
        </div>
      </section>

      <section className="content-card content-card-center">
        <div className="text-center">
          <h3 className="section-title mb-3">Everything you need is ready in the sidebar</h3>
          <p className="text-muted mb-0">
            Jump into daily work, review employee records, or track attendance and payroll without leaving the dashboard.
          </p>
        </div>
      </section>
    </div>
  );
}
