import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Config } from "../config";
import { readCommentsCache, writeCommentsCache } from "../cache";
import { fetchPRComments, filterBotComments, getGitHubToken, parsePRUrl } from "../github";
import type { Comment } from "../types";

type AppProps = {
  prUrl: string;
  config: Config;
};

type LoadState = {
  isLoading: boolean;
  error?: string;
  total: number;
  botTotal: number;
  cacheHit: boolean;
  status: string;
  authSource?: string;
};

export const App = ({ prUrl, config }: AppProps): JSX.Element => {
  const { exit } = useApp();
  const [state, setState] = useState<LoadState>({
    isLoading: true,
    total: 0,
    botTotal: 0,
    cacheHit: false,
    status: "Initializing...",
    authSource: undefined
  });

  useInput((input) => {
    if (input === "q") {
      exit();
    }
  });

  const configView = useMemo(
    () =>
      JSON.stringify(
        {
          ...config,
          token: config.token ? "<set>" : "<empty>"
        },
        null,
        2
      ),
    [config]
  );

  useEffect(() => {
    let cancelled = false;

    const loadComments = async (): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

      const prInfo = parsePRUrl(prUrl);
      if (!prInfo) {
        setState({
          isLoading: false,
          total: 0,
          botTotal: 0,
          cacheHit: false,
          status: "Invalid PR URL.",
          error: "Expected https://github.com/<owner>/<repo>/pull/<number>."
        });
        return;
      }

      try {
        const { token, source } = await getGitHubToken({ cliToken: config.token });
        let comments: Comment[] = [];
        let cacheHit = false;

        if (config.cache.enabled) {
          const cached = await readCommentsCache(prUrl, config.cache.ttl);
          if (cached) {
            comments = cached.comments;
            cacheHit = true;
          }
        }

        if (!cacheHit) {
          comments = await fetchPRComments(prInfo, token);
          if (config.cache.enabled) {
            await writeCommentsCache(prUrl, comments);
          }
        }

        const botComments =
          config.bot && config.bot.trim().length > 0
            ? filterBotComments(comments, config.bot)
            : [];

        if (cancelled) return;

        setState({
          isLoading: false,
          total: comments.length,
          botTotal: botComments.length,
          cacheHit,
          status: cacheHit ? "Loaded from cache." : "Fetched from GitHub.",
          authSource:
            source === "flag"
              ? "token flag"
              : source === "gh"
              ? "gh auth token"
              : "GITHUB_TOKEN"
        });
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load comments.";

        setState({
          isLoading: false,
          total: 0,
          botTotal: 0,
          cacheHit: false,
          status: "Error loading comments.",
          error: message,
          authSource: undefined
        });
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [prUrl, config]);

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Text bold color="green">
        Review TUI (Scaffold)
      </Text>
      <Box flexDirection="column">
        <Text>
          PR URL: <Text color="cyan">{prUrl}</Text>
        </Text>
        <Text color="yellow">Press "q" to exit.</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Status</Text>
        {state.isLoading ? (
          <Text color="blue">Loading comments...</Text>
        ) : (
          <Text color={state.error ? "red" : "green"}>{state.status}</Text>
        )}
        {state.error ? <Text color="red">{state.error}</Text> : null}
        {!state.isLoading && !state.error ? (
          <Box flexDirection="column">
            <Text>Total review comments: {state.total}</Text>
            <Text>
              Bot comments ({config.bot ?? "none"}): {state.botTotal}
            </Text>
            <Text>Cache: {state.cacheHit ? "hit" : "miss"}</Text>
            {state.authSource ? <Text>Auth: {state.authSource}</Text> : null}
          </Box>
        ) : null}
      </Box>
      <Box flexDirection="column">
        <Text bold>Resolved config</Text>
        <Text>{configView}</Text>
      </Box>
    </Box>
  );
};
