// deno-lint-ignore-file no-import-prefix
import { ensureDir } from "jsr:@std/fs@^1.0.19";
import { join, relative } from "jsr:@std/path@^1.1.2";

const DEFAULT_TARGETS = [
  "x86_64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
];

const TARGETS =
  (Deno.env.get("JPHW_BUILD_TARGETS")?.split(",") ?? DEFAULT_TARGETS)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

if (TARGETS.length === 0) {
  console.error("No targets specified for build.");
  Deno.exit(1);
}

const OUTPUT_DIR = Deno.env.get("JPHW_BUILD_DIR") ?? "dist";
const ENTRYPOINT = "apps/cli/src/index.ts";

const cwd = Deno.cwd();
const outputDir = join(cwd, OUTPUT_DIR);
await ensureDir(outputDir);

const decoder = new TextDecoder();

for (const target of TARGETS) {
  const suffix = target.includes("windows") ? ".exe" : "";
  const output = join(outputDir, `jphw-${target}${suffix}`);

  console.log(`Compiling ${relative(cwd, output)} for ${target}...`);

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

  if (stdout.length) {
    console.log(decoder.decode(stdout));
  }
  if (code !== 0) {
    console.error(decoder.decode(stderr));
    console.error(`Failed to compile for target ${target}.`);
    Deno.exit(code);
  }

  console.log(`Created ${relative(cwd, output)}\n`);
}
