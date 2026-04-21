import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "../../hooks/useConfig";

interface HeaderProps {
  lastRefresh: Date;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function Header({
  lastRefresh,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  const navigate = useNavigate();
  const { config } = useConfig();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const timeSinceRefresh = useMemo(() => {
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin === 1) return "1 minute ago";
    return `${diffMin} minutes ago`;
  }, [now, lastRefresh]);

  const services: { name: string; connected: boolean }[] = useMemo(
    () => [
      { name: "Jira", connected: !!config.jira.apiToken },
      { name: "GitHub", connected: !!config.github.token },
      { name: "Slack", connected: !!config.slack.token },
    ],
    [config],
  );

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800">
      {/* Left: App title */}
      <h1 className="text-lg font-semibold text-gray-100 tracking-tight">
        Work Dashboard
      </h1>

      {/* Right: controls */}
      <div className="flex items-center gap-4">
        {/* Last refreshed */}
        <span className="text-sm text-gray-500 hidden sm:inline">
          Last refreshed: {timeSinceRefresh}
        </span>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh all data"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`}
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <path d="M21 3v6h-6" />
          </svg>
          Refresh
        </button>

        {/* Connection status dots */}
        <div className="flex items-center gap-2">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center gap-1" title={`${svc.name}: ${svc.connected ? "connected" : "not configured"}`}>
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  svc.connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-gray-500 hidden md:inline">
                {svc.name}
              </span>
            </div>
          ))}
        </div>

        {/* Settings button */}
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 shrink-0"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </header>
  );
}
