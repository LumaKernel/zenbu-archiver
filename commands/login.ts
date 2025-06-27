import { Console, Effect, Option } from "effect";
import { signIn } from "../util/auth.js";
import { makeOriginLive, validateOrigin } from "../util/origin-live.js";

export const loginCommand = (
  origin: Option.Option<string>,
  originApi: Option.Option<string>,
) =>
  Effect.gen(function* () {
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

    return yield* signIn().pipe(Effect.provide(originLive));
  });
