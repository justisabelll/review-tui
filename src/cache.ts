import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import type { Comment } from "./types";

export type CacheHit = {
  cachedAt: string;
  comments: Comment[];
};

type CacheEntry = CacheHit;

const getCacheDir = (): string => {
  const override = process.env.XDG_CACHE_HOME;
  if (override) return path.join(override, "review-tui");

  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "review-tui");
  }

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) return path.join(localAppData, "review-tui", "Cache");
    return path.join(os.homedir(), "AppData", "Local", "review-tui", "Cache");
  }

  return path.join(os.homedir(), ".cache", "review-tui");
};

const cacheKeyForUrl = (url: string): string => {
  const hash = createHash("sha256").update(`v1:${url}`).digest("hex");
  return `v1-${hash}.json`;
};

const readCacheFile = async (filePath: string): Promise<CacheEntry | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CacheEntry;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "ENOENT") return null;
    }
    throw error;
  }
};

export const readCommentsCache = async (
  prUrl: string,
  ttlSeconds: number
): Promise<CacheHit | null> => {
  if (ttlSeconds <= 0) return null;

  const cacheDir = getCacheDir();
  const filePath = path.join(cacheDir, cacheKeyForUrl(prUrl));
  const entry = await readCacheFile(filePath);
  if (!entry) return null;

  const cachedAt = new Date(entry.cachedAt).getTime();
  if (!Number.isFinite(cachedAt)) return null;

  const ageSeconds = (Date.now() - cachedAt) / 1000;
  if (ageSeconds > ttlSeconds) return null;

  return entry;
};

export const writeCommentsCache = async (
  prUrl: string,
  comments: Comment[]
): Promise<void> => {
  const cacheDir = getCacheDir();
  await fs.mkdir(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, cacheKeyForUrl(prUrl));
  const entry: CacheEntry = {
    cachedAt: new Date().toISOString(),
    comments
  };

  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf8");
};
