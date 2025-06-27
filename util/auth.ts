import { Context, Effect, Layer, Scope } from "effect";
import { makeBrowser } from "./common.js";
import * as fs from "node:fs";
import * as path from "node:path";
import type { BrowserContextOptions, Page } from "playwright";
import type { UnknownException } from "effect/Cause";
import { Origin } from "./origin.js";

export const authFile = ".auth/session.json";

export const signIn = () =>
  Effect.gen(function* () {
    const { webOrigin } = yield* Origin;
    // ログイン時は常に新しいブラウザコンテキストを使用
    const browser = yield* Effect.tryPromise(() => makeBrowser(false));
    const context = yield* Effect.tryPromise(() => browser.newContext());
    const page = yield* Effect.tryPromise(() => context.newPage());
    yield* Effect.tryPromise(() => page.goto(`${webOrigin}/login`));

    // 画面上でログインして、初回のエンターキーを押してください:
    console.log(
      "画面上でログインしたあと、こちらでエンターキーを押してください:",
    );
    yield* Effect.tryPromise(
      () => new Promise((resolve) => process.stdin.once("data", resolve)),
    );

    yield* Effect.tryPromise(() =>
      fs.promises.mkdir(path.dirname(authFile), { recursive: true }),
    );
    yield* Effect.tryPromise(() => context.storageState({ path: authFile }));

    yield* Effect.tryPromise(() => page.close());
    yield* Effect.tryPromise(() => context.close());
    yield* Effect.tryPromise(() => browser.close());
  });

const makeBrowserSession = async (headless: boolean) => {
  const browser = await makeBrowser(headless);

  // 認証ファイルが存在するかチェック
  let contextOptions: BrowserContextOptions = {};
  try {
    await fs.promises.access(authFile, fs.constants.F_OK);
    contextOptions.storageState = authFile;
  } catch {
    // ファイルが存在しない場合は無視
  }

  const context = await browser.newContext(contextOptions);
  return context;
};

export class BrowserSession extends Context.Tag("BrowserSession")<
  BrowserSession,
  Effect.Effect<
    {
      // readonly makePage: Effect.Effect<Page, UnknownException, Scope.Scope>;
      readonly usePage: <T, E, R>(
        pageUser: (page: Page) => Effect.Effect<T, E, R>,
      ) => Effect.Effect<T, UnknownException | E, Scope.Scope | R>;
    },
    UnknownException
  >
>() {}
export const makeBrowserSessionLive = (headless: boolean) =>
  Layer.succeed(
    BrowserSession,
    Effect.gen(function* () {
      const semaphore = yield* Effect.makeSemaphore(5);
      const browser = yield* Effect.tryPromise(() =>
        makeBrowserSession(headless),
      );

      return {
        makePage: Effect.tryPromise(() => browser.newPage()).pipe(
          Effect.andThen((page) =>
            Effect.gen(function* () {
              yield* Effect.addFinalizer(() =>
                Effect.promise(() => page.close()),
              );
              return page;
            }),
          ),
        ),
        usePage: <T, E, R>(pageUser: (page: Page) => Effect.Effect<T, E, R>) =>
          Effect.tryPromise(() => browser.newPage())
            .pipe(
              Effect.andThen((page) =>
                Effect.gen(function* () {
                  yield* Effect.addFinalizer(() =>
                    Effect.promise(() => page.close()),
                  );
                  return yield* pageUser(page);
                }),
              ),
            )
            .pipe(Effect.scoped)
            .pipe(semaphore.withPermits(1)),
      };
    }),
  );
