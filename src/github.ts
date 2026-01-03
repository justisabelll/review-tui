import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Octokit } from "@octokit/rest";
import type { Comment, PRInfo } from "./types";

const execFileAsync = promisify(execFile);

export const parsePRUrl = (url: string): PRInfo | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 4) return null;
    if (parts[2] !== "pull") return null;

    const pullNumber = Number(parts[3]);
    if (!Number.isFinite(pullNumber)) return null;

    return {
      owner: parts[0],
      repo: parts[1],
      pull_number: pullNumber,
      url
    };
  } catch {
    return null;
  }
};

const readGhAuthToken = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"]);
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

export type TokenSource = "flag" | "gh" | "env";

export type TokenResult = {
  token: string;
  source: TokenSource;
};

export const getGitHubToken = async ({
  cliToken
}: {
  cliToken?: string;
}): Promise<TokenResult> => {
  if (cliToken && cliToken.trim().length > 0) {
    return { token: cliToken.trim(), source: "flag" };
  }

  const ghToken = await readGhAuthToken();
  if (ghToken) return { token: ghToken, source: "gh" };

  const envToken = process.env.GITHUB_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return { token: envToken.trim(), source: "env" };
  }

  throw new Error(
    "Missing GitHub token. Pass --token, run `gh auth login`, or set GITHUB_TOKEN."
  );
};

export const fetchPRComments = async (
  prInfo: PRInfo,
  token: string
): Promise<Comment[]> => {
  const octokit = new Octokit({ auth: token });

  const data = await octokit.paginate(octokit.pulls.listReviewComments, {
    owner: prInfo.owner,
    repo: prInfo.repo,
    pull_number: prInfo.pull_number,
    per_page: 100
  });

  return data as Comment[];
};

export const filterBotComments = (comments: Comment[], botLogin: string): Comment[] => {
  return comments.filter((comment) => comment.user.login === botLogin);
};
