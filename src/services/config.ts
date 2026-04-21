import { invoke } from "@tauri-apps/api/core";
import { AppConfig, DEFAULT_CONFIG } from "../types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadConfig(): Promise<AppConfig> {
  if (!isTauri()) return { ...DEFAULT_CONFIG };
  try {
    const saved = await invoke<AppConfig | null>("load_config_from_disk");
    if (saved) {
      return {
        jira: { ...DEFAULT_CONFIG.jira, ...saved.jira },
        github: { ...DEFAULT_CONFIG.github, ...saved.github },
        slack: { ...DEFAULT_CONFIG.slack, ...saved.slack },
        outlook: { ...DEFAULT_CONFIG.outlook, ...saved.outlook },
        general: { ...DEFAULT_CONFIG.general, ...saved.general },
      };
    }
    return { ...DEFAULT_CONFIG };
  } catch (err) {
    console.error("Failed to load config:", err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  if (!isTauri()) return;
  await invoke("save_config_to_disk", { config });
}

export function isConfigured(config: AppConfig): boolean {
  const jiraReady =
    config.jira.baseUrl.trim() !== "" &&
    config.jira.email.trim() !== "" &&
    config.jira.apiToken.trim() !== "" &&
    config.jira.ecomProjectKey.trim() !== "";

  const githubReady =
    config.github.token.trim() !== "" &&
    config.github.owner.trim() !== "" &&
    config.github.repo.trim() !== "";

  const slackReady = config.slack.token.trim() !== "";

  const outlookReady = config.outlook.accessToken.trim() !== "";

  return jiraReady || githubReady || slackReady || outlookReady;
}
