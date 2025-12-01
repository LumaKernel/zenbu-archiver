import { Console, Effect, Option, Layer, Schedule } from "effect";
import { getCourses } from "../util/course.js";
import { getChapters } from "../util/chapter.js";
import { getVideos } from "../util/videos.js";
import { getExercises, type ChapterExercise } from "../util/exercises.js";
import { BrowserSession, makeBrowserSessionLive } from "../util/auth.js";
import { Origin } from "../util/origin.js";
import { replaceSpecials } from "../util/common.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const retrySchedule = Schedule.union(
  Schedule.exponential(100),
  Schedule.recurs(15),
);

export const archiveCommand = (
  only: Option.Option<string>,
  exclude: Option.Option<string>,
  outputDir: string,
  skipDocs: boolean = false,
  skipExercises: boolean = false,
  debugHeaded: boolean = false,
  webOrigin: string,
  apiOrigin?: string,
) =>
  Effect.gen(function* () {
    const originLive = Layer.succeed(Origin, {
      webOrigin,
      apiOrigin:
        apiOrigin ||
        process.env.ZENBU_ARCHIVE_ORIGIN_API ||
        webOrigin.replace(/^(https?:\/\/)(?:www\.)?/, "$1api."),
    });
    yield* Console.log(
      "ノート: すべてのレポートが完了している授業のみが対象になります。",
    );

    // 出力ディレクトリの存在確認
    yield* Effect.tryPromise(() => fs.stat(outputDir)).pipe(
      Effect.andThen((stat) => {
        if (stat.isDirectory()) {
          return Effect.gen(function* () {
            const message = `エラー: 出力ディレクトリ '${outputDir}' は既に存在します。`;
            yield* Console.error(message);
            return yield* Effect.fail(message);
          });
        }
        return Effect.succeed(undefined);
      }),
      Effect.catchTag("UnknownException", () => Effect.succeed(undefined)), // ファイルが存在しない場合のみ無視
    );

    // 認証ファイルの存在確認
    yield* Effect.tryPromise(async () => {
      await fs.stat(".auth/session.json");
    }).pipe(
      Effect.catchAll(() =>
        Effect.gen(function* () {
          const message =
            "認証情報が見つかりません（.auth/session.json）。先にloginコマンドを実行してください。";
          yield* Console.error(message);
          return yield* Effect.fail(message);
        }),
      ),
    );

    // コース一覧を取得
    const allCourses = yield* getCourses().pipe(
      Effect.provide(originLive),
      Effect.provide(makeBrowserSessionLive(!debugHeaded)),
    );

    // 完了している授業のみフィルタ
    let courses = allCourses.filter((c) => c.reportFullFinished);

    // --only または --exclude でフィルタリング
    if (Option.isSome(only)) {
      const onlyList = only.value.split(",").map((s) => s.trim());
      courses = courses.filter((c) =>
        onlyList.some((name) => c.title.includes(name)),
      );
    } else if (Option.isSome(exclude)) {
      const excludeList = exclude.value.split(",").map((s) => s.trim());
      courses = courses.filter(
        (c) => !excludeList.some((name) => c.title.includes(name)),
      );
    }

    if (courses.length === 0) {
      yield* Console.log("ダウンロード可能な授業が見つかりませんでした。");
      return;
    }

    yield* Console.log(`${courses.length}個の授業をアーカイブします...`);

    // ブラウザセッションを取得
    const browser = yield* yield* BrowserSession;

    // 全体のエクササイズデータを格納する配列
    const allExercisesData: any[] = [];

    // 各コースをアーカイブ
    for (const course of courses) {
      const courseDir = path.join(outputDir, replaceSpecials(course.title));

      yield* Console.log(`\nアーカイブ中: ${course.title}`);
      yield* Effect.tryPromise(() => fs.mkdir(courseDir, { recursive: true }));

      // チャプター一覧を取得
      const chapters = yield* getChapters(course).pipe(
        Effect.provide(originLive),
        Effect.provide(makeBrowserSessionLive(!debugHeaded)),
      );

      for (const chapter of chapters) {
        const chapterDir = path.join(courseDir, replaceSpecials(chapter.title));
        yield* Effect.tryPromise(() =>
          fs.mkdir(chapterDir, { recursive: true }),
        );

        yield* Console.log(`  チャプター: ${chapter.title}`);

        // PDFの保存（skipDocsがfalseの場合のみ）
        if (!skipDocs) {
          // 動画情報を取得
          const videos = yield* getVideos(chapter).pipe(
            Effect.provide(originLive),
            Effect.provide(makeBrowserSessionLive(!debugHeaded)),
          );

          // 各動画のリファレンスページをPDFとして保存（並列処理）
          yield* Effect.all(
            videos.map((video, i) =>
              browser
                .usePage((page) =>
                  Effect.tryPromise(async () => {
                    await page.goto(video.referencesHref(webOrigin));
                    // wait 30ms
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await page.waitForLoadState("networkidle");
                    const pdfPath = path.join(
                      chapterDir,
                      `${(i * 2 + 1).toString().padStart(2, "0")}_${replaceSpecials(video.title)}.pdf`,
                    );
                    await page.pdf({
                      path: pdfPath,
                    });
                  }).pipe(Effect.retry(retrySchedule)),
                )
                .pipe(Effect.scoped),
            ),
            { concurrency: "unbounded" },
          );

          yield* Console.log(`    ${videos.length}個のPDFを保存しました`);
        }

        // エクササイズの取得と保存（skipExercisesがfalseの場合のみ）
        if (!skipExercises) {
          const exercises = yield* getExercises(chapter).pipe(
            Effect.provide(originLive),
            Effect.provide(makeBrowserSessionLive(!debugHeaded)),
          );

          if (exercises.length > 0) {
            // エクササイズデータを配列に追加
            for (const exercise of exercises) {
              allExercisesData.push({
                courseTitle: course.title,
                chapterTitle: chapter.title,
                exerciseTitle: exercise.title,
                exerciseId: exercise.exerciseId,
                contentAvailable: exercise.contentAvailable,
                exercise: exercise.exercise,
              });
            }
            yield* Console.log(
              `    ${exercises.length}個のエクササイズを取得しました`,
            );
          }
        }
      }
    }

    // エクササイズデータをJSONファイルとして保存
    if (!skipExercises && allExercisesData.length > 0) {
      const exercisesJsonPath = path.join(outputDir, "exercises.json");
      yield* Effect.tryPromise(() =>
        fs.writeFile(
          exercisesJsonPath,
          JSON.stringify(allExercisesData, null, 2),
          "utf-8",
        ),
      );
      yield* Console.log(
        `\n${allExercisesData.length}個のエクササイズをexercises.jsonに保存しました`,
      );
    }

    yield* Console.log(`\nアーカイブが完了しました: ${outputDir}`);
  }).pipe(Effect.provide(makeBrowserSessionLive(!debugHeaded)));
