import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

type ConfigFile = Partial<Config>;

export type Config = {
  dryRun: boolean;
  cache: boolean;
  bot?: string;
  token?: string;
};

export type CliFlags = {
  dryRun?: boolean;
  cache?: boolean;
  bot?: string;
  token?: string;
};

const DEFAULT_CONFIG: Config = {
  dryRun: false,
  cache: true,
  bot: undefined,
  token: undefined
};

const CONFIG_FILES = [".reviewtuirc", ".prsweeprc"];

const envBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
};

const loadConfigFile = async (filePath: string): Promise<ConfigFile | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as ConfigFile;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "ENOENT") return null;
    }
    throw error;
  }
};

const loadConfigFromFiles = async (cwd: string): Promise<ConfigFile> => {
  const home = os.homedir();
  let merged: ConfigFile = {};

  for (const name of CONFIG_FILES) {
    const homeConfig = await loadConfigFile(path.join(home, name));
    if (homeConfig) merged = { ...merged, ...homeConfig };
    const projectConfig = await loadConfigFile(path.join(cwd, name));
    if (projectConfig) merged = { ...merged, ...projectConfig };
  }

  return merged;
};

const loadConfigFromEnv = (): ConfigFile => {
  return {
    dryRun: envBoolean(process.env.REVIEW_TUI_DRY_RUN),
    cache: envBoolean(process.env.REVIEW_TUI_CACHE),
    bot: process.env.REVIEW_TUI_BOT,
    token: process.env.REVIEW_TUI_TOKEN
  };
};

const applyDefined = <T extends Record<string, unknown>>(base: T, next: T): T => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
};

export const resolveConfig = async (cwd: string, flags: CliFlags): Promise<Config> => {
  const fileConfig = await loadConfigFromFiles(cwd);
  const envConfig = loadConfigFromEnv();

  return applyDefined(
    applyDefined(applyDefined(DEFAULT_CONFIG, fileConfig as Config), envConfig as Config),
    flags as Config
  );
};
