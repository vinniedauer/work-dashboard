import { useState, useRef, useCallback, useEffect } from "react";
import { startSlackOAuth, type SlackAuthResult } from "../../services/slackAuth";

type ConnectState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; teamName: string }
  | { phase: "error"; message: string };

interface SlackConnectProps {
  clientId: string;
  clientSecret: string;
  isConnected: boolean;
  connectedTeam?: string;
  onAuthorized: (result: SlackAuthResult) => void;
  onDisconnect: () => void;
}

export default function SlackConnect({
  clientId,
  clientSecret,
  isConnected,
  connectedTeam,
  onAuthorized,
  onDisconnect,
}: SlackConnectProps) {
  const [state, setState] = useState<ConnectState>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const handleConnect = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setState({
        phase: "error",
        message: "Enter your Slack App Client ID and Client Secret first.",
      });
      return;
    }

    abortRef.current = new AbortController();
    setState({ phase: "loading" });

    try {
      const result = await startSlackOAuth(clientId, clientSecret, abortRef.current.signal);
      onAuthorized(result);
      setState({ phase: "success", teamName: result.teamName });
    } catch (err) {
      if ((err as Error).message === "Cancelled") {
        setState({ phase: "idle" });
      } else {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [clientId, clientSecret, onAuthorized]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setState({ phase: "idle" });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

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
          Connected{connectedTeam ? ` to ${connectedTeam}` : " to Slack"}
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
        Connected{state.teamName ? ` to ${state.teamName}` : " to Slack"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.phase === "error" && (
        <p className="text-xs text-red-400 px-1">{state.message}</p>
      )}
      {state.phase === "loading" ? (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <p className="text-sm text-gray-300">
            Your browser opened Slack. Authorize the app and you'll be redirected
            back automatically.
          </p>
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
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:bg-gray-700 hover:border-gray-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.687 8.834a2.528 2.528 0 0 1-2.521 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zM15.166 17.687a2.527 2.527 0 0 1-2.521-2.521 2.526 2.526 0 0 1 2.521-2.521h6.312A2.527 2.527 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
          </svg>
          Connect with Slack
        </button>
      )}
    </div>
  );
}
