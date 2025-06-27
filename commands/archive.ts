import { Console, Effect, Option, Layer } from "effect";
import { getCourses } from "../util/course.js";
import { getChapters } from "../util/chapter.js";
import { getVideos } from "../util/videos.js";
import { BrowserSession, makeBrowserSessionLive } from "../util/auth.js";
import { Origin } from "../util/origin.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const replaceSpecials = (str: string) =>
  str
    .replace(/\?/g, "？")
    .replace(/</g, "＜")
    .replace(/>/g, "＞")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/,/g, "，")
    .replace(/!/g, "！")
    .replace(/:/g, "：")
    .replace(/;/g, "；")
    .replace(/\\/g, "＼")
    .replace(/\//g, "／")
    .replace(/\|/g, "｜")
    .replace(/[*]/g, "＊")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F]/g, "");

export const archiveCommand = (
  only: Option.Option<string>,
  exclude: Option.Option<string>,
  outputDir: string,
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
            yield* Console.error(
              `エラー: 出力ディレクトリ '${outputDir}' は既に存在します。`,
            );
            return yield* Effect.fail("ディレクトリが既に存在します");
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
          yield* Console.error(
            "認証情報が見つかりません。先にloginコマンドを実行してください。",
          );
          return yield* Effect.fail("認証されていません");
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
        onlyList.some((name) =>
          `${c.year}年${c.term}:${c.title}`.includes(name),
        ),
      );
    } else if (Option.isSome(exclude)) {
      const excludeList = exclude.value.split(",").map((s) => s.trim());
      courses = courses.filter(
        (c) =>
          !excludeList.some((name) =>
            `${c.year}年${c.term}:${c.title}`.includes(name),
          ),
      );
    }

    if (courses.length === 0) {
      yield* Console.log("ダウンロード可能な授業が見つかりませんでした。");
      return;
    }

    yield* Console.log(`${courses.length}個の授業をアーカイブします...`);

    // ブラウザセッションを取得
    const browser = yield* yield* BrowserSession;

    // 各コースをアーカイブ
    for (const course of courses) {
      const courseName = `${course.year}年${course.term}_${course.title}`;
      const courseDir = path.join(outputDir, replaceSpecials(course.title));

      yield* Console.log(`\nアーカイブ中: ${courseName}`);
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
                }),
              )
              .pipe(Effect.scoped),
          ),
          { concurrency: "unbounded" },
        );

        yield* Console.log(`    ${videos.length}個のPDFを保存しました`);
      }
    }

    yield* Console.log(`\nアーカイブが完了しました: ${outputDir}`);
  }).pipe(Effect.provide(makeBrowserSessionLive(!debugHeaded)));
