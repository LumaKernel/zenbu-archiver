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

const parseLocator = async (locator: Locator): Promise<Course> => {
  // h4 heading要素からタイトルを取得（aria-labelからheading内テキストに仕様変更）
  const headingLocator = locator.locator("h4");
  const headingText = await headingLocator.textContent();
  if (headingText == null) {
    throw new Error("h4要素のテキストが取得できない");
  }

  // 最初の ":" より前がタイトル（例: "解析学2:【選択】オンデマンド" → "解析学2"）
  const colonIndex = headingText.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(`タイトルにコロンが含まれていない: ${headingText}`);
  }
  const title = headingText.slice(0, colonIndex).trim();
  if (!title) {
    throw new Error(`タイトルが空: ${headingText}`);
  }

  const href = await locator.getAttribute("href");
  if (href == null) {
    throw new Error("href属性が取得できない");
  }
  const courseId = href.split("/").pop();
  if (courseId == null || courseId === "") {
    throw new Error(`courseIdが取得できない: ${href}`);
  }

  // レポート進捗を取得（figure要素から）
  const reportCountLocator = locator.locator("figure");
  const figureCount = await reportCountLocator.count();
  if (figureCount === 0) {
    throw new Error("figure要素が見つからない");
  }

  // aria-labelを試す（"レポート15個のうち15個が完了" または "習熟度テスト4個のうち0個が完了" 形式）
  const ariaLabel = await reportCountLocator.first().getAttribute("aria-label");
  // レポート/習熟度テスト/その他の形式に対応
  const reportPat =
    /(?:レポート|習熟度テスト|テスト)(\d+)個のうち(\d+)個が完了/;

  if (ariaLabel) {
    const match = ariaLabel.match(reportPat);
    const total = match?.[1];
    const submitted = match?.[2];
    if (total === undefined || submitted === undefined) {
      throw new Error(`レポート進捗のパースに失敗 (aria-label): ${ariaLabel}`);
    }
    return new Course({
      title,
      reportCount: parseInt(total, 10),
      reportSubmittedCount: parseInt(submitted, 10),
      courseId,
    });
  }

  // aria-labelがなければテキストコンテンツからパース（"レポート 15 / 15" 形式）
  const textContent = await reportCountLocator.first().textContent();
  if (textContent == null) {
    throw new Error("figure要素のテキストが取得できない");
  }
  // レポート/習熟度テスト/その他の形式に対応
  const textPat = /(?:レポート|習熟度テスト|テスト)\s*(\d+)\s*\/\s*(\d+)/;
  const match = textContent.match(textPat);
  const submittedStr = match?.[1];
  const totalStr = match?.[2];
  if (submittedStr === undefined || totalStr === undefined) {
    throw new Error(`レポート進捗のパースに失敗 (textContent): ${textContent}`);
  }

  return new Course({
    title,
    reportCount: parseInt(totalStr, 10),
    reportSubmittedCount: parseInt(submittedStr, 10),
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
          // SPAのタブ切り替え完了を待機
          await page.waitForLoadState("networkidle");

          // 「履修科目」タブをクリック（テキストで検索）
          const zenUnivTabButton = page.locator("text=履修科目").first();
          await zenUnivTabButton.waitFor({ state: "visible" });
          await zenUnivTabButton.click();
          // タブコンテンツが更新されるまで待機
          await page.waitForLoadState("networkidle");

          // コースナビゲーションが表示されるまで待機
          await page
            .locator('nav[aria-label="コース一覧"]')
            .waitFor({ state: "visible" });

          // コースのリンクはh4とfigure要素を持ち、hrefが/courses/で始まる
          const courseNavLocator = page.locator(
            'nav[aria-label="コース一覧"] ul > li > a:has(h4):has(figure)[href^="/courses/"]',
          );
          const count = await courseNavLocator.count();
          // コースがない場合は空配列を返す
          if (count === 0) {
            return [];
          }
          return await courseNavLocator.filter({ visible: true }).all();
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
