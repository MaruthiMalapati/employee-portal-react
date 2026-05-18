import { Fragment, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest, withAuth } from "../lib/api";
import "./PayrollPage.css";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric"
});

function toNumber(value) {
  return Number(value || 0);
}

function roundToTwo(value) {
  return Number(toNumber(value).toFixed(2));
}

function formatCurrency(value) {
  return currencyFormatter.format(toNumber(value));
}

function formatCount(value) {
  return Number.isInteger(toNumber(value))
    ? String(toNumber(value))
    : roundToTwo(value).toFixed(2);
}

function formatMonthLabel(monthValue) {
  if (!monthValue) return "";
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  return monthFormatter.format(date);
}

function formatPayrollMonthValue(dateValue) {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 7);
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getStatusMeta(row) {
  if (row.hasValidationIssue) {
    return { label: "Needs Review", tone: "warning" };
  }

  if (row.payableAmount <= 0) {
    return { label: "No Pay", tone: "muted" };
  }

  if (row.generatedAt) {
    return { label: row.lopDays > 0 ? "Finalized with LOP" : "Finalized", tone: row.lopDays > 0 ? "warning" : "primary" };
  }

  if (row.lopDays >= Math.max(3, row.totalWorkingDays * 0.25)) {
    return { label: "High LOP", tone: "danger" };
  }

  if (row.lopDays > 0) {
    return { label: "Partial Pay", tone: "warning" };
  }

  return { label: "Ready", tone: "success" };
}

function getLopSeverity(row) {
  if (!row || row.lopDays <= 0) {
    return { label: "No LOP", tone: "success", message: "No loss of pay is recorded for this month." };
  }

  const highLopLimit = Math.max(3, row.totalWorkingDays * 0.25);
  if (row.lopDays >= highLopLimit) {
    return {
      label: "High LOP",
      tone: "danger",
      message: `${formatCount(row.lopDays)} LOP day${row.lopDays === 1 ? "" : "s"} detected. Review attendance or contact HR if this does not look correct.`
    };
  }

  return {
    label: "LOP Applied",
    tone: "warning",
    message: `${formatCount(row.lopDays)} LOP day${row.lopDays === 1 ? "" : "s"} reduced this month's payable amount.`
  };
}

function enhancePayrollRow(row, employeeDirectory = {}) {
  const employeeRef = employeeDirectory[row.employee_id] || {};
  const presentDays = roundToTwo(row.present_days);
  const holidayDays = roundToTwo(row.public_holiday_days);
  const weeklyOffDays = roundToTwo(row.weekly_off_days);
  const publicHolidayDays = Math.max(0, roundToTwo(holidayDays - weeklyOffDays));
  const sickLeaveDays = roundToTwo(row.sick_leave_days);
  const paidSickLeaveDays = roundToTwo(row.paid_sick_leave_days);
  const lopDays = roundToTwo(row.lop_days);
  const absentDays = roundToTwo(row.absent_days);
  const baseSalary = roundToTwo(row.base_salary);
  const perDayRate = roundToTwo(row.per_day_rate);
  const exactPerDayRate = row.calendar_days
    ? toNumber(row.base_salary) / toNumber(row.calendar_days)
    : toNumber(row.per_day_rate);
  const expectedPayableDays = roundToTwo(presentDays + holidayDays + paidSickLeaveDays);
  const storedPayableDays = roundToTwo(row.payable_days);
  const totalWorkingDays = roundToTwo(
    row.total_working_days || expectedPayableDays + lopDays
  );
  const scheduledWorkingDays = roundToTwo(row.scheduled_working_days || totalWorkingDays - holidayDays);
  const deductions = roundToTwo(
    row.deduction_amount || lopDays * exactPerDayRate
  );
  const validatedAmount = roundToTwo(expectedPayableDays * exactPerDayRate);
  const storedAmount = roundToTwo(row.payable_amount);
  const hasPayableMismatch = Math.abs(expectedPayableDays - storedPayableDays) > 0.01;
  const hasAmountMismatch = Math.abs(validatedAmount - storedAmount) > 0.01;
  const validationPassed = row.validation_passed !== false && !hasPayableMismatch && !hasAmountMismatch;
  const employeeName = row.employee_name || row.employees?.name || employeeRef.name || "Employee";
  const employeeCode = row.employee_code || row.employees?.employee_code || employeeRef.employee_code || "";
  const department = row.employee_role || row.employees?.role || employeeRef.role || "Unassigned";
  const payrollMonth = row.month || formatPayrollMonthValue(row.payroll_month);
  const generatedAt = row.generated_at || "";
  const status = getStatusMeta({
    hasValidationIssue: !validationPassed,
    payableAmount: validatedAmount,
    totalWorkingDays,
    generatedAt,
    lopDays
  });

  return {
    ...row,
    key: row.id || `${row.employee_id || "me"}-${row.payroll_month || row.month}`,
    employeeName,
    employeeCode,
    department,
    payrollMonth,
    monthLabel: formatMonthLabel(payrollMonth),
    generatedAt,
    baseSalary,
    perDayRate,
    presentDays,
    holidayDays,
    publicHolidayDays,
    weeklyOffDays,
    sickLeaveDays,
    paidSickLeaveDays,
    lopDays,
    absentDays,
    payableDays: expectedPayableDays,
    storedPayableDays,
    totalWorkingDays,
    scheduledWorkingDays,
    deductions,
    payableAmount: validatedAmount,
    storedAmount,
    hasPayableMismatch,
    hasAmountMismatch,
    hasValidationIssue: !validationPassed,
    statusLabel: status.label,
    statusTone: status.tone
  };
}

