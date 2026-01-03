import React, { useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Config } from "../config";

type AppProps = {
  prUrl: string;
  config: Config;
};

const formatConfig = (config: Config): string => {
  const safe = {
    ...config,
    token: config.token ? "<set>" : "<empty>"
  };
  return JSON.stringify(safe, null, 2);
};

export const App = ({ prUrl, config }: AppProps): JSX.Element => {
  const { exit } = useApp();

  useInput((input) => {
    if (input === "q") {
      exit();
    }
  });

  const configView = useMemo(() => formatConfig(config), [config]);

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
        <Text bold>Resolved config</Text>
        <Text>{configView}</Text>
      </Box>
    </Box>
  );
};
