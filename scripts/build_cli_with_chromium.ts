// deno-lint-ignore-file no-import-prefix
import { emptyDir, ensureDir } from "jsr:@std/fs@^1.0.19";
import { dirname, join, relative } from "jsr:@std/path@^1.1.2";

const hostTarget = Deno.build.target;
const DEFAULT_TARGETS = [hostTarget];

const TARGETS =
  (Deno.env.get("JPHW_BUILD_TARGETS")?.split(",") ?? DEFAULT_TARGETS)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

if (TARGETS.length === 0) {
  console.error("No targets specified for build.");
  Deno.exit(1);
}

const crossTargets = TARGETS.filter((target) => target !== hostTarget);
if (crossTargets.length > 0) {
  console.warn(
    `Warning: Chromium will only be bundled for the host target ${hostTarget}. ` +
      `Manual browser installation may be required for: ${
        crossTargets.join(", ")
      }.`,
  );
}

const OUTPUT_DIR = Deno.env.get("JPHW_BUILD_DIR") ?? "dist";
const ENTRYPOINT = "apps/cli/src/index.ts";

const cwd = Deno.cwd();
const outputDir = join(cwd, OUTPUT_DIR);
await ensureDir(outputDir);

const decoder = new TextDecoder();

interface BuildArtifact {
  target: string;
  output: string;
}

const buildArtifacts: BuildArtifact[] = [];

for (const target of TARGETS) {
  const artifact = await compileTarget(target);
  buildArtifacts.push(artifact);
}

await bundleChromium(buildArtifacts);

async function compileTarget(target: string): Promise<BuildArtifact> {
  const suffix = target.includes("windows") ? ".exe" : "";
  const output = join(outputDir, `jphw-${target}${suffix}`);

  console.log(
    `Compiling ${
      relative(cwd, output)
    } for ${target} with bundled Chromium support...`,
  );

  const command = new Deno.Command("deno", {
    args: [
      "compile",
      "--allow-env",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-run",
      "--allow-sys",
      "--target",
      target,
      "--output",
      output,
      ENTRYPOINT,
    ],
  });

  const { code, stdout, stderr } = await command.output();

  const stdoutText = decoder.decode(stdout).trim();
  if (stdoutText.length > 0) {
    console.log(stdoutText);
  }

  const stderrText = decoder.decode(stderr).trim();
  if (stderrText.length > 0) {
    console.error(stderrText);
  }

  if (code !== 0) {
    console.error(`Failed to compile for target ${target}.`);
    Deno.exit(code);
  }

  console.log(`Created ${relative(cwd, output)}\n`);

  return { target, output };
}

async function bundleChromium(artifacts: BuildArtifact[]): Promise<void> {
  const processedDirs = new Set<string>();

  for (const artifact of artifacts) {
    const binaryDir = dirname(artifact.output);
    if (processedDirs.has(binaryDir)) {
      continue;
    }
    processedDirs.add(binaryDir);

    const bundleRoot = join(binaryDir, "ms-playwright");
    console.log(
      `Installing bundled Chromium into ${
        relative(cwd, bundleRoot)
      } for ${artifact.target}...`,
    );

    await ensureDir(bundleRoot);
    await emptyDir(bundleRoot);

    const install = new Deno.Command("deno", {
      args: ["run", "-A", "npm:playwright", "install", "chromium"],
      env: {
        PLAYWRIGHT_BROWSERS_PATH: bundleRoot,
      },
    });

    const { code, stdout, stderr } = await install.output();

    const stdoutText = decoder.decode(stdout).trim();
    if (stdoutText.length > 0) {
      console.log(stdoutText);
    }

    const stderrText = decoder.decode(stderr).trim();
    if (stderrText.length > 0) {
      console.error(stderrText);
    }

    if (code !== 0) {
      console.error("Failed to install Chromium using Playwright.");
      Deno.exit(code);
    }

    if (!await hasChromiumBundle(bundleRoot)) {
      console.error(
        `Chromium bundle not found at ${
          relative(cwd, bundleRoot)
        } after installation.`,
      );
      Deno.exit(1);
    }

    console.log(`Bundled Chromium at ${relative(cwd, bundleRoot)}\n`);
  }
}

async function hasChromiumBundle(root: string): Promise<boolean> {
  try {
    for await (const entry of Deno.readDir(root)) {
      if (entry.isDirectory && entry.name.startsWith("chromium-")) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
