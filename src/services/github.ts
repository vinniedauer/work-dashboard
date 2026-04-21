import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig, PullRequest, PullRequestReview } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function mapPR(raw: any): PullRequest {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    state: raw.state,
    author: raw.user?.login ?? "",
    url: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    isDraft: raw.draft ?? false,
    reviewDecision: null, // REST API doesn't provide this; populated via reviews
    reviews: [],
    checksStatus: null, // populated separately if needed
    headRef: raw.head?.ref ?? "",
    baseRef: raw.base?.ref ?? "",
  };
}

function mapReview(raw: any): PullRequestReview {
  return {
    author: raw.user?.login ?? "",
    state: raw.state as PullRequestReview["state"],
    submittedAt: raw.submitted_at ?? "",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the authenticated user's open pull requests in the configured repo.
 * Uses the search endpoint filtered by author.
 */
/** Returns the login of the authenticated user. */
export async function fetchAuthenticatedUser(token: string): Promise<string> {
  const resp = await fetch(`${GITHUB_API}/user`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(`GitHub /user failed (${resp.status})`);
  const data = await resp.json();
  return data.login ?? "";
}

export async function fetchMyPullRequests(
  config: AppConfig
): Promise<PullRequest[]> {
  const { token, owner, repo } = config.github;
  if (!token || !owner || !repo) return [];

  let username = config.github.username;
  if (!username) {
    username = await fetchAuthenticatedUser(token);
  }
  if (!username) return [];

  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
  const resp = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    throw new Error(`GitHub PRs failed (${resp.status}): ${await resp.text()}`);
  }

  const data: any[] = await resp.json();
  return data.filter((pr) => pr.user?.login === username).map(mapPR);
}

/**
 * Fetch all open pull requests in the repo (for the team pulse view).
 */
export async function fetchTeamPullRequests(
  config: AppConfig
): Promise<PullRequest[]> {
  const { token, owner, repo } = config.github;
  if (!token || !owner || !repo) return [];

  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
  const resp = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    throw new Error(`GitHub team PRs failed (${resp.status}): ${await resp.text()}`);
  }

  const data: any[] = await resp.json();
  return data.map(mapPR);
}

/**
 * Fetch the version string from package.json on a given branch.
 * Returns null if GitHub isn't configured or the file can't be read.
 */
export async function fetchBranchPackageVersion(
  config: AppConfig,
  branch: string
): Promise<string | null> {
  const { token, owner, repo } = config.github;
  if (!token || !owner || !repo) return null;

  const resp = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(branch)}`,
    { method: "GET", headers: authHeaders(token) }
  );
  if (!resp.ok) throw new Error(`GitHub package.json on ${branch} failed (${resp.status}): ${await resp.text()}`);

  const data = await resp.json();
  const decoded = atob((data.content as string).replace(/\n/g, ""));
  const pkg = JSON.parse(decoded);
  return typeof pkg.version === "string" ? pkg.version : null;
}

/**
 * Fetch reviews for a specific pull request.
 */
export async function fetchPRReviews(
  config: AppConfig,
  prNumber: number
): Promise<PullRequestReview[]> {
  try {
    const { token, owner, repo } = config.github;
    if (!token || !owner || !repo) return [];

    const url =
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;

    const resp = await fetch(url, {
      method: "GET",
      headers: authHeaders(token),
    });

    if (!resp.ok) {
      throw new Error(
        `GitHub fetchPRReviews failed (${resp.status}): ${await resp.text()}`
      );
    }

    const data: any[] = await resp.json();
    return data.map(mapReview);
  } catch (err) {
    console.error("fetchPRReviews failed:", err);
    return [];
  }
}
