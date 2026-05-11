import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";

const initialCreateForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  manager_email: "",
  role: "EMPLOYEE"
};

export default function EmployeesPage() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const visibleEmployees = employees.filter(employee => {
    if (statusFilter === "all") return true;
    if (statusFilter === "disabled") return !employee.is_active;
    return employee.is_active;
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const result = await apiRequest("/api/admin/employees", withAuth(token));
      setEmployees(result.data || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load employees.");
    }
  };

  const submitCreate = async event => {
    event.preventDefault();
    setError("");

    try {
      await apiRequest("/api/admin/create-employee", withAuth(token, {
        method: "POST",
        body: JSON.stringify(createForm)
      }));
      setCreateForm(initialCreateForm);
      setFormVisible(false);
      await loadEmployees();
    } catch (requestError) {
      setError(requestError.message || "Unable to create employee.");
    }
  };

  const submitUpdate = async event => {
    event.preventDefault();
    if (!editing) return;

    const payload = {
      id: editing.id,
      name: editing.name,
      email: editing.email,
      role: editing.role,
      is_active: editing.is_active
    };

    if (editing.password) {
      payload.password = editing.password;
    }

    try {
      await apiRequest("/api/admin/update-employee", withAuth(token, {
        method: "POST",
        body: JSON.stringify(payload)
      }));
      setEditing(null);
      setFormVisible(false);
      await loadEmployees();
    } catch (requestError) {
      setError(requestError.message || "Unable to update employee.");
    }
  };

  const disableEmployee = async employee => {
    if (!window.confirm(`Disable ${employee.name}? They will not be able to log in.`)) return;

    try {
      await apiRequest("/api/admin/update-employee", withAuth(token, {
        method: "POST",
        body: JSON.stringify({
          id: employee.id,
          is_active: false
        })
      }));

      if (editing?.id === employee.id) {
        setEditing(current => current ? { ...current, is_active: false } : current);
      }

      await loadEmployees();
    } catch (requestError) {
      setError(requestError.message || "Unable to disable employee.");
    }
  };

  const openCreateForm = () => {
    setError("");
    setEditing(null);
    setCreateForm(initialCreateForm);
    setFormVisible(true);
  };

  const openEditForm = employee => {
    setError("");
    setEditing({ ...employee, password: "" });
    setFormVisible(true);
  };

  const closeForm = () => {
    setError("");
    setEditing(null);
    setCreateForm(initialCreateForm);
    setFormVisible(false);
  };

  return (
    <div className={!formVisible ? "page-grid-task-creation" : "page-grid"}>
      <div className="content-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="section-title mb-1">Employees</h2>
            <p className="text-muted mb-0">Active employees are shown first by default. Disable accounts from the list, and re-enable them later from the disabled view when needed.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-brand btn-action-pill" onClick={openCreateForm}>
              <i className="bi bi-person-plus-fill" aria-hidden="true"></i>
              <span>Create Employee</span>
            </button>
            <span className="badge rounded-pill text-bg-light border px-3 py-2">{visibleEmployees.length} employees</span>
          </div>
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}

        <div className="d-flex align-items-end justify-content-between gap-3 mb-3 flex-wrap">
          <div className="employee-filter-select">
            <label className="form-label">View Employees</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            >
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
              <option value="all">All Employees</option>
            </select>
          </div>
          <div className="text-muted small">
            Total records: {employees.length}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.length ? visibleEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>{employee.employee_code}</td>
                  <td>{employee.name}</td>
                  <td>{employee.email}</td>
                  <td>{employee.role}</td>
                   <td>{employee.is_active ? "Active" : "Disabled"}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEditForm(employee)}
                        >
                          Edit
                        </button>
                        {employee.is_active ? (
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => disableEmployee(employee)}
                          >
                            Disable
                          </button>
                        ) : null}
                      </div>
                    </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No employees found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formVisible ? (
        <div className="content-card sticky-card">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="section-title mb-1">{editing ? "Edit Employee" : "Create Employee"}</h2>
              <p className="text-muted mb-0">
                {editing ? "Update employee access, status, or password." : "Create a new employee account with admin-only access control."}
              </p>
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill" onClick={closeForm}>
              Close
            </button>
          </div>

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          {editing ? (
          <form onSubmit={submitUpdate}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" value={editing.name} onChange={event => setEditing(current => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input className="form-control" value={editing.email} onChange={event => setEditing(current => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Role</label>
                <select className="form-select" value={editing.role} onChange={event => setEditing(current => ({ ...current, role: event.target.value }))}>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Status</label>
                <select className="form-select" value={String(editing.is_active)} onChange={event => setEditing(current => ({ ...current, is_active: event.target.value === "true" }))}>
                  <option value="true">Active</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={editing.password} onChange={event => setEditing(current => ({ ...current, password: event.target.value }))} />
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button className="btn btn-brand">Update</button>
              {editing.is_active ? (
                <button type="button" className="btn btn-outline-warning" onClick={() => disableEmployee(editing)}>
                  Disable
                </button>
              ) : null}
              <button type="button" className="btn btn-outline-secondary" onClick={closeForm}>Cancel</button>
            </div>
          </form>
          ) : (
          <form onSubmit={submitCreate} className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Name</label>
              <input className="form-control" value={createForm.name} onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Username</label>
              <input className="form-control" value={createForm.username} onChange={event => setCreateForm(current => ({ ...current, username: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input className="form-control" value={createForm.email} onChange={event => setCreateForm(current => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Temporary Password</label>
              <input type="password" className="form-control" value={createForm.password} onChange={event => setCreateForm(current => ({ ...current, password: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Manager Email</label>
              <input className="form-control" value={createForm.manager_email} onChange={event => setCreateForm(current => ({ ...current, manager_email: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Role</label>
              <select className="form-select" value={createForm.role} onChange={event => setCreateForm(current => ({ ...current, role: event.target.value }))}>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="col-12 d-flex gap-2 mt-2">
              <button className="btn btn-brand">Create Employee</button>
              <button type="button" className="btn btn-outline-secondary" onClick={closeForm}>Cancel</button>
            </div>
          </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
