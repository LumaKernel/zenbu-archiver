import { Console, Effect, Option, Schema } from "effect";
import { Course, getCourses } from "../util/course.js";
import { makeBrowserSessionLive } from "../util/auth.js";
import { makeOriginLive, validateOrigin } from "../util/origin-live.js";
import * as fs from "node:fs/promises";

export const listCommand = (
  format: "text" | "json",
  origin: Option.Option<string>,
  originApi: Option.Option<string>,
  debugHeaded: boolean,
) =>
  Effect.gen(function* () {
    // 認証ファイルの存在確認
    yield* Effect.tryPromise(async () => {
      await fs.stat(".auth/session.json");
    }).pipe(
      Effect.catchAll(() =>
        Effect.gen(function* () {
          yield* Console.error(
            "認証情報が見つかりません。先にloginコマンドを実行してください。",
          );
          return yield* Effect.fail("認証されていません");
        }),
      ),
    );

    yield* Effect.try(() => validateOrigin(origin)).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(
            "エラー: --originまたはZENBU_ARCHIVE_ORIGIN環境変数が必要です",
          );
          return yield* Effect.fail("オリジンが指定されていません");
        }),
      ),
    );

    const originLive = makeOriginLive(origin, originApi);

    // コース一覧を取得
    const courses = yield* getCourses().pipe(
      Effect.provide(originLive),
      Effect.provide(makeBrowserSessionLive(!debugHeaded)),
    );

    if (format === "json") {
      // JSON形式で出力
      const jsonData = yield* Effect.all(
        courses.map((course) => Schema.encode(Course)(course)),
      );
      yield* Console.log(JSON.stringify(jsonData, null, 2));
    } else {
      if (courses.length > 0) {
        const completed = courses.filter((course) => course.reportFullFinished);
        const ongoing = courses.filter((course) => !course.reportFullFinished);
        yield* Console.log("[完了(ダウンロード可)]");
        if (completed.length > 0) {
          for (const course of completed) {
            yield* Console.log(
              `${course.year}年${course.term}:${course.title} (レポート進捗: ${course.reportSubmittedCount}/${course.reportCount})`,
            );
          }
        }
        if (ongoing.length > 0) {
          yield* Console.log("[進行中(ダウンロード不可)]");
          for (const course of ongoing) {
            yield* Console.log(
              `${course.year}年${course.term}:${course.title} (レポート進捗: ${course.reportSubmittedCount}/${course.reportCount})`,
            );
          }
        }
      } else {
        yield* Console.log("コースが見つかりませんでした。");
      }
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error(`リスト取得中にエラーが発生しました: ${error}`);
        yield* Console.log(
          "playwrightがインストールされていない場合は、playwright-installコマンドを実行してください。",
        );
        return yield* Effect.fail(error);
      }),
    ),
  );
