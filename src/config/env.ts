import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const projectRoot = new URL(
  import.meta.url.endsWith(".ts") ? "../../" : "../../../",
  import.meta.url,
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test"]).default("development"),
  PORT: z
    .string()
    .regex(/^\d+$/, "Port must be an integer between 0 and 65535")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535))
    .default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .optional(),
});

export function loadEnvironment(
  root = projectRoot,
  externalEnvironment: NodeJS.ProcessEnv = process.env,
) {
  const fileEnvironment: Record<string, string> = {};
  const baseFile = dotenv.config({
    path: fileURLToPath(new URL(".env", root)),
    processEnv: fileEnvironment,
    quiet: true,
  });
  if (baseFile.error && baseFile.error.code !== "ENOENT") {
    throw baseFile.error;
  }

  const mode = environmentSchema.shape.NODE_ENV.parse(
    externalEnvironment.NODE_ENV ?? fileEnvironment.NODE_ENV,
  );
  const modeFile = dotenv.config({
    path: fileURLToPath(new URL(`.env.${mode}`, root)),
    processEnv: fileEnvironment,
    override: true,
    quiet: true,
  });
  if (modeFile.error && modeFile.error.code !== "ENOENT") {
    throw modeFile.error;
  }

  const parsed = environmentSchema.parse({
    ...fileEnvironment,
    ...externalEnvironment,
    NODE_ENV: mode,
  });

  return {
    ...parsed,
    LOG_LEVEL:
      parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "test" ? "silent" : "debug"),
  };
}

export const env = loadEnvironment();
// The Knex CLI selects its profile after importing the configuration.
process.env.NODE_ENV ??= env.NODE_ENV;
