import * as cheerio from "cheerio";

export type Exercise = {
  readonly type: "choice";
  readonly question: string;
  readonly choices: readonly string[];
  readonly answerIndex: number;
};

export const parseExerciseHTML = (html: string): Exercise | null => {
  const $ = cheerio.load(html);

  // 最初のexerciseセクションを探す
  const exerciseSection = $("section.exercise").first();
  if (exerciseSection.length === 0) {
    return null;
  }

  // 問題文を取得
  const statementDiv = exerciseSection.find(".statement div p").first();
  if (statementDiv.length === 0) {
    return null;
  }
  const question = statementDiv.text().trim();

  // 選択肢を取得
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
