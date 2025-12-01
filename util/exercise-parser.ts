import * as cheerio from "cheerio";

// 選択肢問題（従来の四択問題）
export type ChoiceExercise = {
  readonly type: "choice";
  readonly question: string;
  readonly choices: readonly string[];
  readonly answerIndex: number;
};

// 自由入力問題
export type WordExercise = {
  readonly type: "word";
  readonly question: string;
  readonly correctAnswer: string;
};

// discriminated union
export type Exercise = ChoiceExercise | WordExercise;

export const parseExerciseHTML = (html: string): Exercise | null => {
  const $ = cheerio.load(html);

  // 最初のexerciseセクションを探す
  const exerciseSection = $("section.exercise").first();
  if (exerciseSection.length === 0) {
    return null;
  }

  // 問題文を取得（.statement p または .statement div p）
  let statementP = exerciseSection.find(".statement > p").first();
  if (statementP.length === 0) {
    statementP = exerciseSection.find(".statement div p").first();
  }
  if (statementP.length === 0) {
    return null;
  }
  const question = statementP.text().trim();

  // wordタイプをチェック（data-type="word"を持つli要素）
  const wordLi = exerciseSection.find('li[data-type="word"]').first();
  if (wordLi.length > 0) {
    // 自由入力問題として処理
    const inputElement = wordLi.find("input.answers[data-correct-answers]");
    if (inputElement.length === 0) {
      return null;
    }

    const correctAnswer = inputElement.attr("data-correct-answers");
    if (!correctAnswer) {
      return null;
    }

    return {
      type: "word",
      question,
      correctAnswer,
    };
  }

  // 選択肢問題として処理
  const answersUl = exerciseSection.find("ul.answers").first();
  if (answersUl.length === 0) {
    return null;
  }

  const choices: string[] = [];
  let answerIndex = -1;

  answersUl.find("li").each((index, element) => {
    const choiceText = $(element).find("p").text().trim();
    choices.push(choiceText);

    const isCorrect = $(element).attr("data-correct") === "true";
    if (isCorrect && answerIndex === -1) {
      answerIndex = index;
    }
  });

  if (choices.length === 0 || answerIndex === -1) {
    return null;
  }

  return {
    type: "choice",
    question,
    choices,
    answerIndex,
  };
};
