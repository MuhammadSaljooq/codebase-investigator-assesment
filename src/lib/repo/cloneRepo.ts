import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const cacheRoot = path.join(process.cwd(), "repos-cache");

function ensureCacheRoot() {
  if (!fs.existsSync(cacheRoot)) {
    fs.mkdirSync(cacheRoot, { recursive: true });
  }
}

export function validateGithubUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) GitHub URLs are supported.");
  }
  if (parsed.hostname !== "github.com") {
    throw new Error("Only github.com repositories are supported in this MVP.");
  }
  return parsed;
}

export function normalizeRepoUrl(url: string): string {
  const parsed = validateGithubUrl(url);
  const segments = parsed.pathname.split("/").filter(Boolean).slice(0, 2);
  if (segments.length !== 2) {
    throw new Error("Repository URL must include owner and repo.");
  }
  const [owner, repoRaw] = segments;
  const repo = repoRaw.endsWith(".git") ? repoRaw.slice(0, -4) : repoRaw;
  return `https://github.com/${owner}/${repo}.git`;
}

export function cloneOrRefreshRepo(repoUrl: string): { localPath: string; commitSha: string } {
  ensureCacheRoot();
  const normalized = normalizeRepoUrl(repoUrl);
  const slug = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  const localPath = path.join(cacheRoot, slug);

  if (!fs.existsSync(localPath)) {
    execFileSync("git", ["clone", "--depth", "1", normalized, localPath], {
      stdio: "pipe"
    });
  } else {
    execFileSync("git", ["-C", localPath, "fetch", "--depth", "1", "origin"], { stdio: "pipe" });
    execFileSync("git", ["-C", localPath, "checkout", "--detach", "FETCH_HEAD"], {
      stdio: "pipe"
    });
  }

  const commitSha = execFileSync("git", ["-C", localPath, "rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();

  return { localPath, commitSha };
}
