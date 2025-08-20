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
    yield* Effect.tryPromise(async () => {
      try {
        await fs.stat(inputFile);
      } catch {
        throw new Error(`入力ファイルが見つかりません: ${inputFile}`);
      }
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(error.message);
          return yield* Effect.fail(error.message);
        }),
      ),
    );

    // JSONファイルの読み込み
    const jsonContent = yield* Effect.tryPromise(async () => {
      const content = await fs.readFile(inputFile, "utf-8");
      return JSON.parse(content);
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const message = `JSONファイルの読み込みに失敗しました: ${inputFile}`;
          yield* Console.error(message);
          yield* Console.error(`詳細: ${error.message}`);
          return yield* Effect.fail(message);
        }),
      ),
    );

    // スキーマのバリデーション
    const exercises = yield* Effect.try(() =>
      Schema.decodeUnknownSync(ExercisesArray)(jsonContent),
    ).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const message = `エクササイズデータの形式が正しくありません: ${inputFile}`;
          yield* Console.error(message);
          yield* Console.error(`詳細: ${error.message}`);
          return yield* Effect.fail(message);
        }),
      ),
    );

    // 出力ファイルパスの決定
    const outputPath =
      outputFile || path.join(path.dirname(inputFile), "anki.txt");

    // 出力ファイルの存在確認
    yield* Effect.tryPromise(async () => {
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
    yield* Effect.tryPromise(() =>
      fs.writeFile(outputPath, ankiContent, "utf-8"),
    ).pipe(
      Effect.catchAll(() =>
        Effect.gen(function* () {
          yield* Console.error(
            `ファイルの書き込みに失敗しました: ${outputPath}`,
          );
          return yield* Effect.fail("書き込みエラー");
        }),
      ),
    );

    yield* Console.log(
      `Ankiファイルを作成しました: ${outputPath} (${exercises.length}問)`,
    );
  });
