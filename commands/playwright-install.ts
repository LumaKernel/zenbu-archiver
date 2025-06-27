import { Effect } from "effect";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const playwrightInstallCommand = () =>
  Effect.gen(function* () {
    yield* Effect.tryPromise(async () => {
      console.log("Playwright Chromium をインストール中...");
      const playwrightPath = require.resolve("playwright");
      const playwrightDir = path.dirname(playwrightPath);
      const playwrightCli = path.join(playwrightDir, "cli.js");

      return new Promise((resolve, reject) => {
        const proc = spawn(
          process.execPath,
          [playwrightCli, "install", "chromium"],
          {
            stdio: "inherit",
          },
        );

        proc.on("close", (code) => {
          if (code === 0) {
            console.log("Playwright Chromium のインストールが完了しました。");
            resolve(undefined);
          } else {
            reject(new Error(`インストールが失敗しました (code: ${code})`));
          }
        });

        proc.on("error", reject);
      });
    });
  });
