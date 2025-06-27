import { Effect, Schema } from "effect";
import type { Locator } from "playwright";
import { BrowserSession } from "./auth.js";
import { Course } from "./course.js";
import { Origin } from "./origin.js";

export class CourseChapter extends Schema.Class<CourseChapter>("CourseChapter")(
  {
    course: Course,
    chapterId: Schema.String,
    title: Schema.NonEmptyTrimmedString,
  },
) {
  // Schema.Classのフィールドを明示的に宣言
  declare readonly course: Course;
  declare readonly chapterId: string;
  declare readonly title: string;

  chapterHref(webOrigin: string): string {
    return `${webOrigin}/courses/${this.course.courseId}/chapters/${this.chapterId}`;
  }
}

const parseLocator = async (
  course: Course,
  locator: Locator,
): Promise<CourseChapter | null> => {
  // <a style="gap: 12px;" aria-label="01. 統計学の世界へようこそ！" aria-disabled="false" class="sc-3cy6js-0 fksKsb" href="/courses/1100072117/chapters/1801555038">

  const label = await locator.getAttribute("aria-label");
  if (label == null) return null;

  const href = await locator.getAttribute("href");
  if (href == null) return null;
  const chapterId = href.split("/")[4];
  if (chapterId == null) return null;

  return new CourseChapter({
    course,
    title: label.trim(),
    chapterId,
  });
};

export const getChapters = (course: Course) =>
  Effect.gen(function* () {
    const { webOrigin } = yield* Origin;
    const browser = yield* yield* BrowserSession;
    const chapters = yield* browser.usePage((page) =>
      Effect.gen(function* () {
        const els = yield* Effect.tryPromise(async () => {
          await page.goto(course.courseHref(webOrigin));
          return await page
            .locator("ul > li > a")
            .filter({ visible: true })
            .all();
        });

        const chapters = yield* Effect.succeed(els)
          .pipe(
            Effect.andThen((locators) =>
              locators.map((locator) => parseLocator(course, locator)),
            ),
          )
          .pipe(Effect.andThen((ps) => Promise.all(ps)))
          .pipe(Effect.andThen((es) => es.filter((e) => e != null)));
        return chapters;
      }),
    );
    return chapters;
  }).pipe(Effect.scoped);
