import { Console, Effect, Schema } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  convertToAnkiFormat,
  ExercisesArray,
  type ExerciseDataType,
} from "../util/anki-converter.js";
import { replaceSpecials } from "../util/common.js";

/**
 * エクササイズをcourseTitleでグループ化
 */
const groupByCourseTitle = (
  exercises: readonly ExerciseDataType[],
): ReadonlyMap<string, readonly ExerciseDataType[]> => {
  const groups = new Map<string, ExerciseDataType[]>();
  for (const exercise of exercises) {
    const key = exercise.courseTitle;
    const group = groups.get(key);
    if (group) {
      group.push(exercise);
    } else {
      groups.set(key, [exercise]);
    }
  }
  return groups;
};

/**
 * ファイルが存在しないことを確認（存在する場合はエラー）
 */
const ensureFileNotExists = (filePath: string) =>
  Effect.tryPromise({
    try: async () => {
      try {
        await fs.stat(filePath);
        // ファイルが存在する場合はエラー
        throw new Error(`出力ファイルが既に存在します: ${filePath}`);
      } catch (error: unknown) {
        const e = error as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
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

export const convertToAnkiCommand = (
  inputFile: string = "./archives/exercises.json",
) =>
  Effect.gen(function* () {
    // 入力ファイルの存在確認
    yield* Effect.tryPromise({
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

    // 科目ごとにグループ化
    const groupedExercises = groupByCourseTitle(exercises);

    if (groupedExercises.size === 0) {
      yield* Console.warn("変換可能なエクササイズが見つかりませんでした");
      return;
    }

    const baseDir = path.dirname(inputFile);
    let totalCount = 0;
    let fileCount = 0;

    // 科目ごとに処理
    for (const [courseTitle, courseExercises] of groupedExercises) {
      // Anki形式に変換
      const ankiContent = convertToAnkiFormat(courseExercises);

      if (ankiContent === "") {
        yield* Console.warn(
          `科目「${courseTitle}」には変換可能なエクササイズがありませんでした`,
        );
        continue;
      }

      // 科目フォルダのパスを決定（archive.tsと同じreplaceSpecialsを使用）
      const courseDirName = replaceSpecials(courseTitle);
      const courseDir = path.join(baseDir, courseDirName);

      // 出力ファイルパスの決定: {科目}-anki.txt
      const outputFileName = `${courseDirName}-anki.txt`;
      const outputPath = path.join(courseDir, outputFileName);

      // 出力ファイルの存在確認
      yield* ensureFileNotExists(outputPath);

      // フォルダがなければ作成
      yield* Effect.tryPromise({
        try: () => fs.mkdir(courseDir, { recursive: true }),
        catch: (error) =>
          new Error(
            `フォルダの作成に失敗しました: ${courseDir}\n詳細: ${error}`,
          ),
      });

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

      const validCount = courseExercises.filter(
        (e) => e.exercise !== null,
      ).length;
      yield* Console.log(`作成: ${outputPath} (${validCount}問)`);
      totalCount += validCount;
      fileCount += 1;
    }

    yield* Console.log(
      `\n完了: ${fileCount}個のAnkiファイルを作成しました (合計${totalCount}問)`,
    );
  });
