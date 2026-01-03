#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import meow from "meow";
import { resolveConfig } from "./config";
import { App } from "./ui/App";

const cli = meow(
  `
  Usage
    $ review-tui <pr-url>

  Options
    --dry-run       Run without writing output
    --no-cache      Disable cache
    --bot <name>    Bot username to filter on
    --token <token> GitHub token

  Examples
    $ review-tui https://github.com/o/r/pull/1 --bot coderabbitai --dry-run --no-cache
`,
  {
    importMeta: import.meta,
    flags: {
      dryRun: {
        type: "boolean",
        default: false
      },
      cache: {
        type: "boolean",
        default: true
      },
      bot: {
        type: "string"
      },
      token: {
        type: "string"
      }
    }
  }
);

const [prUrl] = cli.input;

if (!prUrl) {
  cli.showHelp(1);
}

const config = await resolveConfig(process.cwd(), {
  dryRun: cli.flags.dryRun,
  cache: cli.flags.cache,
  bot: cli.flags.bot,
  token: cli.flags.token
});

render(<App prUrl={prUrl} config={config} />);
