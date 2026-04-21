import type { ReactNode } from "react";

interface PanelCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

export default function PanelCard({
  title,
  icon,
  children,
  isLoading = false,
  error = null,
}: PanelCardProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden min-h-0">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 shrink-0">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-100 tracking-tight">
          {title}
        </h2>
        {isLoading && (
          <div className="ml-auto">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500" />
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="relative flex-1 min-h-0 overflow-y-auto p-4">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
