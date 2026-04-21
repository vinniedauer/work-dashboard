import { useQuery } from "@tanstack/react-query";
import type {
  AppConfig,
  JiraTicket,
  JiraComment,
  JiraFixVersion,
  JiraBoardItem,
  RaidItem,
} from "../types";
import * as jira from "../services/jira";

export function useMyTickets(config: AppConfig) {
  return useQuery<JiraTicket[]>({
    queryKey: [
      "jira",
      "myTickets",
      config.jira.email,
      config.jira.ecomProjectKey,
      config.jira.erProjectKey,
    ],
    queryFn: () => jira.fetchMyTickets(config),
    enabled: !!config.jira.apiToken,
  });
}

export function useTeamBugs(config: AppConfig) {
  return useQuery<JiraTicket[]>({
    queryKey: ["jira", "teamBugs"],
    queryFn: () => jira.fetchTeamPRsAndBugs(config),
    enabled: !!config.jira.apiToken,
  });
}

export function useRecentComments(config: AppConfig) {
  return useQuery<JiraComment[]>({
    queryKey: ["jira", "recentComments"],
    queryFn: () => jira.fetchRecentComments(config),
    enabled: !!config.jira.apiToken,
  });
}

export function useFixVersions(config: AppConfig) {
  return useQuery<JiraFixVersion[]>({
    queryKey: ["jira", "fixVersions"],
    queryFn: () => jira.fetchFixVersions(config),
    enabled: !!config.jira.apiToken,
  });
}

export function useReplatformBoard(config: AppConfig) {
  return useQuery<JiraBoardItem[]>({
    queryKey: ["jira", "replatformBoard"],
    queryFn: () => jira.fetchReplatformBoard(config),
    enabled: !!config.jira.apiToken,
  });
}

export function useRaidItems(config: AppConfig) {
  return useQuery<RaidItem[]>({
    queryKey: ["jira", "raidItems"],
    queryFn: () => jira.fetchRaidItems(config),
    enabled: !!config.jira.apiToken,
  });
}
