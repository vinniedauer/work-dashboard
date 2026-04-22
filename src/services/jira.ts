import { fetch } from "@tauri-apps/plugin-http";
import type {
  AppConfig,
  JiraTicket,
  JiraComment,
  JiraFixVersion,
  JiraBoardItem,
  RaidItem,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(config: AppConfig["jira"]): Record<string, string> {
  const encoded = btoa(`${config.email}:${config.apiToken}`);
  return {
    Authorization: `Basic ${encoded}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function baseUrl(config: AppConfig["jira"]): string {
  return config.baseUrl.replace(/\/+$/, "");
}

/** Map raw Jira REST issue JSON to our local JiraTicket type. */
function mapIssue(raw: any, jiraBase: string): JiraTicket {
  const fields = raw.fields ?? {};
  // story_points is the Simplified Field Scheme name; customfield_10016 is the
  // legacy custom field used by many Jira Cloud instances.
  const storyPoints =
    fields.story_points ?? fields.customfield_10016 ?? null;
  return {
    key: raw.key,
    summary: fields.summary ?? "",
    status: fields.status?.name ?? "",
    statusCategory: mapStatusCategory(fields.status?.statusCategory?.key),
    priority: fields.priority?.name ?? "None",
    assignee: fields.assignee?.displayName ?? null,
    project: fields.project?.name ?? "",
    projectKey: fields.project?.key ?? "",
    issueType: fields.issuetype?.name ?? "",
    updated: fields.updated ?? "",
    url: `${jiraBase}/browse/${raw.key}`,
    storyPoints: typeof storyPoints === "number" ? storyPoints : null,
  };
}

function mapStatusCategory(
  key: string | undefined
): "new" | "indeterminate" | "done" {
  if (key === "new") return "new";
  if (key === "done") return "done";
  return "indeterminate";
}

/** Generic paginated search helper — fetches all pages up to maxResults. */
async function searchIssues(
  config: AppConfig["jira"],
  jql: string,
  fields: string[],
  maxResults = 100
): Promise<JiraTicket[]> {
  const url = `${baseUrl(config)}/rest/api/3/search/jql`;
  const body = JSON.stringify({
    jql,
    maxResults,
    fields,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(config),
    body,
  });

  if (!resp.ok) {
    throw new Error(`Jira search failed (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  const base = baseUrl(config);
  return (data.issues ?? []).map((i: any) => mapIssue(i, base));
}

const ISSUE_FIELDS = [
  "summary",
  "status",
  "priority",
  "assignee",
  "project",
  "issuetype",
  "updated",
  "story_points",
  "customfield_10016",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a sprint-scoped JQL query and fall back to a non-sprint version if the
 * board doesn't support `openSprints()` (e.g. Kanban boards → 400 response).
 */
async function searchWithSprintFallback(
  config: AppConfig["jira"],
  jqlWithSprint: string,
  jqlWithoutSprint: string
): Promise<JiraTicket[]> {
  try {
    return await searchIssues(config, jqlWithSprint, ISSUE_FIELDS);
  } catch (err) {
    console.warn(
      "fetchMyTickets: sprint query failed, falling back to non-sprint query.",
      err
    );
    return await searchIssues(config, jqlWithoutSprint, ISSUE_FIELDS);
  }
}

/**
 * Tickets assigned to the current user in the current sprint, for the EA and
 * ER projects. The Replatform project is excluded here — it has its own panel.
 *
 * - EA: any status except "Done"
 * - ER: any status except "Ready for QA", "In QA", and "Done"
 *
 * Errors bubble up to react-query so the UI can display them. If a project
 * board doesn't support `sprint in openSprints()`, the per-project query
 * automatically falls back to an equivalent non-sprint JQL.
 */
export async function fetchMyTickets(
  config: AppConfig
): Promise<JiraTicket[]> {
  const { email, ecomProjectKey, erProjectKey } = config.jira;
  // Use email directly — currentUser() can resolve to nothing with Basic Auth
  const assignee = email ? `"${email}"` : "currentUser()";

  const queries: Promise<JiraTicket[]>[] = [];

  if (ecomProjectKey) {
    const jqlWithSprint =
      `project = "${ecomProjectKey}" AND sprint in openSprints()` +
      ` AND assignee = ${assignee} AND status != "Done" ORDER BY updated DESC`;
    const jqlWithoutSprint =
      `project = "${ecomProjectKey}"` +
      ` AND assignee = ${assignee} AND status != "Done" ORDER BY updated DESC`;
    queries.push(
      searchWithSprintFallback(config.jira, jqlWithSprint, jqlWithoutSprint)
    );
  }

  if (erProjectKey) {
    const jqlWithSprint =
      `project = "${erProjectKey}" AND sprint in openSprints()` +
      ` AND assignee = ${assignee}` +
      ` AND status NOT IN ("Ready for QA", "In QA", "Done") ORDER BY updated DESC`;
    const jqlWithoutSprint =
      `project = "${erProjectKey}"` +
      ` AND assignee = ${assignee}` +
      ` AND status NOT IN ("Ready for QA", "In QA", "Done") ORDER BY updated DESC`;
    queries.push(
      searchWithSprintFallback(config.jira, jqlWithSprint, jqlWithoutSprint)
    );
  }

  const results = await Promise.all(queries);
  return results.flat();
}

/**
 * Done tickets assigned to the current user in the current sprint, for the EA
 * and ER projects. Used to tally completed story points per board.
 */
export async function fetchMyDoneTicketsSprint(
  config: AppConfig
): Promise<JiraTicket[]> {
  const { email, ecomProjectKey, erProjectKey } = config.jira;
  const assignee = email ? `"${email}"` : "currentUser()";
  const queries: Promise<JiraTicket[]>[] = [];

  for (const key of [ecomProjectKey, erProjectKey].filter(Boolean)) {
    const jqlSprint = `project = "${key}" AND sprint in openSprints() AND assignee = ${assignee} AND statusCategory = Done ORDER BY updated DESC`;
    const jqlFallback = `project = "${key}" AND assignee = ${assignee} AND statusCategory = Done ORDER BY updated DESC`;
    queries.push(searchWithSprintFallback(config.jira, jqlSprint, jqlFallback));
  }

  return (await Promise.all(queries)).flat();
}

/**
 * Fetch specific tickets by key — used to check the status of tickets linked
 * to PRs without fetching the full sprint board.
 */
export async function fetchTicketsByKeys(
  config: AppConfig,
  keys: string[]
): Promise<JiraTicket[]> {
  if (keys.length === 0) return [];
  const jql = `key in (${keys.map((k) => `"${k}"`).join(",")})`;
  return searchIssues(config.jira, jql, ISSUE_FIELDS, keys.length);
}

/**
 * Bugs and recently updated items for the eCommerce project (team pulse).
 */
export async function fetchTeamPRsAndBugs(
  config: AppConfig
): Promise<JiraTicket[]> {
  try {
    const key = config.jira.ecomProjectKey;
    if (!key) return [];

    const jql =
      `project = "${key}" AND issuetype = Bug AND created >= -7d ORDER BY created DESC`;

    return await searchIssues(config.jira, jql, ISSUE_FIELDS, 3);
  } catch (err) {
    console.error("fetchTeamPRsAndBugs failed:", err);
    return [];
  }
}

/**
 * Recent comments on eCommerce-project tickets (last 7 days).
 * Uses the Jira search API with the `comment` expand and filters client-side.
 */
export async function fetchRecentComments(
  config: AppConfig
): Promise<JiraComment[]> {
  try {
    const key = config.jira.ecomProjectKey;
    if (!key) return [];

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString().split("T")[0];

    // Find tickets that had comments in the last 7 days.
    const jql =
      `project = "${key}" AND comment != EMPTY AND updated >= "${sevenDaysAgo}"` +
      ` ORDER BY updated DESC`;

    const url = `${baseUrl(config.jira)}/rest/api/3/search/jql`;
    const body = JSON.stringify({
      jql,
      maxResults: 30,
      fields: ["summary", "comment"],
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: authHeaders(config.jira),
      body: {
        type: "Text",
        payload: body,
      } as any,
    });

    if (!resp.ok) {
      throw new Error(
        `Jira comment search failed (${resp.status}): ${await resp.text()}`
      );
    }

    const data = await resp.json();
    const cutoff = new Date(sevenDaysAgo).getTime();

    const comments: JiraComment[] = [];
    for (const issue of data.issues ?? []) {
      const issueKey: string = issue.key;
      const issueSummary: string = issue.fields?.summary ?? "";
      for (const c of issue.fields?.comment?.comments ?? []) {
        const created = new Date(c.created).getTime();
        if (created >= cutoff) {
          comments.push({
            id: c.id,
            author: c.author?.displayName ?? "Unknown",
            body: extractPlainText(c.body),
            created: c.created,
            issueKey,
            issueSummary,
          });
        }
      }
    }

    // Sort newest first.
    comments.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );
    return comments;
  } catch (err) {
    console.error("fetchRecentComments failed:", err);
    return [];
  }
}

/** Extract plain text from an ADF (Atlassian Document Format) body. */
function extractPlainText(adf: any): string {
  if (typeof adf === "string") return adf;
  if (!adf || !adf.content) return "";

  const parts: string[] = [];
  function walk(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === "text" && typeof node.text === "string") {
        parts.push(node.text);
      }
      if (node.content) walk(node.content);
    }
  }
  walk(adf.content);
  return parts.join(" ");
}

/**
 * Unreleased fix versions for the eCommerce and ER projects, used for
 * deployment tracking.
 */
export async function fetchFixVersions(
  config: AppConfig
): Promise<JiraFixVersion[]> {
  try {
    const keys = [config.jira.ecomProjectKey, config.jira.erProjectKey].filter(
      Boolean
    );
    if (keys.length === 0) return [];

    const versions: JiraFixVersion[] = [];

    for (const projectKey of keys) {
      const url =
        `${baseUrl(config.jira)}/rest/api/3/project/${projectKey}/versions`;

      const resp = await fetch(url, {
        method: "GET",
        headers: authHeaders(config.jira),
      });

      if (!resp.ok) {
        console.error(
          `Jira versions for ${projectKey} failed (${resp.status})`
        );
        continue;
      }

      const data: any[] = await resp.json();
      for (const v of data) {
        if (!v.released && !v.archived) {
          versions.push({
            id: v.id,
            name: v.name,
            description: v.description ?? undefined,
            releaseDate: v.releaseDate ?? undefined,
            released: false,
            projectKey,
          });
        }
      }
    }

    return versions;
  } catch (err) {
    console.error("fetchFixVersions failed:", err);
    return [];
  }
}

/**
 * All non-Done issues from the replatform project.
 */
export async function fetchReplatformBoard(
  config: AppConfig
): Promise<JiraBoardItem[]> {
  try {
    const key = config.jira.replatformProjectKey;
    if (!key) return [];

    const jql =
      `project = "${key}" AND statusCategory != Done AND status NOT IN ("Met", "MET") AND assignee = currentUser() ORDER BY rank ASC`;

    const rawIssues = await searchIssuesRaw(
      config.jira,
      jql,
      [...ISSUE_FIELDS, "labels", "duedate"],
      200
    );

    const base = baseUrl(config.jira);
    return rawIssues
      .map((raw: any): JiraBoardItem => {
        const fields = raw.fields ?? {};
        return {
          key: raw.key,
          summary: fields.summary ?? "",
          status: fields.status?.name ?? "",
          priority: fields.priority?.name ?? "Medium",
          assignee: fields.assignee?.displayName ?? null,
          labels: (fields.labels as string[]) ?? [],
          dueDate: fields.duedate ?? null,
          url: `${base}/browse/${raw.key}`,
        };
      })
      .filter(item => item.status.toLowerCase() !== "met");
  } catch (err) {
    console.error("fetchReplatformBoard failed:", err);
    return [];
  }
}

// Internal: same as searchIssues but returns raw issue JSON so we can grab labels.
async function searchIssuesRaw(
  config: AppConfig["jira"],
  jql: string,
  fields: string[],
  maxResults = 200
): Promise<any[]> {
  const url = `${baseUrl(config)}/rest/api/3/search/jql`;
  const body = JSON.stringify({ jql, maxResults, fields });

  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(config),
    body,
  });

  if (!resp.ok) {
    throw new Error(`Jira search failed (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.issues ?? [];
}

/**
 * Issues from the RAID board (Risks, Actions, Issues, Decisions).
 */
export async function fetchRaidItems(
  config: AppConfig
): Promise<RaidItem[]> {
  try {
    const boardId = config.jira.raidBoardId;
    if (!boardId) return [];

    // RAID boards are typically a filter/board — fetch issues via board API.
    const url =
      `${baseUrl(config.jira)}/rest/agile/1.0/board/${boardId}/issue?maxResults=100&jql=status+NOT+IN+(%22Met%22%2C%22MET%22)+AND+assignee+%3D+currentUser()`;

    const resp = await fetch(url, {
      method: "GET",
      headers: authHeaders(config.jira),
    });

    if (!resp.ok) {
      throw new Error(
        `Jira RAID board fetch failed (${resp.status}): ${await resp.text()}`
      );
    }

    const data = await resp.json();
    const base = baseUrl(config.jira);

    return (data.issues ?? []).map((raw: any): RaidItem => {
      const fields = raw.fields ?? {};
      const issueType: string = fields.issuetype?.name ?? "Issue";

      return {
        key: raw.key,
        summary: fields.summary ?? "",
        type: mapRaidType(issueType),
        status: fields.status?.name ?? "",
        assignee: fields.assignee?.displayName ?? null,
        priority: fields.priority?.name ?? "None",
        url: `${base}/browse/${raw.key}`,
      };
    }).filter((item: RaidItem) => item.status.toLowerCase() !== "met")
      .sort((a: RaidItem, b: RaidItem) => {
        const rank: Record<string, number> = {
          critical: 0, highest: 1, high: 2, medium: 3, low: 4, lowest: 5,
        };
        const ra = rank[a.priority.toLowerCase()] ?? 6;
        const rb = rank[b.priority.toLowerCase()] ?? 6;
        return ra - rb;
      });
  } catch (err) {
    console.error("fetchRaidItems failed:", err);
    return [];
  }
}

function mapRaidType(
  issueType: string
): "Risk" | "Action" | "Issue" | "Decision" {
  const lower = issueType.toLowerCase();
  if (lower.includes("risk")) return "Risk";
  if (lower.includes("action")) return "Action";
  if (lower.includes("decision")) return "Decision";
  return "Issue";
}
