import { Schema } from "effect";

// エクササイズデータのスキーマ
export const ExerciseData = Schema.Struct({
  courseTitle: Schema.String,
  courseYear: Schema.Number,
  courseTerm: Schema.String,
  chapterTitle: Schema.String,
  exerciseTitle: Schema.String,
  exerciseId: Schema.String,
  contentAvailable: Schema.Boolean,
  exercise: Schema.NullOr(
    Schema.Struct({
      type: Schema.Literal("choice"),
      question: Schema.String,
      choices: Schema.Array(Schema.String),
      answerIndex: Schema.Number,
    }),
  ),
});

export type ExerciseDataType = Schema.Schema.Type<typeof ExerciseData>;

export const ExercisesArray = Schema.Array(ExerciseData);

/**
 * エクササイズデータをAnkiのテキスト形式に変換
 * フォーマット: 問題\t答え\tタグ
 * 問題: 質問文と選択肢をHTML形式で
 * 答え: 正解の選択肢
 * タグ: コース情報
 */
export const convertToAnkiFormat = (
  exercises: readonly ExerciseDataType[],
): string => {
  const lines: string[] = [];

  // タブ文字をスペースに置換する関数
  const escapeTab = (text: string): string => text.replace(/\t/g, "    ");

  for (const exercise of exercises) {
    // exerciseがnullの場合はスキップ
    if (!exercise.exercise) {
      continue;
    }

    const { question, choices, answerIndex } = exercise.exercise;

    // 問題文と選択肢を組み立て（HTML形式）
    const choicesHtml = choices
      .map((choice, index) => `${index + 1}. ${escapeTab(choice)}`)
      .join("<br>");
    const questionField = `${escapeTab(question)}<br><br>${choicesHtml}`;

    // 正解
    const answerText = choices[answerIndex] ?? "";
    const answerField = `${answerIndex + 1}. ${escapeTab(answerText)}`;

    // タグ（コース情報）
    const tagField = `${exercise.courseTitle} ${exercise.courseYear}年${exercise.courseTerm} ${exercise.chapterTitle}`;

    // タブ区切りで結合
    lines.push(`${questionField}\t${answerField}\t${tagField}`);
  }

  return lines.join("\n");
};
