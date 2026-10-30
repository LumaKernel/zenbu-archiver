import { Schema } from "effect";

// 選択肢問題のスキーマ
const ChoiceExerciseSchema = Schema.Struct({
  type: Schema.Literal("choice"),
  question: Schema.String,
  choices: Schema.Array(Schema.String),
  answerIndex: Schema.Number,
  explanation: Schema.NullOr(Schema.String),
});

// 自由入力問題のスキーマ
const WordExerciseSchema = Schema.Struct({
  type: Schema.Literal("word"),
  question: Schema.String,
  correctAnswer: Schema.String,
  explanation: Schema.NullOr(Schema.String),
});

// discriminated union スキーマ
const ExerciseSchema = Schema.Union(ChoiceExerciseSchema, WordExerciseSchema);

// エクササイズデータのスキーマ
export const ExerciseData = Schema.Struct({
  courseTitle: Schema.String,
  chapterTitle: Schema.String,
  exerciseTitle: Schema.String,
  exerciseId: Schema.String,
  courseId: Schema.optional(Schema.String),
  chapterId: Schema.optional(Schema.String),
  contentAvailable: Schema.Boolean,
  exercise: Schema.NullOr(ExerciseSchema),
});

export type ExerciseDataType = Schema.Schema.Type<typeof ExerciseData>;

export const ExercisesArray = Schema.Array(ExerciseData);

/**
 * コースURLを生成（courseId/chapterIdがある場合）
 */
const buildCourseUrl = (exerciseData: ExerciseDataType): string | null => {
  if (exerciseData.courseId && exerciseData.chapterId) {
    return `/courses/${exerciseData.courseId}/chapters/${exerciseData.chapterId}`;
  }
  return null;
};

/**
 * エクササイズデータをAnkiのテキスト形式に変換
 * フォーマット: 問題\t答え\tタグ
 * 問題: 質問文と選択肢をHTML形式で（choiceの場合）/ 質問文のみ（wordの場合）+ コースURL
 * 答え: 正解の選択肢（choice）/ 正解テキスト（word）+ 解説
 * タグ: コース情報
 */
export const convertToAnkiFormat = (
  exercises: readonly ExerciseDataType[],
): string => {
  const lines: string[] = [];

  // Anki用にエスケープ（タブ→スペース、改行→<br>）
  const escapeForAnki = (text: string): string =>
    text.replace(/\t/g, "    ").replace(/\n/g, "<br>");

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
        .map((choice, index) => `${index + 1}. ${escapeForAnki(choice)}`)
        .join("<br>");
      questionField = `${escapeForAnki(question)}<br><br>${choicesHtml}`;

      // 正解
      const answerText = choices[answerIndex] ?? "";
      answerField = `${answerIndex + 1}. ${escapeForAnki(answerText)}`;
    } else {
      // 自由入力問題の処理
      const { question, correctAnswer } = exercise;

      // 問題文のみ（自由入力なので選択肢なし）
      questionField = `${escapeForAnki(question)}<br><br>（自由入力）`;

      // 正解
      answerField = escapeForAnki(correctAnswer);
    }

    // コースURLを問題文に追加
    const courseUrl = buildCourseUrl(exerciseData);
    if (courseUrl) {
      questionField = `${questionField}<br><br><small>${escapeForAnki(courseUrl)}</small>`;
    }

    // 解説を回答に追加
    if (exercise.explanation) {
      answerField = `${answerField}<br><br><hr><br>${escapeForAnki(exercise.explanation)}`;
    }

    // タグ（コース情報）
    const tagField = `${exerciseData.courseTitle} ${exerciseData.chapterTitle}`;

    // タブ区切りで結合
    lines.push(`${questionField}\t${answerField}\t${tagField}`);
  }

  return lines.join("\n");
};
