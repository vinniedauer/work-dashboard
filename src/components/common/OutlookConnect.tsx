import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  requestDeviceCode,
  pollForToken,
  type MsDeviceCodeResponse,
} from "../../services/outlookAuth";

type ConnectState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "awaiting"; device: MsDeviceCodeResponse }
  | { phase: "success" }
  | { phase: "error"; message: string };

interface OutlookConnectProps {
  clientId: string;
  tenantId: string;
  isConnected: boolean;
  onAuthorized: (accessToken: string, refreshToken: string) => void;
  onDisconnect: () => void;
}

export default function OutlookConnect({
  clientId,
  tenantId,
  isConnected,
  onAuthorized,
  onDisconnect,
}: OutlookConnectProps) {
  const [state, setState] = useState<ConnectState>({ phase: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleConnect = useCallback(async () => {
    if (!clientId.trim() || !tenantId.trim()) {
      setState({
        phase: "error",
        message: "Enter your Azure Client ID and Tenant ID first.",
      });
      return;
    }

    setState({ phase: "loading" });
    try {
      const device = await requestDeviceCode(clientId, tenantId);
      setState({ phase: "awaiting", device });

      await open(device.verificationUri);

      const intervalMs = Math.max(device.interval, 5) * 1000;
      pollRef.current = setInterval(async () => {
        const result = await pollForToken(clientId, tenantId, device.deviceCode);

        if (result.status === "authorized") {
          stopPolling();
          onAuthorized(result.accessToken, result.refreshToken);
          setState({ phase: "success" });
        } else if (result.status === "expired") {
          stopPolling();
          setState({ phase: "error", message: "Code expired. Please try again." });
        } else if (result.status === "error") {
          stopPolling();
          setState({ phase: "error", message: result.message });
        }
      }, intervalMs);
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [clientId, tenantId, onAuthorized, stopPolling]);

  const handleCancel = useCallback(() => {
    stopPolling();
    setState({ phase: "idle" });
  }, [stopPolling]);

  const handleCopy = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (isConnected && state.phase === "idle") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="flex items-center gap-1.5 text-sm text-green-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          Connected to Microsoft
        </span>
        <button
          onClick={onDisconnect}
          className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (state.phase === "success") {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
        Connected to Microsoft
      </div>
    );
  }

  if (state.phase === "awaiting") {
    const { userCode, verificationUri } = state.device;
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
        <p className="text-sm text-gray-300">
          Your browser opened{" "}
          <button
            onClick={() => open(verificationUri)}
            className="text-blue-400 underline hover:text-blue-300"
          >
            {verificationUri}
          </button>
          . Enter this code:
        </p>

        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-[0.25em] text-white">
            {userCode}
          </span>
          <button
            onClick={() => handleCopy(userCode)}
            title="Copy code"
            className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            {copied ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-4 h-4"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400 shrink-0" />
          Waiting for authorization…
          <button
            onClick={handleCancel}
            className="ml-auto text-gray-500 hover:text-gray-300 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.phase === "error" && (
        <p className="text-xs text-red-400 px-1">{state.message}</p>
      )}
      <button
        onClick={handleConnect}
        disabled={state.phase === "loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:bg-gray-700 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state.phase === "loading" ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
          </svg>
        )}
        {state.phase === "loading" ? "Requesting code…" : "Connect with Microsoft"}
      </button>
    </div>
  );
}
