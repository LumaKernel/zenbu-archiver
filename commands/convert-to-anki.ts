import { Console, Effect, Schema } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { convertToAnkiFormat, ExercisesArray } from "../util/anki-converter.js";

export const convertToAnkiCommand = (
  inputFile: string = "./archives/exercises.json",
  outputFile?: string,
) =>
  Effect.gen(function* () {
    // 入力ファイルの存在確認
    const fileExists = yield* Effect.tryPromise({
      try: () => fs.stat(inputFile),
      catch: () => new Error(`入力ファイルが見つかりません: ${inputFile}`),
    }).pipe(
      Effect.map(() => true),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    // JSONファイルの読み込み
    const jsonContent = yield* Effect.tryPromise({
      try: async () => {
        const content = await fs.readFile(inputFile, "utf-8");
        return JSON.parse(content);
      },
      catch: (error) => {
        if (error instanceof SyntaxError) {
          return new Error(
            `JSONファイルの形式が正しくありません: ${inputFile}\n詳細: ${error.message}`,
          );
        }
        return new Error(
          `ファイルの読み込みに失敗しました: ${inputFile}\n詳細: ${error}`,
        );
      },
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    // スキーマのバリデーション
    const exercises = yield* Effect.try({
      try: () => Schema.decodeUnknownSync(ExercisesArray)(jsonContent),
      catch: (error) =>
        new Error(
          `エクササイズデータの形式が正しくありません: ${inputFile}\n詳細: ${error}`,
        ),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    // 出力ファイルパスの決定
    const outputPath =
      outputFile || path.join(path.dirname(inputFile), "anki.txt");

    // 出力ファイルの存在確認
    yield* Effect.tryPromise({
      try: async () => {
        try {
          await fs.stat(outputPath);
          // ファイルが存在する場合はエラー
          throw new Error(`出力ファイルが既に存在します: ${outputPath}`);
        } catch (error: any) {
          if (error.code === "ENOENT") {
            // ファイルが存在しない場合は正常
            return;
          }
          throw error;
        }
      },
      catch: (error) => error as Error,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    // Anki形式に変換
    const ankiContent = convertToAnkiFormat(exercises);

    if (ankiContent === "") {
      yield* Console.warn("変換可能なエクササイズが見つかりませんでした");
      return;
    }

    // ファイルに書き込み
    yield* Effect.tryPromise({
      try: () => fs.writeFile(outputPath, ankiContent, "utf-8"),
      catch: (error) =>
        new Error(
          `ファイルの書き込みに失敗しました: ${outputPath}\n詳細: ${error}`,
        ),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    yield* Console.log(
      `Ankiファイルを作成しました: ${outputPath} (${exercises.length}問)`,
    );
  });
