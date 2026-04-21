import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  requestDeviceCode,
  pollForToken,
  fetchAuthenticatedUser,
  type DeviceCodeResponse,
} from "../../services/githubAuth";

type ConnectState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "awaiting"; device: DeviceCodeResponse }
  | { phase: "success"; username: string }
  | { phase: "error"; message: string };

interface GitHubConnectProps {
  clientId: string;
  /** Called with the token + username when authorization completes. */
  onAuthorized: (token: string, username: string) => void;
  /** Whether a token is already saved. */
  isConnected: boolean;
  /** Called when the user wants to disconnect / re-authenticate. */
  onDisconnect: () => void;
}

export default function GitHubConnect({
  clientId,
  onAuthorized,
  isConnected,
  onDisconnect,
}: GitHubConnectProps) {
  const [state, setState] = useState<ConnectState>({ phase: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleConnect = useCallback(async () => {
    if (!clientId.trim()) {
      setState({ phase: "error", message: "Enter your GitHub OAuth App Client ID first." });
      return;
    }

    setState({ phase: "loading" });
    try {
      const device = await requestDeviceCode(clientId);
      setState({ phase: "awaiting", device });

      // Open the verification URL in the default browser automatically
      await open(device.verificationUri);

      // Poll at the interval GitHub specifies (minimum 5 s)
      const intervalMs = Math.max(device.interval, 5) * 1000;
      pollRef.current = setInterval(async () => {
        const result = await pollForToken(clientId, device.deviceCode);

        if (result.status === "authorized") {
          stopPolling();
          let username = "";
          try {
            username = await fetchAuthenticatedUser(result.token);
          } catch {
            // non-fatal — user can fill it in manually
          }
          onAuthorized(result.token, username);
          setState({ phase: "success", username });
        } else if (result.status === "expired") {
          stopPolling();
          setState({ phase: "error", message: "Code expired. Please try again." });
        } else if (result.status === "error") {
          stopPolling();
          setState({ phase: "error", message: result.message });
        }
        // "pending" — keep polling
      }, intervalMs);
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [clientId, onAuthorized, stopPolling]);

  const handleCancel = useCallback(() => {
    stopPolling();
    setState({ phase: "idle" });
  }, [stopPolling]);

  const handleCopy = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Already connected
  if (isConnected && state.phase === "idle") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="flex items-center gap-1.5 text-sm text-green-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
          Connected to GitHub
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
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
        Connected{state.username ? ` as @${state.username}` : ""}
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
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
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
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
          </svg>
        )}
        {state.phase === "loading" ? "Requesting code…" : "Connect with GitHub"}
      </button>
    </div>
  );
}
