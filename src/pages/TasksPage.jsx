import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";

export default function TasksPage() {
  const { token, isAdmin } = useAuth();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ date: "", status: "", employeeId: "" });
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    task_date: today,
    employee_id: "",
    task_title: "",
    task_description: "",
    status: "Pending"
  });

  useEffect(() => {
    if (isAdmin) {
      loadEmployees();
    }
  }, [isAdmin]);

  useEffect(() => {
    loadTasks();
  }, [filters.date, filters.status, filters.employeeId, isAdmin]);

  const loadEmployees = async () => {
    try {
      const result = await apiRequest("/api/admin/employees", withAuth(token));
      setEmployees(result.data || []);
    } catch (requestError) {
      console.error(requestError);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    setError("");

    try {
      let path = "";
      if (isAdmin) {
        const params = new URLSearchParams();
        if (filters.date) params.set("date", filters.date);
        if (filters.status) params.set("status", filters.status);
        if (filters.employeeId) params.set("employee_id", filters.employeeId);
        path = `/api/tasks/admin${params.toString() ? `?${params.toString()}` : ""}`;
      } else {
        path = `/api/tasks/my${filters.date ? `?date=${encodeURIComponent(filters.date)}` : ""}`;
      }

      const result = await apiRequest(path, withAuth(token));
      const rows = !isAdmin && filters.status
        ? (result.data || []).filter(task => task.status === filters.status)
        : (result.data || []);
      setTasks(rows);
    } catch (requestError) {
      setError(requestError.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingId("");
    setForm({
      task_date: today,
      employee_id: "",
      task_title: "",
      task_description: "",
      status: "Pending"
    });
    setFormVisible(true);
  };

  const openEditForm = task => {
    setEditingId(task.id);
    setForm({
      task_date: task.task_date,
      employee_id: task.employees?.id || "",
      task_title: task.task_title,
      task_description: task.task_description || "",
      status: task.status
    });
    setFormVisible(true);
  };

  const closeForm = () => {
    setEditingId("");
    setFormVisible(false);
  };

  const submitForm = async event => {
    event.preventDefault();

    if (!form.task_title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (isAdmin && !editingId && !form.employee_id) {
      setError("Please select an employee.");
      return;
    }

    const payload = {
      task_date: form.task_date,
      task_title: form.task_title.trim(),
      task_description: form.task_description.trim(),
      status: form.status
    };

    if (isAdmin && form.employee_id) {
      payload.employee_id = form.employee_id;
    }

    try {
      if (editingId) {
        await apiRequest(`/api/tasks/${editingId}`, withAuth(token, {
          method: "PUT",
          body: JSON.stringify(payload)
        }));
      } else {
        await apiRequest("/api/tasks", withAuth(token, {
          method: "POST",
          body: JSON.stringify(payload)
        }));
      }

      closeForm();
      await loadTasks();
    } catch (requestError) {
      setError(requestError.message || "Unable to save task.");
    }
  };

  return (
    <div className={!formVisible ? "page-grid-task-creation" : "page-grid"}>
      <div className="content-card">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 className="section-title mb-1">{isAdmin ? "Team Task List" : "My Tasks"}</h2>
            <p className="text-muted mb-0">
              All tasks are shown by default. Use filters only when you want a narrower view.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-brand" onClick={openCreateForm}>Create Task</button>
            <span className="badge rounded-pill text-bg-light border px-3 py-2">{tasks.length} tasks</span>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label">View Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.date}
              onChange={event => setFilters(current => ({ ...current, date: event.target.value }))}
            />
            <button
              className="btn btn-outline-secondary btn-sm rounded-pill mt-2"
              onClick={() => setFilters(current => ({ ...current, date: "" }))}
            >
              Show All
            </button>
          </div>
          {isAdmin ? (
            <div className="col-md-4">
              <label className="form-label">Employee</label>
              <select
                className="form-select"
                value={filters.employeeId}
                onChange={event => setFilters(current => ({ ...current, employeeId: event.target.value }))}
              >
                <option value="">All Employees</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.employee_code ? ` (${employee.employee_code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col-md-4">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}

        {loading ? (
          <div className="text-muted">Loading tasks...</div>
        ) : tasks.length ? (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  {isAdmin ? <th>Employee</th> : null}
                  <th>Date</th>
                  <th>Task</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    {isAdmin ? (
                      <td>
                        {task.employees?.name || "Unknown"}
                        {task.employees?.employee_code ? ` (${task.employees.employee_code})` : ""}
                      </td>
                    ) : null}
                    <td>{new Date(`${task.task_date}T00:00:00`).toLocaleDateString("en-IN")}</td>
                    <td>{task.task_title}</td>
                    <td>{task.task_description || "—"}</td>
                    <td><span className="badge text-bg-light border">{task.status}</span></td>
                    <td>{new Date(task.updated_at || task.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openEditForm(task)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No tasks found for this selection.</div>
        )}
      </div>

      {formVisible ? (
        <div className="content-card sticky-card">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="section-title mb-0">{editingId ? "Update Task" : "Create Task"}</h2>
            <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={closeForm}>
              Cancel
            </button>
          </div>

          <form onSubmit={submitForm}>
            <div className="mb-3">
              <label className="form-label">Task Date</label>
              <input
                type="date"
                className="form-control"
                value={form.task_date}
                onChange={event => setForm(current => ({ ...current, task_date: event.target.value }))}
              />
            </div>

            {isAdmin ? (
              <div className="mb-3">
                <label className="form-label">Employee</label>
                <select
                  className="form-select"
                  value={form.employee_id}
                  onChange={event => setForm(current => ({ ...current, employee_id: event.target.value }))}
                >
                  <option value="">Select Employee</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}{employee.employee_code ? ` (${employee.employee_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="mb-3">
              <label className="form-label">Task Title</label>
              <input
                className="form-control"
                value={form.task_title}
                onChange={event => setForm(current => ({ ...current, task_title: event.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Task Description</label>
              <textarea
                className="form-control"
                rows="5"
                value={form.task_description}
                onChange={event => setForm(current => ({ ...current, task_description: event.target.value }))}
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>

            <button className="btn btn-brand w-100">{editingId ? "Update Task" : "Save Task"}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
