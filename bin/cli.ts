#!/usr/bin/env bun run

import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option } from "effect";
import { playwrightInstallCommand } from "../commands/playwright-install.js";
import { loginCommand } from "../commands/login.js";
import { logoutCommand } from "../commands/logout.js";
import { listCommand } from "../commands/list.js";
import { archiveCommand } from "../commands/archive.js";

// グローバルオプション
const originOption = Options.text("origin").pipe(
  Options.withAlias("o"),
  Options.withDescription("認証・アクセスのためのオリジンURL"),
  Options.withDefault(process.env.ZENBU_ARCHIVE_ORIGIN || ""),
  Options.optional,
);

const originApiOption = Options.text("origin-api").pipe(
  Options.withDescription("APIアクセスのためのオリジンURL"),
  Options.withDefault(process.env.ZENBU_ARCHIVE_ORIGIN_API || ""),
  Options.optional,
);

const debugHeadedOption = Options.boolean("debug-headed").pipe(
  Options.withDefault(false),
  Options.withDescription("ブラウザを表示モードで実行（デバッグ用）"),
);

// playwright-install コマンド
const playwrightInstall = Command.make("playwright-install", {}, () =>
  playwrightInstallCommand(),
).pipe(Command.withDescription("Playwrightをインストールします"));

// login コマンド
const login = Command.make(
  "login",
  { origin: originOption, originApi: originApiOption },
  ({ origin, originApi }) => loginCommand(origin, originApi),
).pipe(Command.withDescription("認証を行い、セッションを保存します"));

// logout コマンド
const logout = Command.make("logout", {}, () => logoutCommand()).pipe(
  Command.withDescription("認証情報を削除します"),
);

// list コマンド
const formatOption = Options.choice("format", ["text", "json"]).pipe(
  Options.withDefault("text" as const),
  Options.withDescription("出力形式"),
);

const list = Command.make(
  "list",
  {
    format: formatOption,
    origin: originOption,
    originApi: originApiOption,
    debugHeaded: debugHeadedOption,
  },
  ({ format, origin, originApi, debugHeaded }) =>
    listCommand(format, origin, originApi, debugHeaded),
).pipe(Command.withDescription("授業をリストします"));

// archive コマンド
const onlyOption = Options.text("only").pipe(
  Options.optional,
  Options.withDescription("指定した授業のみをアーカイブ"),
);

const excludeOption = Options.text("exclude").pipe(
  Options.optional,
  Options.withDescription("指定した授業を除外"),
);

const outputDirOption = Options.directory("output-dir").pipe(
  Options.withDefault("archives"),
  Options.withDescription("出力ディレクトリ"),
);

const archive = Command.make(
  "archive",
  {
    only: onlyOption,
    exclude: excludeOption,
    outputDir: outputDirOption,
    origin: originOption,
    originApi: originApiOption,
    debugHeaded: debugHeadedOption,
  },
  ({ only, exclude, outputDir, origin, originApi, debugHeaded }) =>
    Effect.gen(function* () {
      if (Option.isSome(only) && Option.isSome(exclude)) {
        yield* Console.error("エラー: --onlyと--excludeは同時に指定できません");
        return yield* Effect.fail("無効なオプション");
      }
      const originValue = Option.getOrElse(
        origin,
        () => process.env.ZENBU_ARCHIVE_ORIGIN || "",
      );
      if (!originValue) {
        yield* Console.error(
          "エラー: --originまたはZENBU_ARCHIVE_ORIGIN環境変数が必要です",
        );
        return yield* Effect.fail("オリジンが指定されていません");
      }
      return yield* archiveCommand(
        only,
        exclude,
        outputDir,
        debugHeaded,
        originValue,
        Option.getOrUndefined(originApi),
      );
    }),
).pipe(Command.withDescription("資料をアーカイブします"));

// メインコマンド
const mainCommand = Command.make("zenbu-archiver").pipe(
  Command.withSubcommands([playwrightInstall, login, logout, list, archive]),
);

// CLI実行
const cli = Command.run(mainCommand, {
  name: "zenbu-archiver",
  version: "1.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
