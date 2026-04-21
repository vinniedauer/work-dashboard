import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { AppConfig, DEFAULT_CONFIG } from "../types";
import {
  loadConfig,
  saveConfig,
  isConfigured as checkIsConfigured,
} from "../services/config";

interface ConfigContextValue {
  config: AppConfig;
  updateConfig: (config: AppConfig) => Promise<void>;
  isConfigured: boolean;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadConfig()
      .then((loaded) => {
        if (!cancelled) {
          setConfig(loaded);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateConfig = useCallback(async (next: AppConfig) => {
    await saveConfig(next);
    setConfig(next);
  }, []);

  const isConfigured = checkIsConfigured(config);

  return createElement(
    ConfigContext.Provider,
    { value: { config, updateConfig, isConfigured, loading } },
    children,
  );
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return ctx;
}
