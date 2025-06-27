import { Console, Effect } from "effect";
import * as fs from "node:fs/promises";

export const logoutCommand = () =>
  Effect.gen(function* () {
    yield* Console.log("認証情報ファイルを削除します。");
    yield* Console.log(
      "続ける場合は Y と入れてエンターしてください。(yes/No):",
    );

    // ユーザー入力を待つ
    const input = yield* Effect.tryPromise(
      () =>
        new Promise<string>((resolve) => {
          process.stdin.once("data", (data) => {
            resolve(data.toString().trim().toLowerCase());
          });
        }),
    );

    if (input === "y" || input === "yes") {
      // .authフォルダを削除
      yield* Effect.tryPromise({
        try: () => fs.rm(".auth", { recursive: true, force: true }),
        catch: (error: any) => error,
      }).pipe(
        Effect.andThen(() => Console.log("認証情報を削除しました。")),
        Effect.catchIf(
          (error: any) => error.code === "ENOENT",
          () => Console.log("認証情報が見つかりませんでした。"),
        ),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Console.error(`削除中にエラーが発生しました: ${error}`);
            return yield* Effect.fail(error);
          }),
        ),
      );
    } else {
      yield* Console.log("キャンセルされました。");
    }
  });
