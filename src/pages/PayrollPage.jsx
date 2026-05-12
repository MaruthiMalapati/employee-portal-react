import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";

export default function PayrollPage() {
  const { token, isAdmin, user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [historyMonth, setHistoryMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [holidays, setHolidays] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [summary, setSummary] = useState({ amount: 0, payableDays: 0, lopDays: 0, holidays: 0 });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: `${currentMonth}-01`, title: "", is_paid: true });
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      loadEmployees();
      loadHolidays();
      loadPreview();
      loadHistory();
    } else {
      loadMyHistory(month, true);
      loadMyHistory(historyMonth, false);
    }
  }, [month, historyMonth, employeeId, isAdmin]);

  const loadEmployees = async () => {
    try {
      const result = await apiRequest("/api/admin/employees", withAuth(token));
      setEmployees(result.data || []);
    } catch (requestError) {
      console.error(requestError);
    }
  };

  const loadHolidays = async () => {
    if (!isAdmin) return;
    try {
      const result = await apiRequest(`/api/payroll/holidays?month=${month}`, withAuth(token));
      setHolidays(result.data || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load holidays.");
    }
  };

  const loadPreview = async () => {
    if (!isAdmin) return;
    try {
      const result = await apiRequest(`/api/payroll/preview?month=${month}`, withAuth(token));
      setPreviewRows(result.data || []);
      setSummary({
        amount: (result.data || []).reduce((sum, row) => sum + Number(row.payable_amount || 0), 0),
        payableDays: (result.data || []).reduce((sum, row) => sum + Number(row.payable_days || 0), 0),
        lopDays: (result.data || []).reduce((sum, row) => sum + Number(row.lop_days || 0), 0),
        holidays: (result.data || []).reduce((sum, row) => sum + Number(row.public_holiday_days || 0), 0)
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to load payroll preview.");
    }
  };

  const loadHistory = async () => {
    if (!isAdmin) return;
    const params = new URLSearchParams({ month: historyMonth });
    if (employeeId) {
      params.set("employee_id", employeeId);
    }

    try {
      const result = await apiRequest(`/api/payroll/history?${params.toString()}`, withAuth(token));
      setHistoryRows(result.data || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load payroll history.");
    }
  };

  const loadMyHistory = async (monthValue, forPreview) => {
    try {
      const result = await apiRequest(`/api/payroll/my-history?month=${monthValue}`, withAuth(token));
      const rows = result.data || [];
      if (forPreview) {
        setPreviewRows(rows);
        if (rows[0]) {
          setSummary({
            amount: Number(rows[0].payable_amount || 0),
            payableDays: Number(rows[0].payable_days || 0),
            lopDays: Number(rows[0].lop_days || 0),
            holidays: Number(rows[0].public_holiday_days || 0)
          });
        } else {
          setSummary({ amount: 0, payableDays: 0, lopDays: 0, holidays: 0 });
        }
      } else {
        setHistoryRows(rows);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load payroll history.");
    }
  };

  const addHoliday = async event => {
    event.preventDefault();
    try {
      await apiRequest("/api/payroll/holidays", withAuth(token, {
        method: "POST",
        body: JSON.stringify(holidayForm)
      }));
      setHolidayForm({ holiday_date: `${month}-01`, title: "", is_paid: true });
      await loadHolidays();
      await loadPreview();
    } catch (requestError) {
      setError(requestError.message || "Unable to add holiday.");
    }
  };

  const removeHoliday = async id => {
    try {
      await apiRequest(`/api/payroll/holidays/${id}`, withAuth(token, { method: "DELETE" }));
      await loadHolidays();
      await loadPreview();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete holiday.");
    }
  };

  const generatePayroll = async () => {
    try {
      await apiRequest("/api/payroll/generate", withAuth(token, {
        method: "POST",
        body: JSON.stringify({ month })
      }));
      setHistoryMonth(month);
      await loadHistory();
    } catch (requestError) {
      setError(requestError.message || "Unable to generate payroll.");
    }
  };

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Payroll Hub</div>
            <h2 className="page-hero-title">{isAdmin ? "Payroll Management" : `${user?.name || "Employee"} Payroll`}</h2>
            <p className="page-hero-text">
              Review salary summaries, manage payroll periods, and keep every month organized with a cleaner finance workspace.
            </p>
          </div>
          <div className="page-hero-actions">
            {isAdmin ? <button className="btn btn-outline-secondary btn-action-pill" onClick={loadPreview}>Preview</button> : null}
            {isAdmin ? <button className="btn btn-brand btn-action-pill" onClick={generatePayroll}>Generate</button> : null}
            <span className="hero-badge">{month}</span>
          </div>
        </div>
      </section>

      <div className="page-grid-task-creation">
      {isAdmin ? (
        <div className="content-card">
          <h2 className="section-title">Payroll Controls</h2>
          <div className="soft-panel mb-4">
            <div className="mb-3">
              <label className="form-label">Payroll Month</label>
              <input type="month" className="form-control" value={month} onChange={event => setMonth(event.target.value)} />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary" onClick={loadPreview}>Preview</button>
              <button className="btn btn-brand" onClick={generatePayroll}>Generate</button>
            </div>
          </div>

          <h3 className="h6 fw-bold mb-3">Public Holidays</h3>
          <form onSubmit={addHoliday} className="soft-panel mb-3">
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={holidayForm.holiday_date}
                onChange={event => setHolidayForm(current => ({ ...current, holiday_date: event.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Title</label>
              <input
                className="form-control"
                value={holidayForm.title}
                onChange={event => setHolidayForm(current => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="form-check mb-3">
              <input
                id="paidHoliday"
                className="form-check-input"
                type="checkbox"
                checked={holidayForm.is_paid}
                onChange={event => setHolidayForm(current => ({ ...current, is_paid: event.target.checked }))}
              />
              <label htmlFor="paidHoliday" className="form-check-label">Paid holiday</label>
            </div>
            <button className="btn btn-outline-primary">Add Holiday</button>
          </form>

          <div className="small text-muted">Current month holidays</div>
          <div className="mt-2 d-grid gap-2">
            {holidays.length ? holidays.map(holiday => (
              <div key={holiday.id} className="border rounded p-3 d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold">{holiday.title}</div>
                  <div className="small text-muted">
                    {new Date(`${holiday.holiday_date}T00:00:00`).toLocaleDateString("en-IN")} • {holiday.is_paid ? "Paid" : "Unpaid"}
                  </div>
                </div>
                <button className="btn btn-sm btn-link text-danger" onClick={() => removeHoliday(holiday.id)}>Delete</button>
              </div>
            )) : <div className="small text-muted">No holidays added.</div>}
          </div>
        </div>
      ) : null}

      <div className="content-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="section-title mb-1">{isAdmin ? "Payroll Snapshot" : `${user?.name || "Employee"} Payslips`}</h2>
            <p className="text-muted mb-0">
              {isAdmin ? "Review payable salary before finalizing the payroll run." : "View your generated payroll history and payable amount by month."}
            </p>
          </div>
          <span className="badge rounded-pill text-bg-light border px-3 py-2">{month}</span>
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}

        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">Payable Amount</div>
            <div className="stat-value">Rs {summary.amount.toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Payable Days</div>
            <div className="stat-value">{summary.payableDays}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">LOP Days</div>
            <div className="stat-value">{summary.lopDays}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Public Holidays</div>
            <div className="stat-value">{summary.holidays}</div>
          </div>
        </div>

        <div className="table-responsive mt-4">
          <table className="table align-middle">
            <thead>
              <tr>
                {isAdmin ? <th>Employee</th> : <th>Month</th>}
                <th>Present</th>
                <th>Holiday</th>
                <th>Sick Leave</th>
                <th>Paid Sick</th>
                <th>LOP</th>
                <th>Payable Days</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length ? previewRows.map(row => (
                <tr key={`${row.employee_id || "me"}-${row.payroll_month || row.month}`}>
                  {isAdmin ? (
                    <td>{row.employee_name}{row.employee_code ? ` (${row.employee_code})` : ""}</td>
                  ) : (
                    <td>{row.payroll_month || row.month}</td>
                  )}
                  <td>{row.present_days}</td>
                  <td>{row.public_holiday_days}</td>
                  <td>{row.sick_leave_days}</td>
                  <td>{row.paid_sick_leave_days}</td>
                  <td>{row.lop_days}</td>
                  <td>{row.payable_days}</td>
                  <td>Rs {Number(row.payable_amount || 0).toFixed(2)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">No payroll data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-top pt-4 mt-4">
          <div className="row g-3 mb-3">
            {isAdmin ? (
              <div className="col-md-6">
                <label className="form-label">Employee</label>
                <select className="form-select" value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
                  <option value="">All Employees</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}{employee.employee_code ? ` (${employee.employee_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="col-md-6">
              <label className="form-label">History Month</label>
              <input type="month" className="form-control" value={historyMonth} onChange={event => setHistoryMonth(event.target.value)} />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Month</th>
                  {isAdmin ? <th>Employee</th> : null}
                  <th>Monthly Salary</th>
                  <th>Payable Days</th>
                  <th>LOP</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length ? historyRows.map(row => (
                  <tr key={row.id}>
                    <td>{row.payroll_month}</td>
                    {isAdmin ? <td>{row.employees?.name}{row.employees?.employee_code ? ` (${row.employees.employee_code})` : ""}</td> : null}
                    <td>Rs {Number(row.base_salary || 0).toFixed(2)}</td>
                    <td>{row.payable_days}</td>
                    <td>{row.lop_days}</td>
                    <td>Rs {Number(row.payable_amount || 0).toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="text-center text-muted py-4">No payroll history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
