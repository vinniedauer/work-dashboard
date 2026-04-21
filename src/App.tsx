import { Routes, Route, Navigate } from "react-router-dom";
import { useConfig } from "./hooks/useConfig";
import Dashboard from "./components/layout/Dashboard";
import Settings from "./components/panels/Settings";

function App() {
  const { isConfigured, loading } = useConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Routes>
        <Route
          path="/"
          element={
            isConfigured ? <Dashboard /> : <Navigate to="/settings" replace />
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}

export default App;
