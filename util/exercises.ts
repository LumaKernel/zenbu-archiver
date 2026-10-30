import { Console, Effect, Schedule, Schema } from "effect";
import { BrowserSession } from "./auth.js";
import { CourseChapter } from "./chapter.js";
import { Origin } from "./origin.js";
import { CourseData, type CourseDataType } from "./videos.js";
import { parseExerciseHTML, type Exercise } from "./exercise-parser.js";

const retrySchedule = Schedule.union(
  Schedule.exponential(100),
  Schedule.recurs(6),
);

// 選択肢問題のスキーマ
const ChoiceExerciseSchema = Schema.Struct({
  type: Schema.Literal("choice"),
  question: Schema.String,
  choices: Schema.Array(Schema.String),
  answerIndex: Schema.Number,
  explanation: Schema.NullOr(Schema.String),
});

// 自由入力問題のスキーマ
const WordExerciseSchema = Schema.Struct({
  type: Schema.Literal("word"),
  question: Schema.String,
  correctAnswer: Schema.String,
  explanation: Schema.NullOr(Schema.String),
});

// discriminated union スキーマ
const ExerciseSchema = Schema.Union(ChoiceExerciseSchema, WordExerciseSchema);

export class ChapterExercise extends Schema.Class<ChapterExercise>(
  "ChapterExercise",
)({
  chapter: CourseChapter,
  exerciseId: Schema.String,
  numbering: Schema.NonNegativeInt,
  title: Schema.NonEmptyTrimmedString,
  exercise: Schema.NullOr(ExerciseSchema),
  contentAvailable: Schema.Boolean,
}) {
  declare readonly chapter: CourseChapter;
  declare readonly exerciseId: string;
  declare readonly numbering: number;
  declare readonly title: string;
  declare readonly exercise: Exercise | null;
  declare readonly contentAvailable: boolean;
}

export const getExercises = (chapter: CourseChapter) =>
  Effect.gen(function* () {
    const { webOrigin, apiOrigin } = yield* Origin;
    const browser = yield* yield* BrowserSession;
    const exercises = yield* browser.usePage((page) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise(() =>
          page.goto(chapter.chapterHref(webOrigin)),
        );

        const decode = Schema.decodeUnknownSync(CourseData);
        const data = yield* Effect.tryPromise(() =>
          page.evaluate(
            async ([courseId, chapterId, apiOrigin]) => {
              const apiUrl = `${apiOrigin}/v2/material/courses/${courseId}/chapters/${chapterId}?revision=1`;
              const res = await fetch(apiUrl, {
                credentials: "include",
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0",
                  Accept: "application/json, text/plain, */*",
                  "Accept-Language": "en-US,en;q=0.5",
                  "Sec-Fetch-Dest": "empty",
                  "Sec-Fetch-Mode": "cors",
                  "Sec-Fetch-Site": "same-site",
                },
                referrer: (globalThis as any).location.origin,
                method: "GET",
                mode: "cors",
              });
              return await res.json();
            },
            [chapter.course.courseId, chapter.chapterId, apiOrigin] as const,
          ),
        ).pipe(Effect.retry(retrySchedule));
        const courseData = decode(data);

        // エクササイズセクションをフィルタ
        const exerciseSections = courseData.chapter.sections.filter(
          (section) =>
            section.resource_type === "exercise" &&
            section.material_type === "main",
        );

        // 各エクササイズのHTMLを取得してパース
        const exercisesPromises = exerciseSections.map((section) =>
          Effect.gen(function* () {
            if (section.resource_type !== "exercise") {
              throw new Error("Unexpected section type");
            }
            let exerciseData: Exercise | null = null;

            // content_availableをチェック
            if (!section.content_available) {
              yield* Console.warn(
                `警告: エクササイズ「${section.title}」のコンテンツが利用できません`,
              );
            } else {
              // HTMLコンテンツをフェッチ（page.evaluate内で実行）
              try {
                const html = yield* Effect.tryPromise(() =>
                  page.evaluate(async (contentUrl) => {
                    const res = await fetch(contentUrl, {
                      credentials: "include",
                      headers: {
                        Accept: "text/html,application/xhtml+xml",
                        "Accept-Language": "en-US,en;q=0.5",
                      },
                    });
                    return await res.text();
                  }, section.content_url),
                );

                // HTMLをパース
                exerciseData = parseExerciseHTML(html);
              } catch (error) {
                yield* Console.warn(
                  `警告: エクササイズ「${section.title}」のHTMLの取得またはパースに失敗しました`,
                );
              }
            }

            return new ChapterExercise({
              chapter,
              exerciseId: section.id.toString(),
              numbering: section.id,
              title: section.title,
              exercise: exerciseData,
              contentAvailable: section.content_available,
            });
          }),
        );

        // すべてのエクササイズを並列で処理
        const exercises = yield* Effect.all(exercisesPromises, {
          concurrency: "unbounded",
        });
        return exercises;
      }),
    );
    return exercises;
  }).pipe(Effect.scoped);
