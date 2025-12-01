import { Effect, Schema } from "effect";
import type { Locator } from "playwright";
import { BrowserSession } from "./auth.js";
import { Origin } from "./origin.js";

export class Course extends Schema.Class<Course>("Course")({
  title: Schema.NonEmptyTrimmedString,
  courseId: Schema.String,
  reportCount: Schema.NonNegative,
  reportSubmittedCount: Schema.NonNegative,
}) {
  courseHref(webOrigin: string): string {
    return `${webOrigin}/courses/${this.courseId}`;
  }
  get reportFullFinished(): boolean {
    return this.reportCount === this.reportSubmittedCount;
  }
}

const parseLocator = async (locator: Locator): Promise<Course | null> => {
  const label = await locator.getAttribute("aria-label");
  if (label == null) return null;

  // 最初の ":" より前がタイトル
  const colonIndex = label.indexOf(":");
  if (colonIndex === -1) return null;
  const title = label.slice(0, colonIndex).trim();
  if (!title) return null;

  const href = await locator.getAttribute("href");
  if (href == null) return null;
  const courseId = href.split("/").pop() || null;
  if (courseId == null) return null;

  // <figure aria-label="レポート15個のうち0個が完了" class="sc-aXZVg dKubqp"><div class="sc-aXZVg sc-gEvEer ZTsjX fteAEG">

  const reportCountLocator = locator.locator("figure[aria-label]");
  const reportCountText = await reportCountLocator.getAttribute("aria-label");
  let reportCount = 0;
  let reportSubmittedCount = 0;
  if (reportCountText) {
    const reportPat = /レポート(\d+)個のうち(\d+)個が完了/;
    const [, total, submitted] = reportCountText.match(reportPat) || [];
    if (total && submitted) {
      reportCount = parseInt(total, 10);
      reportSubmittedCount = parseInt(submitted, 10);
    }
  }

  return new Course({
    title,
    reportCount,
    reportSubmittedCount,
    courseId,
  });
};

export const getCourses = () =>
  Effect.gen(function* () {
    const { webOrigin } = yield* Origin;
    const browser = yield* yield* BrowserSession;
    const courses = yield* browser.usePage((page) =>
      Effect.gen(function* () {
        const els = yield* Effect.tryPromise(async () => {
          await page.goto(`${webOrigin}/my_course?tab=zen_univ`);
          return await page
            .locator("ul > li > a")
            .filter({ visible: true })
            .all();
        });
        const courses = yield* Effect.succeed(els)
          .pipe(
            Effect.andThen((locators) =>
              locators.map((locator) => parseLocator(locator)),
            ),
          )
          .pipe(Effect.andThen((ps) => Promise.all(ps)))
          .pipe(Effect.andThen((es) => es.filter((e) => e != null)));
        return courses;
      }),
    );
    return courses;
  }).pipe(Effect.scoped);
