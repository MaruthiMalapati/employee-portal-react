const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname.includes("vercel.app")
    ? "https://employee-portal-backend-zqbo.onrender.com"
    : "http://localhost:3000");
console.log("API Base URL:", API_BASE_URL, " (from env:", import.meta.env.VITE_API_BASE_URL, ")" );
export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const rawText = await response.text();
  let payload;

  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(rawText?.slice(0, 160) || `Unexpected response (${response.status})`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

export function withAuth(token, options = {}) {
  return {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
}

export function withSessionAuth(token, sessionId, options = {}) {
  return withAuth(token, {
    ...options,
    headers: {
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(options.headers || {})
    }
  });
}

export { API_BASE_URL };
