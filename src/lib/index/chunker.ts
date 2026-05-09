import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "vendor"
]);

const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".rb",
  ".php",
  ".yml",
  ".yaml",
  ".toml",
  ".env.example"
]);

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName?: string;
  contentHash: string;
}

function shouldIncludeFile(fileName: string): boolean {
  const ext = path.extname(fileName);
  return allowedExtensions.has(ext) || fileName.endsWith(".env.example");
}

function walk(dir: string, repoRoot: string, out: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name), repoRoot, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldIncludeFile(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    out.push(path.relative(repoRoot, abs));
  }
}

function hashContent(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex");
}

function chunkLines(filePath: string, content: string, chunkSize = 80, overlap = 20): CodeChunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];
  const chunks: CodeChunk[] = [];
  let start = 1;
  while (start <= lines.length) {
    const end = Math.min(lines.length, start + chunkSize - 1);
    const chunkText = lines.slice(start - 1, end).join("\n");
    chunks.push({
      filePath,
      startLine: start,
      endLine: end,
      content: chunkText,
      contentHash: hashContent(`${filePath}:${start}:${end}:${chunkText}`)
    });
    if (end === lines.length) break;
    start = Math.max(end - overlap + 1, start + 1);
  }
  return chunks;
}

function buildSymbolChunks(filePath: string, content: string): CodeChunk[] {
  const lines = content.split("\n");
  const regex = /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type)\s+([A-Za-z0-9_]+)/;
  const symbolLines: Array<{ line: number; symbolName: string }> = [];
  lines.forEach((line, index) => {
    const match = line.match(regex);
    if (match) {
      symbolLines.push({ line: index + 1, symbolName: match[1] });
    }
  });
  const chunks: CodeChunk[] = [];
  for (let i = 0; i < symbolLines.length; i += 1) {
    const current = symbolLines[i];
    const nextStart = symbolLines[i + 1]?.line ?? lines.length + 1;
    const startLine = current.line;
    const endLine = Math.min(lines.length, nextStart - 1);
    const contentSlice = lines.slice(startLine - 1, endLine).join("\n");
    if (!contentSlice.trim()) continue;
    chunks.push({
      filePath,
      startLine,
      endLine,
      content: contentSlice,
      symbolName: current.symbolName,
      contentHash: hashContent(`${filePath}:${current.symbolName}:${contentSlice}`)
    });
  }
  return chunks;
}

export function buildCodeChunks(repoRoot: string): CodeChunk[] {
  const filePaths: string[] = [];
  walk(repoRoot, repoRoot, filePaths);
  const chunks: CodeChunk[] = [];
  for (const relativePath of filePaths) {
    const absPath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absPath, "utf8");
    const symbolChunks = buildSymbolChunks(relativePath, content);
    chunks.push(...symbolChunks);
    chunks.push(...chunkLines(relativePath, content));
  }
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.contentHash)) return false;
    seen.add(chunk.contentHash);
    return true;
  });
}
