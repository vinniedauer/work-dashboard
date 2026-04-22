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
  const requestedReviewers: string[] = (raw.requested_reviewers ?? []).map(
    (r: any) => r.login ?? ""
  );
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
    reviewDecision: requestedReviewers.length > 0 ? "REVIEW_REQUIRED" : null,
    reviews: requestedReviewers.map((login) => ({
      author: login,
      state: "PENDING" as const,
      submittedAt: "",
    })),
    checksStatus: null,
    headRef: raw.head?.ref ?? "",
    baseRef: raw.base?.ref ?? "",
  };
}

function deriveReviewDecision(reviews: PullRequestReview[]): string | null {
  if (reviews.length === 0) return null;
  // Keep only the latest review per author.
  const latest = new Map<string, PullRequestReview>();
  for (const r of reviews) {
    if (r.state === "PENDING" || r.state === "COMMENTED") continue;
    const prev = latest.get(r.author);
    if (!prev || r.submittedAt > prev.submittedAt) latest.set(r.author, r);
  }
  const decisions = [...latest.values()].map((r) => r.state);
  if (decisions.includes("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  if (decisions.includes("APPROVED")) return "APPROVED";
  return null;
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
  const myPRs = data.filter((pr) => pr.user?.login === username).map(mapPR);

  // Enrich each PR with its actual review decision.
  await Promise.all(
    myPRs.map(async (pr) => {
      const reviews = await fetchPRReviews(config, pr.number);
      pr.reviews = reviews;
      pr.reviewDecision = deriveReviewDecision(reviews);
    })
  );

  return myPRs;
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
