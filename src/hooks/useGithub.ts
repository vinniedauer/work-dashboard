import { useQuery } from "@tanstack/react-query";
import type { AppConfig, PullRequest } from "../types";
import * as github from "../services/github";

export interface BranchVersions {
  main: string;
  staging: string;
  production: string;
}

export function useMyPullRequests(config: AppConfig) {
  const { token, owner, repo, username } = config.github;
  return useQuery<PullRequest[]>({
    queryKey: ["github", "myPullRequests", token, owner, repo, username],
    queryFn: () => github.fetchMyPullRequests(config),
    enabled: !!token && !!owner && !!repo,
  });
}

export function useTeamPullRequests(config: AppConfig) {
  const { token, owner, repo } = config.github;
  return useQuery<PullRequest[]>({
    queryKey: ["github", "teamPullRequests", token, owner, repo],
    queryFn: () => github.fetchTeamPullRequests(config),
    enabled: !!token && !!owner && !!repo,
  });
}

export function useBranchVersions(config: AppConfig) {
  return useQuery<BranchVersions>({
    queryKey: ["github", "branchVersions", config.github.owner, config.github.repo],
    queryFn: async () => {
      const [main, staging, production] = await Promise.all([
        github.fetchBranchPackageVersion(config, "main"),
        github.fetchBranchPackageVersion(config, "staging"),
        github.fetchBranchPackageVersion(config, "production"),
      ]);
      return { main: main ?? "", staging: staging ?? "", production: production ?? "" };
    },
    enabled: !!config.github.token && !!config.github.owner && !!config.github.repo,
  });
}
