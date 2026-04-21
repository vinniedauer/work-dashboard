import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppConfig, SlackMessage } from "../types";
import * as slack from "../services/slack";

export function useChannelMessages(config: AppConfig, channelId: string) {
  // Memoize the channel ID to prevent unnecessary refetch loops when the
  // caller passes an inline string or a value derived on every render.
  const stableChannelId = useMemo(() => channelId, [channelId]);

  return useQuery<SlackMessage[]>({
    queryKey: ["slack", "channelMessages", stableChannelId],
    queryFn: () => slack.fetchChannelMessages(config, stableChannelId),
    enabled: !!(config.slack.userToken || config.slack.token) && !!stableChannelId,
  });
}

export function useSituationsToMonitor(config: AppConfig) {
  const ecomChannelId = config.slack.ecomChannelId;
  const codeReviewChannelId = config.slack.codeReviewChannelId;
  const hasToken = !!(config.slack.userToken || config.slack.token);
  const hasChannel = !!(ecomChannelId || codeReviewChannelId);

  return useQuery<SlackMessage[]>({
    queryKey: ["slack", "situationsToMonitor"],
    queryFn: async () => {
      const fetches: Promise<SlackMessage[]>[] = [];

      if (ecomChannelId) {
        fetches.push(
          slack.fetchSituationsToMonitor(config, ecomChannelId, "ecommerce")
        );
      }
      if (codeReviewChannelId) {
        fetches.push(
          slack.fetchSituationsToMonitor(
            config,
            codeReviewChannelId,
            "ecommerce-code-review"
          )
        );
      }

      const results = await Promise.all(fetches);
      const merged = results.flat();

      // Sort newest first and cap at 5
      merged.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));
      return merged.slice(0, 5);
    },
    enabled: hasToken && hasChannel,
  });
}

export function useWaitingOnYou(config: AppConfig) {
  return useQuery<SlackMessage[]>({
    queryKey: ["slack", "waitingOnYou"],
    queryFn: () => slack.fetchWaitingOnYou(config),
    enabled: !!config.slack.userToken,
  });
}
