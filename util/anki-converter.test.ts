import { describe, test, expect } from "bun:test";
import { convertToAnkiFormat } from "./anki-converter.js";

describe("convertToAnkiFormat", () => {
  test("選択肢問題を基本カードに変換", () => {
    const exercises = [
      {
        courseTitle: "サンプル講座",
        chapterTitle: "第1章",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "次のうち正しいものはどれか",
          choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
          answerIndex: 1,
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);

    expect(result).toBe(
      "次のうち正しいものはどれか<br><br>" +
        "1. 選択肢A<br>" +
        "2. 選択肢B<br>" +
        "3. 選択肢C<br>" +
        "4. 選択肢D\t" +
        "2. 選択肢B\t" +
        "サンプル講座 第1章",
    );
  });

  test("複数の問題を変換", () => {
    const exercises = [
      {
        courseTitle: "数学",
        chapterTitle: "微分",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "f(x)=x^2の導関数は？",
          choices: ["x", "2x", "x^2", "2x^2"],
          answerIndex: 1,
        },
      },
      {
        courseTitle: "物理",
        chapterTitle: "力学",
        exerciseTitle: "問題2",
        exerciseId: "002",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "F=maの意味は？",
          choices: [
            "力=質量×加速度",
            "力=質量÷加速度",
            "力=質量+加速度",
            "力=質量-加速度",
          ],
          answerIndex: 0,
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("f(x)=x^2の導関数は？");
    expect(lines[0]).toContain("2. 2x");
    expect(lines[0]).toContain("数学 微分");
    expect(lines[1]).toContain("F=maの意味は？");
    expect(lines[1]).toContain("1. 力=質量×加速度");
    expect(lines[1]).toContain("物理 力学");
  });

  test("exerciseがnullの場合はスキップ", () => {
    const exercises = [
      {
        courseTitle: "サンプル講座",
        chapterTitle: "第1章",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: false,
        exercise: null,
      },
      {
        courseTitle: "サンプル講座",
        chapterTitle: "第2章",
        exerciseTitle: "問題2",
        exerciseId: "002",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "正しいものは？",
          choices: ["A", "B"],
          answerIndex: 0,
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);
    const lines = result.split("\n").filter((line) => line.trim() !== "");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("正しいものは？");
  });

  test("特殊文字をエスケープ", () => {
    const exercises = [
      {
        courseTitle: "プログラミング",
        chapterTitle: "HTML基礎",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "<script>タグの役割は？",
          choices: [
            "<b>太字</b>",
            '"引用符"を含む',
            "タブ\t文字",
            "改行\n含む",
          ],
          answerIndex: 0,
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);

    // HTMLタグはそのまま（AnkiでHTMLとして解釈される）
    expect(result).toContain("<script>タグの役割は？");
    expect(result).toContain("<b>太字</b>");
    // タブ文字はスペースに変換される
    expect(result).toContain("タブ    文字");
    // 改行文字は<br>に変換される
    expect(result).toContain("改行<br>含む");
    // フィールド区切りのタブは3つ（問題\t答え\tタグ）
    expect(result.split("\t")).toHaveLength(3);
  });

  test("空の配列の場合は空文字列を返す", () => {
    const result = convertToAnkiFormat([]);
    expect(result).toBe("");
  });

  test("自由入力問題（wordタイプ）を変換", () => {
    const exercises = [
      {
        courseTitle: "サンプル講座",
        chapterTitle: "第1章",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "word" as const,
          question: "ウェブブラウザで動作するプログラミング言語は？",
          correctAnswer: "JavaScript",
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);

    expect(result).toBe(
      "ウェブブラウザで動作するプログラミング言語は？<br><br>（自由入力）\t" +
        "JavaScript\t" +
        "サンプル講座 第1章",
    );
  });

  test("選択肢問題と自由入力問題を混在させて変換", () => {
    const exercises = [
      {
        courseTitle: "総合講座",
        chapterTitle: "基礎編",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "choice" as const,
          question: "1+1は？",
          choices: ["1", "2", "3", "4"],
          answerIndex: 1,
        },
      },
      {
        courseTitle: "総合講座",
        chapterTitle: "基礎編",
        exerciseTitle: "問題2",
        exerciseId: "002",
        contentAvailable: true,
        exercise: {
          type: "word" as const,
          question: "日本の首都は？",
          correctAnswer: "東京",
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2);
    // 選択肢問題
    expect(lines[0]).toContain("1+1は？");
    expect(lines[0]).toContain("1. 1<br>");
    expect(lines[0]).toContain("2. 2");
    // 自由入力問題
    expect(lines[1]).toContain("日本の首都は？");
    expect(lines[1]).toContain("（自由入力）");
    expect(lines[1]).toContain("\t東京\t");
  });

  test("自由入力問題で特殊文字をエスケープ", () => {
    const exercises = [
      {
        courseTitle: "プログラミング",
        chapterTitle: "基礎",
        exerciseTitle: "問題1",
        exerciseId: "001",
        contentAvailable: true,
        exercise: {
          type: "word" as const,
          question: "タブ\t文字を含む問題",
          correctAnswer: "タブ\t回答",
        },
      },
    ];

    const result = convertToAnkiFormat(exercises);

    // タブ文字はスペースに変換される
    expect(result).toContain("タブ    文字を含む問題");
    expect(result).toContain("タブ    回答");
    // フィールド区切りのタブは3つ（問題\t答え\tタグ）
    expect(result.split("\t")).toHaveLength(3);
  });
});
