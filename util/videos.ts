import { Effect, Schema } from "effect";
import { BrowserSession } from "./auth.js";
import { CourseChapter } from "./chapter.js";
import { Origin } from "./origin.js";

// 各セクションの進捗状況
const Progress = Schema.Struct({
  total_count: Schema.Number,
  passed_count: Schema.Number,
  status: Schema.Literal("passed"),
});

// 動画セクション
const MovieSection = Schema.Struct({
  resource_type: Schema.Literal("movie"),
  material_type: Schema.Literal("main"),
  id: Schema.Number,
  title: Schema.String,
  passed: Schema.Boolean,
  textbook_info: Schema.String,
  content_available: Schema.Boolean,
  content_url: Schema.String,
  length: Schema.Number,
  playback_position: Schema.Number,
});

// 課題・レポートセクション (構造が同じため一つにまとめる)
const ExerciseOrReportSection = Schema.Struct({
  resource_type: Schema.Union(
    Schema.Literal("exercise"),
    Schema.Literal("report"),
  ),
  material_type: Schema.Literal("main"),
  id: Schema.Number,
  title: Schema.String,
  passed: Schema.Boolean,
  textbook_info: Schema.String,
  content_available: Schema.Boolean,
  content_url: Schema.String,
  done: Schema.Boolean,
  total_question: Schema.Number,
  blocked_until: Schema.NullOr(Schema.Any), // 型が不明なためAnyを使用
});

// 全てのセクションタイプのユニオン
const Section = Schema.Union(MovieSection, ExerciseOrReportSection);

// チャプター
const Chapter = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  thumbnail_url: Schema.NullOr(Schema.String),
  outline: Schema.String,
  progress: Progress,
  open_section_index: Schema.Number,
  sections: Schema.Array(Section),
});

// コースデータ全体
export const CourseData = Schema.Struct({
  subject_completed: Schema.Boolean,
  chapter: Chapter,
});

// 対応するTypeScriptの型を抽出
export type CourseDataType = Schema.Schema.Type<typeof CourseData>;

export class ChapterVideo extends Schema.Class<ChapterVideo>("ChapterVideo")({
  chapter: CourseChapter,
  videoId: Schema.String,
  numbering: Schema.NonNegativeInt,
  title: Schema.NonEmptyTrimmedString,
}) {
  // Schema.Classのフィールドを明示的に宣言
  declare readonly chapter: CourseChapter;
  declare readonly videoId: string;
  declare readonly numbering: number;
  declare readonly title: string;

  referencesHref(webOrigin: string): string {
    return `${webOrigin}/contents/courses/${this.chapter.course.courseId}/chapters/${this.chapter.chapterId}/movies/${this.videoId}/references`;
  }
}

export const getVideos = (chapter: CourseChapter) =>
  Effect.gen(function* () {
    const { webOrigin, apiOrigin } = yield* Origin;
    const browser = yield* yield* BrowserSession;
    const videos = yield* browser.usePage((page) =>
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
        );
        const courseData = decode(data);

        return courseData.chapter.sections
          .map((section) => {
            if (
              section.resource_type === "movie" &&
              section.material_type === "main"
            ) {
              return new ChapterVideo({
                chapter,
                videoId: String(section.id),
                numbering: section.id, // idを番号として使用
                title: section.title,
              });
            }
            return null;
          })
          .filter((v) => v !== null);
      }),
    );
    return videos;
  }).pipe(Effect.scoped);
