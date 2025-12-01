import { Schema } from "effect";

// 選択肢問題のスキーマ
const ChoiceExerciseSchema = Schema.Struct({
  type: Schema.Literal("choice"),
  question: Schema.String,
  choices: Schema.Array(Schema.String),
  answerIndex: Schema.Number,
});

// 自由入力問題のスキーマ
const WordExerciseSchema = Schema.Struct({
  type: Schema.Literal("word"),
  question: Schema.String,
  correctAnswer: Schema.String,
});

// discriminated union スキーマ
const ExerciseSchema = Schema.Union(ChoiceExerciseSchema, WordExerciseSchema);

// エクササイズデータのスキーマ
export const ExerciseData = Schema.Struct({
  courseTitle: Schema.String,
  courseYear: Schema.Number,
  courseTerm: Schema.String,
  chapterTitle: Schema.String,
  exerciseTitle: Schema.String,
  exerciseId: Schema.String,
  contentAvailable: Schema.Boolean,
  exercise: Schema.NullOr(ExerciseSchema),
});

export type ExerciseDataType = Schema.Schema.Type<typeof ExerciseData>;

export const ExercisesArray = Schema.Array(ExerciseData);

/**
 * エクササイズデータをAnkiのテキスト形式に変換
 * フォーマット: 問題\t答え\tタグ
 * 問題: 質問文と選択肢をHTML形式で（choiceの場合）/ 質問文のみ（wordの場合）
 * 答え: 正解の選択肢（choice）/ 正解テキスト（word）
 * タグ: コース情報
 */
export const convertToAnkiFormat = (
  exercises: readonly ExerciseDataType[],
): string => {
  const lines: string[] = [];

  // タブ文字をスペースに置換する関数
  const escapeTab = (text: string): string => text.replace(/\t/g, "    ");

  for (const exerciseData of exercises) {
    // exerciseがnullの場合はスキップ
    if (!exerciseData.exercise) {
      continue;
    }

    const exercise = exerciseData.exercise;
    let questionField: string;
    let answerField: string;

    if (exercise.type === "choice") {
      // 選択肢問題の処理
      const { question, choices, answerIndex } = exercise;

      // 問題文と選択肢を組み立て（HTML形式）
      const choicesHtml = choices
        .map((choice, index) => `${index + 1}. ${escapeTab(choice)}`)
        .join("<br>");
      questionField = `${escapeTab(question)}<br><br>${choicesHtml}`;

      // 正解
      const answerText = choices[answerIndex] ?? "";
      answerField = `${answerIndex + 1}. ${escapeTab(answerText)}`;
    } else {
      // 自由入力問題の処理
      const { question, correctAnswer } = exercise;

      // 問題文のみ（自由入力なので選択肢なし）
      questionField = `${escapeTab(question)}<br><br>（自由入力）`;

      // 正解
      answerField = escapeTab(correctAnswer);
    }

    // タグ（コース情報）
    const tagField = `${exerciseData.courseTitle} ${exerciseData.courseYear}年${exerciseData.courseTerm} ${exerciseData.chapterTitle}`;

    // タブ区切りで結合
    lines.push(`${questionField}\t${answerField}\t${tagField}`);
  }

  return lines.join("\n");
};
