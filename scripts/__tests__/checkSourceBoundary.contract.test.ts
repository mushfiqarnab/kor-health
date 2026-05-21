import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/check-source-boundary.ps1");

function createTempSource(content: string): string {
  const tempDir = join(
    tmpdir(),
    `kor-boundary-scan-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );

  mkdirSync(tempDir, { recursive: true });

  const sourcePath = join(tempDir, "source.ts");
  writeFileSync(sourcePath, content, "utf8");

  return sourcePath;
}

function cleanupTempSource(sourcePath: string): void {
  const parentDir = resolve(sourcePath, "..");
  rmSync(parentDir, { recursive: true, force: true });
}

function runBoundaryScan(args: readonly string[]): {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

describe("Source boundary scan script contract", () => {
  it("exists as a PowerShell validation script without modifying package scripts", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).toContain("param");
    expect(source).toContain("SourcePath");
    expect(source).toContain("RequiredToken");
    expect(source).toContain("ForbiddenToken");
    expect(source).toContain("MISSING_REQUIRED");
    expect(source).toContain("FOUND_FORBIDDEN");

    const packageJson = readFileSync(
      resolve(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).toContain('"test": "vitest"');
    expect(packageJson).not.toContain("check-source-boundary");
  });

  it("exits successfully with no output when required tokens exist and forbidden tokens are absent", () => {
    const sourcePath = createTempSource(`
      export function safeBoundary(): string {
        return "prepareLocalDocumentSave";
      }

      export const approvedToken = "LocalDocumentSaveOutcome";
    `);

    try {
      const result = runBoundaryScan([
        "-SourcePath",
        sourcePath,
        "-RequiredToken",
        "prepareLocalDocumentSave",
        "LocalDocumentSaveOutcome",
        "-ForbiddenToken",
        "supabase",
        "watermelondb",
        "openai",
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    } finally {
      cleanupTempSource(sourcePath);
    }
  });

  it("prints MISSING_REQUIRED and exits non-zero when required tokens are absent", () => {
    const sourcePath = createTempSource(`
      export const onlyToken = "LocalDocumentSaveOutcome";
    `);

    try {
      const result = runBoundaryScan([
        "-SourcePath",
        sourcePath,
        "-RequiredToken",
        "prepareLocalDocumentSave",
        "LocalDocumentSaveOutcome",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain(
        "MISSING_REQUIRED: prepareLocalDocumentSave",
      );
      expect(result.stdout).not.toContain(
        "MISSING_REQUIRED: LocalDocumentSaveOutcome",
      );
      expect(result.stderr).toBe("");
    } finally {
      cleanupTempSource(sourcePath);
    }
  });

  it("prints FOUND_FORBIDDEN and exits non-zero when forbidden tokens are present", () => {
    const sourcePath = createTempSource(`
      export const unsafeCloudToken = "supabase";
      export const unsafeAiToken = "OpenAI";
    `);

    try {
      const result = runBoundaryScan([
        "-SourcePath",
        sourcePath,
        "-ForbiddenToken",
        "supabase",
        "openai",
        "watermelondb",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("FOUND_FORBIDDEN: supabase");
      expect(result.stdout).toContain("FOUND_FORBIDDEN: openai");
      expect(result.stdout).not.toContain("FOUND_FORBIDDEN: watermelondb");
      expect(result.stderr).toBe("");
    } finally {
      cleanupTempSource(sourcePath);
    }
  });

  it("can report required and forbidden failures in the same run", () => {
    const sourcePath = createTempSource(`
      export const unsafeStorageToken = "sqlite";
    `);

    try {
      const result = runBoundaryScan([
        "-SourcePath",
        sourcePath,
        "-RequiredToken",
        "prepareLocalDocumentSave",
        "-ForbiddenToken",
        "sqlite",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain(
        "MISSING_REQUIRED: prepareLocalDocumentSave",
      );
      expect(result.stdout).toContain("FOUND_FORBIDDEN: sqlite");
      expect(result.stderr).toBe("");
    } finally {
      cleanupTempSource(sourcePath);
    }
  });

  it("fails closed when SourcePath is missing or unreadable", () => {
    const missingPath = resolve(
      process.cwd(),
      "scripts/__tests__/missing-source-file.ts",
    );

    const result = runBoundaryScan([
      "-SourcePath",
      missingPath,
      "-RequiredToken",
      "prepareLocalDocumentSave",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("SOURCE_UNREADABLE:");
    expect(result.stdout).toContain(missingPath);
    expect(result.stderr).toBe("");
  });

  it("keeps the script free from runtime infrastructure, cloud, sync, AI, OCR, UI, and clinical metadata assumptions", () => {
    const source = readFileSync(scriptPath, "utf8").toLowerCase();

    const forbiddenScriptTokens = [
      "supabase",
      "watermelondb",
      "sqlite",
      "expo",
      "securestore",
      "react-native",
      "openai",
      "anthropic",
      "ocr",
      "doctor-portal",
      "patient-portal",
      "bmdc",
      "diagnosis",
      "prescription",
      "hba1c",
      "upload",
      "download",
      "fetch",
      "invoke-webrequest",
      "start-process",
      "set-content",
      "add-content",
      "remove-item",
      "new-item",
      "copy-item",
      "move-item",
    ];

    for (const token of forbiddenScriptTokens) {
      expect(source).not.toContain(token);
    }
  });
});
