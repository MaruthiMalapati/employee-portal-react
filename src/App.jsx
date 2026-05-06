import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardHome from "./pages/DashboardHome";
import TasksPage from "./pages/TasksPage";
import EmployeesPage from "./pages/EmployeesPage";
import PayrollPage from "./pages/PayrollPage";
import LoginTimePage from "./pages/LoginTimePage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="login-time" element={<LoginTimePage />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute requireAdmin>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="upload-works" element={<PlaceholderPage title="Upload Works" />} />
        <Route path="performance" element={<PlaceholderPage title="Performance" />} />
        <Route path="schedules" element={<PlaceholderPage title="Schedules" />} />
        <Route path="messages" element={<PlaceholderPage title="Messages" />} />
        <Route path="notifications" element={<PlaceholderPage title="Notifications" />} />
        <Route path="dump-files" element={<PlaceholderPage title="Dump Files" />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
