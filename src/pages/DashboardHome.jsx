import { useAuth } from "../context/AuthContext";

export default function DashboardHome() {
  const { user } = useAuth();

  return (
    <section className="content-card content-card-center">
      <div className="text-center">
        <h2 className="mb-3">Welcome, {user?.name || "Employee"}</h2>
        <p className="text-muted mb-0">
          Use the sidebar to manage tasks, employees, payroll, and attendance from one place.
        </p>
      </div>
    </section>
  );
}
