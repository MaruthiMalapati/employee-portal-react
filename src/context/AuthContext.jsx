import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

function readStoredAuth() {
  const token = localStorage.getItem("authToken");
  const name = localStorage.getItem("employeeName");
  const username = localStorage.getItem("employeeUsername");
  const role = localStorage.getItem("employeeRole");

  if (!token) {
    return null;
  }

  return {
    token,
    user: {
      name: name || "",
      username: username || "",
      role: role || ""
    }
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth());

  useEffect(() => {
    const onStorage = () => {
      setAuth(readStoredAuth());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = ({ token, employee }) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("employeeName", employee.name || "");
    localStorage.setItem("employeeUsername", employee.username || "");
    localStorage.setItem("employeeRole", employee.role || "");

    setAuth({
      token,
      user: {
        name: employee.name || "",
        username: employee.username || "",
        role: employee.role || ""
      }
    });
  };

  const logout = () => {
    localStorage.clear();
    setAuth(null);
  };

  return (
    <AuthContext.Provider
      value={{
        auth,
        token: auth?.token || "",
        user: auth?.user || null,
        isAuthenticated: Boolean(auth?.token),
        isAdmin: auth?.user?.role === "ADMIN",
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
