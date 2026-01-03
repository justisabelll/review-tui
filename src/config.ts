import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

type ConfigFile = Partial<RawConfig>;

export type CacheConfig = {
  enabled: boolean;
  ttl: number;
};

export type Config = {
  dryRun: boolean;
  cache: CacheConfig;
  bot?: string;
  token?: string;
};

type RawCache = boolean | Partial<CacheConfig>;

type RawConfig = {
  dryRun?: boolean;
  cache?: RawCache;
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
  cache: {
    enabled: true,
    ttl: 3600
  },
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
  const cacheTtl = envNumber(process.env.REVIEW_TUI_CACHE_TTL);
  return {
    dryRun: envBoolean(process.env.REVIEW_TUI_DRY_RUN),
    cache:
      cacheTtl !== undefined
        ? { enabled: envBoolean(process.env.REVIEW_TUI_CACHE), ttl: cacheTtl }
        : envBoolean(process.env.REVIEW_TUI_CACHE),
    bot: process.env.REVIEW_TUI_BOT,
    token: process.env.REVIEW_TUI_TOKEN
  };
};

const envNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeCache = (value: RawCache | undefined): Partial<CacheConfig> => {
  if (value === undefined) return {};
  if (typeof value === "boolean") return { enabled: value };
  return value;
};

const mergeConfig = (base: RawConfig, next: RawConfig): RawConfig => {
  const merged: RawConfig = { ...base, ...next };
  if (base.cache !== undefined || next.cache !== undefined) {
    merged.cache = {
      ...normalizeCache(base.cache),
      ...normalizeCache(next.cache)
    };
  }
  return merged;
};

export const resolveConfig = async (cwd: string, flags: CliFlags): Promise<Config> => {
  const fileConfig = await loadConfigFromFiles(cwd);
  const envConfig = loadConfigFromEnv();

  const rawConfig = mergeConfig(
    mergeConfig(mergeConfig(DEFAULT_CONFIG, fileConfig), envConfig),
    {
      dryRun: flags.dryRun,
      cache: flags.cache,
      bot: flags.bot,
      token: flags.token
    }
  );

  const mergedCache = normalizeCache(rawConfig.cache);

  return {
    dryRun: rawConfig.dryRun ?? DEFAULT_CONFIG.dryRun,
    cache: {
      enabled: mergedCache.enabled ?? DEFAULT_CONFIG.cache.enabled,
      ttl: mergedCache.ttl ?? DEFAULT_CONFIG.cache.ttl
    },
    bot: rawConfig.bot ?? DEFAULT_CONFIG.bot,
    token: rawConfig.token ?? DEFAULT_CONFIG.token
  };
};