function aggregateRows(rows) {
  return rows.reduce((totals, row) => ({
    amount: totals.amount + row.payableAmount,
    payableDays: totals.payableDays + row.payableDays,
    lopDays: totals.lopDays + row.lopDays,
    holidays: totals.holidays + row.holidayDays,
    publicHolidays: totals.publicHolidays + row.publicHolidayDays,
    weeklyOffs: totals.weeklyOffs + row.weeklyOffDays,
    totalWorkingDays: totals.totalWorkingDays + row.totalWorkingDays,
    scheduledWorkingDays: totals.scheduledWorkingDays + row.scheduledWorkingDays,
    presentDays: totals.presentDays + row.presentDays,
    sickLeaveDays: totals.sickLeaveDays + row.sickLeaveDays,
    paidSickLeaveDays: totals.paidSickLeaveDays + row.paidSickLeaveDays
  }), {
    amount: 0,
    payableDays: 0,
    lopDays: 0,
    holidays: 0,
    publicHolidays: 0,
    weeklyOffs: 0,
    totalWorkingDays: 0,
    scheduledWorkingDays: 0,
    presentDays: 0,
    sickLeaveDays: 0,
    paidSickLeaveDays: 0
  });
}

function getEmployeeInfo(user, row) {
  return [
    { label: "Employee", value: row?.employeeName || user?.name || "Employee" },
    { label: "Employee ID", value: row?.employeeCode || user?.employee_code || user?.employeeCode || "Not assigned" },
    { label: "Department", value: row?.department || user?.role || "Unassigned" },
    { label: "Payment Status", value: row?.generatedAt ? "Payslip finalized" : "Awaiting payroll finalization" }
  ];
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, "\"\"")}"`
    : stringValue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPayslipHtml(row, shouldPrint = false) {
  const employeeLabel = row.employeeCode ? `${row.employeeName} (${row.employeeCode})` : row.employeeName;
  const grossBeforeDeductions = roundToTwo(row.payableAmount + row.deductions);
  const componentBase = grossBeforeDeductions || row.payableAmount || row.baseSalary;
  const basicPay = roundToTwo(componentBase * 0.5);
  const hra = roundToTwo(componentBase * 0.25);
  const specialAllowance = roundToTwo(componentBase - basicPay - hra);
  const statutoryDeductions = [
    { label: "Provident Fund (PF)", amount: 0 },
    { label: "Professional Tax", amount: 0 },
    { label: "Income Tax / TDS", amount: 0 },
    { label: "Other Deductions", amount: 0 }
  ];
  const totalStandardDeductions = statutoryDeductions.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = roundToTwo(row.deductions + totalStandardDeductions);
  const netPay = roundToTwo(grossBeforeDeductions - totalDeductions);
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Salary Slip - ${escapeHtml(employeeLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef3f7; color: #162f45; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; background: #fff; }
    .sheet { border: 1px solid #cfdce8; }
    .letterhead { display: grid; grid-template-columns: 1fr auto; gap: 18px; padding: 22px 24px; border-bottom: 4px solid #315f86; }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo { width: 58px; height: 58px; border-radius: 14px; display: grid; place-items: center; background: #315f86; color: #fff; font-weight: 800; font-size: 22px; letter-spacing: 0.03em; }
    .company h1 { margin: 0; color: #173148; font-size: 24px; letter-spacing: 0.01em; text-transform: uppercase; }
    .company p, .contact p { margin: 4px 0 0; color: #526b80; font-size: 12px; line-height: 1.35; }
    .contact { text-align: right; max-width: 250px; }
    .titlebar { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 16px 24px; background: #f3f8fc; border-bottom: 1px solid #dbe7f1; }
    .titlebar h2 { margin: 0; color: #173148; font-size: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
    .status { display: inline-flex; padding: 7px 12px; border-radius: 999px; background: #e9f1f8; color: #315f86; font-size: 12px; font-weight: 700; }
    .section { padding: 18px 24px; border-bottom: 1px solid #e1ebf3; }
    .section:last-child { border-bottom: 0; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #dbe7f1; }
    .info-item { min-height: 66px; padding: 11px 12px; border-right: 1px solid #dbe7f1; border-bottom: 1px solid #dbe7f1; }
    .info-item:nth-child(4n) { border-right: 0; }
    .info-item:nth-last-child(-n + 4) { border-bottom: 0; }
    .label { display: block; color: #60788f; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
    .value { display: block; color: #173148; font-size: 13px; font-weight: 700; line-height: 1.3; }
    .summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-card { border: 1px solid #dbe7f1; background: #fbfdff; padding: 12px; min-height: 76px; }
    .summary-card strong { display: block; margin-top: 5px; color: #173148; font-size: 17px; }
    .tables { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #dbe7f1; }
    th { background: #315f86; color: #fff; font-size: 11px; text-align: left; text-transform: uppercase; letter-spacing: 0.04em; }
    th, td { padding: 10px 11px; border-bottom: 1px solid #e1ebf3; }
    td { color: #173148; font-size: 12px; }
    td.amount, th.amount { text-align: right; }
    tfoot td { background: #f3f8fc; font-weight: 800; }
    .netpay { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; border: 1px solid #315f86; background: #f4f9fd; padding: 16px 18px; }
    .netpay span { color: #60788f; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .netpay strong { display: block; margin-top: 5px; color: #173148; font-size: 24px; }
    .note { margin-top: 10px; color: #60788f; font-size: 11px; line-height: 1.45; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; padding-top: 24px; }
    .signature-box { min-height: 90px; display: grid; align-content: end; }
    .signature-line { border-top: 1px solid #9fb4c6; padding-top: 8px; color: #173148; font-size: 12px; font-weight: 700; }
    .signature-line span { display: block; margin-top: 3px; color: #60788f; font-size: 11px; font-weight: 500; }
    .footer { padding: 12px 24px; background: #f8fbfe; color: #60788f; font-size: 10px; text-align: center; border-top: 1px solid #e1ebf3; }
    @media print {
      body { background: #fff; }
      .page { width: auto; min-height: auto; padding: 0; }
      .sheet { border-color: #b8c9d8; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="page">
  <div class="sheet">
    <header class="letterhead">
      <div class="brand">
        <div class="logo">TD</div>
        <div class="company">
          <h1>Trishoka Digital Services</h1>
          <p>Prajay Princeton Towers, Doctors Colony, L.B. Nagar, HYD</p>
        </div>
      </div>
      <div class="contact">
        <p>+91 9493401014</p>
        <p>trishokadigiservices@gmail.com</p>
        <p>www.trishoka.com</p>
      </div>
    </header>

    <div class="titlebar">
      <h2>Salary Slip</h2>
      <span class="status">${escapeHtml(row.statusLabel)}</span>
    </div>

    <section class="section">
      <div class="info-grid">
        <div class="info-item"><span class="label">Employee Name</span><span class="value">${escapeHtml(row.employeeName)}</span></div>
        <div class="info-item"><span class="label">Employee ID</span><span class="value">${escapeHtml(row.employeeCode || "Not assigned")}</span></div>
        <div class="info-item"><span class="label">Department</span><span class="value">${escapeHtml(row.department || "Unassigned")}</span></div>
        <div class="info-item"><span class="label">Pay Period</span><span class="value">${escapeHtml(row.monthLabel)}</span></div>
        <div class="info-item"><span class="label">Generated Date</span><span class="value">${generatedDate}</span></div>
        <div class="info-item"><span class="label">Monthly CTC/Gross</span><span class="value">${formatCurrency(row.baseSalary)}</span></div>
        <div class="info-item"><span class="label">Per Day Rate</span><span class="value">${formatCurrency(row.perDayRate)}</span></div>
        <div class="info-item"><span class="label">Payroll Type</span><span class="value">Monthly Salary</span></div>
      </div>
    </section>

    <section class="section">
      <div class="summary-strip">
        <div class="summary-card"><span class="label">Payroll Days</span><strong>${formatCount(row.totalWorkingDays)}</strong></div>
        <div class="summary-card"><span class="label">Payable Days</span><strong>${formatCount(row.payableDays)}</strong></div>
        <div class="summary-card"><span class="label">LOP Days</span><strong>${formatCount(row.lopDays)}</strong></div>
        <div class="summary-card"><span class="label">Public Holidays</span><strong>${formatCount(row.publicHolidayDays)}</strong></div>
      </div>
    </section>

    <section class="section">
      <div class="tables">
        <table>
          <thead><tr><th>Earnings</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            <tr><td>Basic Pay</td><td class="amount">${formatCurrency(basicPay)}</td></tr>
            <tr><td>House Rent Allowance</td><td class="amount">${formatCurrency(hra)}</td></tr>
            <tr><td>Special Allowance</td><td class="amount">${formatCurrency(specialAllowance)}</td></tr>
          </tbody>
          <tfoot><tr><td>Gross Earnings</td><td class="amount">${formatCurrency(grossBeforeDeductions)}</td></tr></tfoot>
        </table>

        <table>
          <thead><tr><th>Deductions</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            <tr><td>Loss of Pay Deduction</td><td class="amount">${formatCurrency(row.deductions)}</td></tr>
            ${statutoryDeductions.map(item => `<tr><td>${item.label}</td><td class="amount">${formatCurrency(item.amount)}</td></tr>`).join("")}
          </tbody>
          <tfoot><tr><td>Total Deductions</td><td class="amount">${formatCurrency(totalDeductions)}</td></tr></tfoot>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="netpay">
        <div>
          <span>Net Salary Payable</span>
          <strong>${formatCurrency(netPay)}</strong>
        </div>
        <div>
          <span>Payment Status</span>
          <strong>${escapeHtml(row.generatedAt ? "Finalized" : "Preview")}</strong>
        </div>
      </div>
      <p class="note">
        Attendance basis: Present ${formatCount(row.presentDays)}, Paid Sick Leave ${formatCount(row.paidSickLeaveDays)}, Public Holidays ${formatCount(row.publicHolidayDays)}, Weekly Offs ${formatCount(row.weeklyOffDays)}, LOP ${formatCount(row.lopDays)}.
        PF, professional tax, TDS, and other statutory deductions are marked as zero as per current payroll configuration.
      </p>
      ${row.hasValidationIssue ? `<p class="note">Payroll validation note: stored values were adjusted for display consistency before generating this payslip.</p>` : ""}
    </section>

    <section class="section">
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line">Employee Acknowledgement<span>${escapeHtml(row.employeeName)}</span></div>
        </div>
        <div class="signature-box">
          <div class="signature-line">KVS Koushik<span>Managing Director</span></div>
        </div>
      </div>
    </section>

    <div class="footer">
      This is a computer-generated salary slip from Trishoka Digital Services. Please contact HR for corrections or payroll clarifications.
    </div>
  </div>
  </div>
  ${shouldPrint ? `
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 250);
    });
  </script>` : ""}
</body>
</html>`;
}

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
  const [previewMeta, setPreviewMeta] = useState({ effectiveEnd: "", paidHolidayCount: 0, sickLeaveAllowance: 1 });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: `${currentMonth}-01`, title: "", is_paid: true });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState("");
  const [adminSection, setAdminSection] = useState("snapshot");
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

  const employeeDirectory = employees.reduce((map, employee) => {
    map[employee.id] = employee;
    return map;
  }, {});

  const allPreviewRows = previewRows.map(row => enhancePayrollRow(row, employeeDirectory));
  const allHistoryRows = historyRows.map(row => enhancePayrollRow(row, employeeDirectory));
  const previewDepartments = Array.from(new Set(allPreviewRows.map(row => row.department).filter(Boolean))).sort();
  const statusOptions = ["Ready", "Partial Pay", "High LOP", "No Pay", "Needs Review", "Finalized", "Finalized with LOP"];

  const previewDisplayRows = allPreviewRows.filter(row => {
    const searchValue = employeeSearch.trim().toLowerCase();
    const matchesSearch = !searchValue || [
      row.employeeName,
      row.employeeCode,
      row.department,
      row.monthLabel
    ].join(" ").toLowerCase().includes(searchValue);
    const matchesDepartment = !departmentFilter || row.department === departmentFilter;
    const matchesStatus = !statusFilter || row.statusLabel === statusFilter;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const historyDisplayRows = allHistoryRows.filter(row => {
    const searchValue = employeeSearch.trim().toLowerCase();
    const matchesSearch = !searchValue || [
      row.employeeName,
      row.employeeCode,
      row.department,
      row.monthLabel
    ].join(" ").toLowerCase().includes(searchValue);
    const matchesDepartment = !departmentFilter || row.department === departmentFilter;
    const matchesStatus = !statusFilter || row.statusLabel === statusFilter;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const summary = aggregateRows(previewDisplayRows);
  const previewIssues = previewDisplayRows.filter(row => row.hasValidationIssue || row.payableAmount <= 0 || row.lopDays >= Math.max(3, row.totalWorkingDays * 0.25));
  const employeeCurrentRow = !isAdmin ? previewDisplayRows[0] : null;
  const employeeHistoryRows = !isAdmin ? historyDisplayRows : [];
  const employeeLopSeverity = getLopSeverity(employeeCurrentRow);
  const employeeInfo = getEmployeeInfo(user, employeeCurrentRow);

  const loadEmployees = async () => {
    try {
      const result = await apiRequest("/api/admin/employees", withAuth(token));
      setEmployees((result.data || []).filter(employee => employee.is_active));
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
      setPreviewMeta({
        effectiveEnd: result.effectiveEnd || result.effective_end || result.end || "",
        paidHolidayCount: toNumber(result.paidHolidayCount),
        sickLeaveAllowance: toNumber(result.sickLeaveAllowance || 1)
      });
      setExpandedRowKey("");
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
        setPreviewMeta({
          effectiveEnd: rows[0]?.payroll_month || "",
          paidHolidayCount: 0,
          sickLeaveAllowance: 1
        });
        setExpandedRowKey("");
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
      await loadPreview();
    } catch (requestError) {
      setError(requestError.message || "Unable to finalize payroll.");
    }
  };

  const exportSnapshot = () => {
    const headers = [
      "Employee",
      "Code",
      "Department",
      "Month",
      "Monthly Salary",
      "Per Day Salary",
      "Present Days",
      "Public Holidays",
      "Weekly Offs",
      "Sick Leave",
      "Paid Sick Leave",
      "LOP Days",
      "Payroll Days",
      "Payable Days",
      "Deductions",
      "Payable Amount",
      "Status"
    ];

    const rows = previewDisplayRows.map(row => [
      row.employeeName,
      row.employeeCode,
      row.department,
      row.monthLabel,
      row.baseSalary,
      row.perDayRate,
      row.presentDays,
      row.publicHolidayDays,
      row.weeklyOffDays,
      row.sickLeaveDays,
      row.paidSickLeaveDays,
      row.lopDays,
      row.totalWorkingDays,
      row.payableDays,
      row.deductions,
      row.payableAmount,
      row.statusLabel
    ]);

    const csv = [headers, ...rows]
      .map(columns => columns.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-snapshot-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openPayslip = (row, shouldPrint = false) => {
    const html = buildPayslipHtml(row, shouldPrint);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "width=1024,height=860");
    if (!popup) return;
    popup.addEventListener?.("beforeunload", () => URL.revokeObjectURL(url), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const renderAmountCell = row => (
    row.payableAmount <= 0 ? (
      <div className="d-flex flex-column align-items-start gap-1">
        <span className="payroll-badge tone-muted">No Pay</span>
        <span className="small text-muted">{formatCurrency(row.payableAmount)}</span>
      </div>
    ) : (
      <div className="fw-bold payroll-amount">{formatCurrency(row.payableAmount)}</div>
    )
  );

  const renderBreakdownPanel = row => (
    <div className="payroll-breakdown-shell">
      <div className="payroll-breakdown-head">
        <div>
          <div className="payroll-breakdown-title">Salary Breakdown</div>
          <div className="payroll-breakdown-subtitle">
            {row.employeeName}{row.employeeCode ? ` (${row.employeeCode})` : ""} | {row.monthLabel}
          </div>
        </div>
        <div className="payroll-breakdown-formula">
          Payable Days = Present + Paid Leave + Public Holidays + Weekly Offs
        </div>
      </div>
      <div className="payroll-breakdown-grid">
        <div className="payroll-breakdown-item">
          <span>Monthly Salary</span>
          <strong>{formatCurrency(row.baseSalary)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Per Day Salary</span>
          <strong>{formatCurrency(row.perDayRate)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Present Days</span>
          <strong>{formatCount(row.presentDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Paid Leave</span>
          <strong>{formatCount(row.paidSickLeaveDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Public Holidays</span>
          <strong>{formatCount(row.publicHolidayDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Weekly Offs</span>
          <strong>{formatCount(row.weeklyOffDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Scheduled Working</span>
          <strong>{formatCount(row.scheduledWorkingDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>LOP Days</span>
          <strong className="text-danger">{formatCount(row.lopDays)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Deductions</span>
          <strong>{formatCurrency(row.deductions)}</strong>
        </div>
        <div className="payroll-breakdown-item">
          <span>Final Payable Amount</span>
          <strong>{formatCurrency(row.payableAmount)}</strong>
        </div>
      </div>
      {row.hasValidationIssue ? (
        <div className="alert alert-warning py-2 px-3 mb-0">
          Payroll validation adjusted this row before display. Stored payable days: {formatCount(row.storedPayableDays)} and stored amount: {formatCurrency(row.storedAmount)}.
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="page-stack payroll-page">
      <section className="page-hero payroll-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Payroll Hub</div>
            <h2 className="page-hero-title">{isAdmin ? "Payroll Snapshot" : `${user?.name || "Employee"} Payslips`}</h2>
            <p className="page-hero-text">
              Review payroll with complete audit visibility, validated day counts, and production-ready actions for payroll trust.
            </p>
          </div>
          <div className="page-hero-actions">
            {isAdmin ? <button className="btn btn-outline-secondary btn-action-pill" onClick={loadPreview}>Refresh Preview</button> : null}
            {isAdmin ? <button className="btn btn-outline-primary btn-action-pill" onClick={exportSnapshot}>Export Excel-ready CSV</button> : null}
            {isAdmin ? <button className="btn btn-brand btn-action-pill" onClick={generatePayroll}>Finalize Payroll</button> : null}
            <span className="hero-badge">{formatMonthLabel(month)}</span>
          </div>
        </div>
      </section>

      {isAdmin ? (
        <div className="page-stack">
            <div className="payroll-admin-nav payroll-admin-nav-inline">
              <button
                className={`payroll-admin-tab ${adminSection === "snapshot" ? "active" : ""}`}
                onClick={() => setAdminSection("snapshot")}
              >
                Snapshot
              </button>
              <button
                className={`payroll-admin-tab ${adminSection === "holidays" ? "active" : ""}`}
                onClick={() => setAdminSection("holidays")}
              >
                Holidays
              </button>
              <button
                className={`payroll-admin-tab ${adminSection === "history" ? "active" : ""}`}
                onClick={() => setAdminSection("history")}
              >
                History
              </button>
            </div>

            {adminSection === "snapshot" ? (
              <div className="content-card payroll-summary-sticky">
                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
                  <div className="payroll-summary-header">
                    <h2 className="section-title mb-1">Payroll Summary</h2>
                    <p className="text-muted mb-0">
                      Payable Days = Present + Paid Leave + Public Holidays + Weekly Offs. Weekly offs never count as absent.
                    </p>
                  </div>
                </div>

                <div className="payroll-chip-row payroll-chip-row-tight mb-2">
                  <span className="payroll-chip">Month: {formatMonthLabel(month)}</span>
                  <span className="payroll-chip">Public Holidays: {formatCount(previewMeta.paidHolidayCount)}</span>
                  <span className="payroll-chip">Weekly Offs: {formatCount(previewMeta.weeklyOffCount)}</span>
                  <span className="payroll-chip">Paid Sick Leave Allowance: {formatCount(previewMeta.sickLeaveAllowance)}</span>
                  {previewMeta.effectiveEnd ? <span className="payroll-chip">Calculated Till: {formatDisplayDate(previewMeta.effectiveEnd)}</span> : null}
                </div>

                {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                <div className="soft-panel payroll-filter-panel mt-2 mb-2">
                  <div className="row g-3">
                    <div className="col-lg-4">
                      <label className="form-label">Employee Search</label>
                      <input
                        className="form-control"
                        placeholder="Search by employee, code, or month"
                        value={employeeSearch}
                        onChange={event => setEmployeeSearch(event.target.value)}
                      />
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">Department</label>
                      <select className="form-select" value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}>
                        <option value="">All Departments</option>
                        {previewDepartments.map(department => (
                          <option key={department} value={department}>{department}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">Payroll Status</label>
                      <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                        <option value="">All Statuses</option>
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-lg-2">
                      <label className="form-label">Payroll Month</label>
                      <input type="month" className="form-control" value={month} onChange={event => setMonth(event.target.value)} />
                      <div className="small text-muted mt-1">{formatMonthLabel(month)}</div>
                    </div>
                  </div>
                </div>

                <div className="stats-grid payroll-stats-grid">
                  <div className="stat-box stat-box-emphasis">
                    <div className="stat-label">Payable Amount</div>
                    <div className="stat-value">{formatCurrency(summary.amount)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Payroll Days</div>
                    <div className="stat-value">{formatCount(summary.totalWorkingDays)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Scheduled Working</div>
                    <div className="stat-value">{formatCount(summary.scheduledWorkingDays)}</div>
                  </div>
                  <div className="stat-box stat-box-positive">
                    <div className="stat-label">Payable Days</div>
                    <div className="stat-value text-success">{formatCount(summary.payableDays)}</div>
                  </div>
                  <div className="stat-box stat-box-danger">
                    <div className="stat-label">LOP Days</div>
                    <div className="stat-value text-danger">{formatCount(summary.lopDays)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Public Holidays</div>
                    <div className="stat-value">{formatCount(summary.publicHolidays)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Weekly Offs</div>
                    <div className="stat-value">{formatCount(summary.weeklyOffs)}</div>
                  </div>
                </div>

                {previewIssues.length ? (
                  <div className="alert alert-light payroll-alert mt-4 mb-0">
                    <strong>{previewIssues.length}</strong> payroll row{previewIssues.length > 1 ? "s need" : " needs"} attention due to zero pay, high LOP, or validation corrections.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="content-card">
              {adminSection === "snapshot" ? (
                <>
                  <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                    <div>
                      <h2 className="section-title mb-1">Payroll Snapshot Table</h2>
                      <p className="text-muted mb-0">Expand any row to inspect salary math before payroll is finalized.</p>
                    </div>
                    <span className="payroll-chip">{previewDisplayRows.length} row{previewDisplayRows.length === 1 ? "" : "s"} in view</span>
                  </div>

                  <div className="table-responsive payroll-table-shell d-none d-lg-block">
                    <table className="table payroll-table align-middle">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Status</th>
                          <th>Present</th>
                          <th>Public Holiday</th>
                          <th>Weekly Off</th>
                          <th>Sick Leave</th>
                          <th>Paid Sick</th>
                          <th>Payroll Days</th>
                          <th>LOP</th>
                          <th>Payable Days</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewDisplayRows.length ? previewDisplayRows.map(row => (
                          <Fragment key={row.key}>
                            <tr
                              className={[
                                "payroll-row",
                                row.payableAmount <= 0 ? "payroll-row-muted" : "",
                                row.hasValidationIssue ? "payroll-row-warning" : ""
                              ].filter(Boolean).join(" ")}
                            >
                              <td>
                                <div className="fw-semibold">{row.employeeName}</div>
                                <div className="small text-muted">{row.employeeCode || row.monthLabel}</div>
                              </td>
                              <td>{row.department}</td>
                              <td><span className={`payroll-badge tone-${row.statusTone}`}>{row.statusLabel}</span></td>
                              <td>{formatCount(row.presentDays)}</td>
                              <td>{formatCount(row.publicHolidayDays)}</td>
                              <td>{formatCount(row.weeklyOffDays)}</td>
                              <td>{formatCount(row.sickLeaveDays)}</td>
                              <td>{formatCount(row.paidSickLeaveDays)}</td>
                              <td>{formatCount(row.totalWorkingDays)}</td>
                              <td className="text-danger fw-semibold">{formatCount(row.lopDays)}</td>
                              <td className="text-success fw-semibold">{formatCount(row.payableDays)}</td>
                              <td>{renderAmountCell(row)}</td>
                              <td>
                                <div className="d-flex gap-2 flex-wrap">
                                  <button className="btn btn-sm btn-outline-primary" onClick={() => setExpandedRowKey(current => current === row.key ? "" : row.key)}>
                                    {expandedRowKey === row.key ? "Hide" : "Breakdown"}
                                  </button>
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openPayslip(row, false)}>Preview</button>
                                  <button className="btn btn-sm btn-brand" onClick={() => openPayslip(row, true)}>PDF</button>
                                </div>
                              </td>
                            </tr>
                            {expandedRowKey === row.key ? (
                              <tr className="payroll-detail-row">
                                <td colSpan={13}>{renderBreakdownPanel(row)}</td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )) : (
                          <tr>
                            <td colSpan={13} className="text-center text-muted py-4">No payroll data available for the current filters.</td>
                          </tr>
                        )}
                      </tbody>
                      {previewDisplayRows.length ? (
                        <tfoot>
                          <tr className="payroll-totals-row">
                            <td>Total</td>
                            <td>-</td>
                            <td>-</td>
                            <td>{formatCount(summary.presentDays)}</td>
                            <td>{formatCount(summary.publicHolidays)}</td>
                            <td>{formatCount(summary.weeklyOffs)}</td>
                            <td>{formatCount(summary.sickLeaveDays)}</td>
                            <td>{formatCount(summary.paidSickLeaveDays)}</td>
                            <td>{formatCount(summary.totalWorkingDays)}</td>
                            <td className="text-danger">{formatCount(summary.lopDays)}</td>
                            <td className="text-success">{formatCount(summary.payableDays)}</td>
                            <td>{formatCurrency(summary.amount)}</td>
                            <td>Sticky Total</td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>

                  <div className="payroll-mobile-list d-lg-none">
                    {previewDisplayRows.length ? previewDisplayRows.map(row => (
                      <article
                        key={`${row.key}-mobile`}
                        className={[
                          "payroll-mobile-card",
                          row.payableAmount <= 0 ? "payroll-row-muted" : "",
                          row.hasValidationIssue ? "payroll-row-warning" : ""
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <h3 className="h6 mb-1">{row.employeeName}</h3>
                            <div className="small text-muted">{row.employeeCode || row.monthLabel}</div>
                            <div className="small text-muted">{row.department}</div>
                          </div>
                          <span className={`payroll-badge tone-${row.statusTone}`}>{row.statusLabel}</span>
                        </div>
                        <div className="payroll-mobile-metrics">
                          <div><span>Present</span><strong>{formatCount(row.presentDays)}</strong></div>
                          <div><span>Holiday</span><strong>{formatCount(row.holidayDays)}</strong></div>
                          <div><span>Paid Sick</span><strong>{formatCount(row.paidSickLeaveDays)}</strong></div>
                          <div><span>LOP</span><strong className="text-danger">{formatCount(row.lopDays)}</strong></div>
                          <div><span>Payable Days</span><strong className="text-success">{formatCount(row.payableDays)}</strong></div>
                          <div><span>Amount</span><strong>{row.payableAmount <= 0 ? "No Pay" : formatCurrency(row.payableAmount)}</strong></div>
                        </div>
                        <div className="mt-3">{renderBreakdownPanel(row)}</div>
                        <div className="d-flex gap-2 flex-wrap mt-3">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => openPayslip(row, false)}>Preview</button>
                          <button className="btn btn-sm btn-brand" onClick={() => openPayslip(row, true)}>PDF</button>
                        </div>
                      </article>
                    )) : <div className="empty-state">No payroll data available for the current filters.</div>}
                  </div>
                </>
              ) : null}

              {adminSection === "holidays" ? (
                <div className="payroll-section-grid payroll-section-grid-wide">
                  <form onSubmit={addHoliday} className="soft-panel">
                    <h2 className="section-title mb-2">Create Holiday</h2>
                    <p className="text-muted mb-3">Add paid or unpaid public holidays for the selected payroll month.</p>
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

                  <div className="soft-panel">
                    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                      <div>
                        <h2 className="section-title mb-1">Current Month Holidays</h2>
                        <p className="text-muted mb-0">Review and remove holidays without leaving payroll.</p>
                      </div>
                      <span className="payroll-chip">{holidays.length} holiday{holidays.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="d-grid gap-2">
                      {holidays.length ? holidays.map(holiday => (
                        <div key={holiday.id} className="border rounded p-3 d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="fw-semibold">{holiday.title}</div>
                            <div className="small text-muted">
                              {formatDisplayDate(holiday.holiday_date)} • {holiday.is_paid ? "Paid" : "Unpaid"}
                            </div>
                          </div>
                          <button className="btn btn-sm btn-link text-danger" onClick={() => removeHoliday(holiday.id)}>Delete</button>
                        </div>
                      )) : <div className="small text-muted">No holidays added.</div>}
                    </div>
                  </div>
                </div>
              ) : null}

              {adminSection === "history" ? (
                <>
                  <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                    <div>
                      <h2 className="section-title mb-1">Payroll History</h2>
                      <p className="text-muted mb-0">Review finalized records with the same validation and payroll status cues.</p>
                    </div>
                    <span className="payroll-chip">History Month: {formatMonthLabel(historyMonth)}</span>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">History Month</label>
                      <input type="month" className="form-control" value={historyMonth} onChange={event => setHistoryMonth(event.target.value)} />
                    </div>
                    <div className="col-md-4">
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
                    <div className="col-md-4">
                      <label className="form-label">Search in History</label>
                      <input
                        className="form-control"
                        placeholder="Reuse top search and filters instantly"
                        value={employeeSearch}
                        onChange={event => setEmployeeSearch(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="table-responsive payroll-table-shell">
                    <table className="table payroll-table align-middle">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Status</th>
                          <th>Monthly Salary</th>
                          <th>Payable Days</th>
                          <th>LOP</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyDisplayRows.length ? historyDisplayRows.map(row => (
                          <tr
                            key={row.key}
                            className={[
                              row.payableAmount <= 0 ? "payroll-row-muted" : "",
                              row.hasValidationIssue ? "payroll-row-warning" : ""
                            ].filter(Boolean).join(" ")}
                          >
                            <td>{row.monthLabel}</td>
                            <td>{row.employeeName}{row.employeeCode ? ` (${row.employeeCode})` : ""}</td>
                            <td>{row.department}</td>
                            <td><span className={`payroll-badge tone-${row.statusTone}`}>{row.statusLabel}</span></td>
                            <td>{formatCurrency(row.baseSalary)}</td>
                            <td className="text-success fw-semibold">{formatCount(row.payableDays)}</td>
                            <td className="text-danger fw-semibold">{formatCount(row.lopDays)}</td>
                            <td>{renderAmountCell(row)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={8} className="text-center text-muted py-4">No payroll history found for the current filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
        </div>
      ) : (
        <div className="page-stack">
        <div className="content-card">
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap mb-3">
            <div>
              <h2 className="section-title mb-1">My Payroll Summary</h2>
              <p className="text-muted mb-0">Month-wise salary, attendance, LOP, and downloadable payslip details.</p>
            </div>
            <div className="employee-month-control">
              <label className="form-label">Payroll Month</label>
              <input type="month" className="form-control" value={month} onChange={event => setMonth(event.target.value)} />
            </div>
          </div>

          <div className="stats-grid payroll-stats-grid mb-4">
            <div className="stat-box stat-box-emphasis">
              <div className="stat-label">Payable Amount</div>
              <div className="stat-value">{formatCurrency(summary.amount)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Payroll Days</div>
              <div className="stat-value">{formatCount(summary.totalWorkingDays)}</div>
            </div>
            <div className="stat-box stat-box-positive">
              <div className="stat-label">Payable Days</div>
              <div className="stat-value text-success">{formatCount(summary.payableDays)}</div>
            </div>
            <div className="stat-box stat-box-danger">
              <div className="stat-label">LOP Days</div>
              <div className="stat-value text-danger">{formatCount(summary.lopDays)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Public Holidays</div>
              <div className="stat-value">{formatCount(summary.holidays)}</div>
            </div>
          </div>

          {employeeCurrentRow ? (
            <div className={`employee-lop-alert tone-${employeeLopSeverity.tone}`}>
              <div className="employee-lop-icon">
                <i className={`bi ${employeeLopSeverity.tone === "success" ? "bi-check-circle" : "bi-exclamation-triangle"}`}></i>
              </div>
              <div>
                <div className="fw-semibold">{employeeLopSeverity.label}</div>
                <p className="mb-0">{employeeLopSeverity.message}</p>
              </div>
            </div>
          ) : null}

          <div className="employee-payroll-grid mb-4">
            <section className="soft-panel employee-info-panel">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h3 className="employee-panel-title">Employee Details</h3>
                  <p className="text-muted mb-0">{formatMonthLabel(month)}</p>
                </div>
                {employeeCurrentRow ? <span className={`payroll-badge tone-${employeeCurrentRow.statusTone}`}>{employeeCurrentRow.statusLabel}</span> : null}
              </div>
              <div className="employee-info-list">
                {employeeInfo.map(item => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="soft-panel employee-attendance-panel">
              <h3 className="employee-panel-title">Attendance Summary</h3>
              {employeeCurrentRow ? (
                <>
                  <div className="employee-attendance-meter">
                    <span style={{ width: `${employeeCurrentRow.totalWorkingDays ? Math.min(100, (employeeCurrentRow.payableDays / employeeCurrentRow.totalWorkingDays) * 100) : 0}%` }}></span>
                  </div>
                  <div className="employee-attendance-grid">
                    <div><span>Present</span><strong>{formatCount(employeeCurrentRow.presentDays)}</strong></div>
                    <div><span>Paid Leave</span><strong>{formatCount(employeeCurrentRow.paidSickLeaveDays)}</strong></div>
                    <div><span>Public Holidays</span><strong>{formatCount(employeeCurrentRow.publicHolidayDays)}</strong></div>
                    <div><span>Weekly Offs</span><strong>{formatCount(employeeCurrentRow.weeklyOffDays)}</strong></div>
                    <div><span>LOP</span><strong className="text-danger">{formatCount(employeeCurrentRow.lopDays)}</strong></div>
                  </div>
                  <p className="text-muted mb-0 small">
                    Payable days are calculated from present days, paid sick leave, public holidays, and weekly offs.
                  </p>
                </>
              ) : (
                <div className="empty-state">No attendance payroll data available for {formatMonthLabel(month)}.</div>
              )}
            </section>
          </div>

          {employeeCurrentRow ? (
            <div className="mb-4">
              {renderBreakdownPanel(employeeCurrentRow)}
            </div>
          ) : null}

          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <div>
              <h2 className="section-title mb-1">Payslip Records</h2>
              <p className="text-muted mb-0">Preview the selected month or download a printable PDF copy.</p>
            </div>
            {employeeCurrentRow ? (
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => openPayslip(employeeCurrentRow, false)}>
                  <i className="bi bi-eye me-1"></i> Preview
                </button>
                <button className="btn btn-sm btn-brand" onClick={() => openPayslip(employeeCurrentRow, true)}>
                  <i className="bi bi-file-earmark-arrow-down me-1"></i> Download PDF
                </button>
              </div>
            ) : null}
          </div>

          <div className="table-responsive payroll-table-shell d-none d-md-block">
            <table className="table payroll-table align-middle">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Status</th>
                  <th>Payroll Days</th>
                  <th>LOP</th>
                  <th>Payable Days</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {previewDisplayRows.length ? previewDisplayRows.map(row => (
                  <tr key={row.key}>
                    <td>{row.monthLabel}</td>
                    <td><span className={`payroll-badge tone-${row.statusTone}`}>{row.statusLabel}</span></td>
                    <td>{formatCount(row.totalWorkingDays)}</td>
                    <td className="text-danger fw-semibold">{formatCount(row.lopDays)}</td>
                    <td className="text-success fw-semibold">{formatCount(row.payableDays)}</td>
                    <td>{renderAmountCell(row)}</td>
                    <td>
                      <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openPayslip(row, false)}>
                          <i className="bi bi-eye me-1"></i> Preview
                        </button>
                        <button className="btn btn-sm btn-brand" onClick={() => openPayslip(row, true)}>
                          <i className="bi bi-file-earmark-arrow-down me-1"></i> Download PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">No payroll data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="payroll-mobile-list d-md-none">
            {previewDisplayRows.length ? previewDisplayRows.map(row => (
              <article key={`${row.key}-employee-mobile`} className="payroll-mobile-card">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h3 className="h6 mb-1">{row.monthLabel}</h3>
                    <div className="small text-muted">{row.employeeName}</div>
                  </div>
                  <span className={`payroll-badge tone-${row.statusTone}`}>{row.statusLabel}</span>
                </div>
                <div className="payroll-mobile-metrics">
                  <div><span>Payroll Days</span><strong>{formatCount(row.totalWorkingDays)}</strong></div>
                  <div><span>LOP</span><strong className="text-danger">{formatCount(row.lopDays)}</strong></div>
                  <div><span>Payable Days</span><strong className="text-success">{formatCount(row.payableDays)}</strong></div>
                  <div><span>Amount</span><strong>{formatCurrency(row.payableAmount)}</strong></div>
                </div>
                <div className="d-flex gap-2 flex-wrap mt-3">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openPayslip(row, false)}>
                    <i className="bi bi-eye me-1"></i> Preview
                  </button>
                  <button className="btn btn-sm btn-brand" onClick={() => openPayslip(row, true)}>
                    <i className="bi bi-file-earmark-arrow-down me-1"></i> Download PDF
                  </button>
                </div>
              </article>
            )) : <div className="empty-state">No payroll data available.</div>}
          </div>
        </div>

        <div className="content-card">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <div>
              <h2 className="section-title mb-1">Recent Payslip History</h2>
              <p className="text-muted mb-0">Use this to compare finalized payroll across months.</p>
            </div>
            <div className="employee-month-control">
              <label className="form-label">History Month</label>
              <input type="month" className="form-control" value={historyMonth} onChange={event => setHistoryMonth(event.target.value)} />
            </div>
          </div>

          <div className="employee-history-grid">
            {employeeHistoryRows.length ? employeeHistoryRows.map(row => (
              <article key={`${row.key}-history`} className="employee-history-card">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <h3>{row.monthLabel}</h3>
                    <p>{row.statusLabel}</p>
                  </div>
                  <strong>{formatCurrency(row.payableAmount)}</strong>
                </div>
                <div className="employee-history-metrics">
                  <span>Payable {formatCount(row.payableDays)}</span>
                  <span>LOP {formatCount(row.lopDays)}</span>
                  <span>Payroll {formatCount(row.totalWorkingDays)}</span>
                </div>
              </article>
            )) : <div className="empty-state">No payroll history found for {formatMonthLabel(historyMonth)}.</div>}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
