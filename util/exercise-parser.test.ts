import { describe, test, expect } from "bun:test";
import { parseExerciseHTML } from "./exercise-parser.js";

describe("parseExerciseHTML", () => {
  test("選択肢問題の解析（例1）", () => {
    const html = `<!DOCTYPE HTML><html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>サンプル問題1</title>
  </head>
  <body>
    <div id="kokuban-input-target">
      <h1>問題</h1>
      <section class="exercise">
        <div class="statement">
          <div>
            <p>次のうち、正しいものはどれか</p>
            <br>
          </div>
        </div>
        <ul>
          <li data-type="normal" data-item-id="sample-id-001">
            <div class="question">【選択肢】</div>
            <ul class="answers" data-type="perfect">
              <li data-correct="true" data-input-value="1">
                <p>選択肢A</p><br>
              </li>
              <li data-correct="false" data-input-value="2">
                <p>選択肢B</p><br>
              </li>
              <li data-correct="false" data-input-value="3">
                <p>選択肢C</p><br>
              </li>
              <li data-correct="false" data-input-value="4">
                <p>選択肢D</p><br>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  </body>
</html>`;

    const result = parseExerciseHTML(html);

    expect(result).toEqual({
      type: "choice",
      question: "次のうち、正しいものはどれか",
      choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      answerIndex: 0,
    });
  });

  test("選択肢問題の解析（例2 - 複雑な内容）", () => {
    const html = `<!DOCTYPE HTML><html lang="ja">
  <head>
    <meta charset="UTF-8">
    <title>サンプル問題2</title>
  </head>
  <body>
    <div id="kokuban-input-target">
      <h1>問題</h1>
      <section class="exercise">
        <div class="statement">
          <div>
            <p>\\(f(x)=x^2\\)の導関数は？</p>
            <br>
          </div>
        </div>
        <ul>
          <li data-type="normal" data-item-id="sample-id-002">
            <div class="question">【選択肢】</div>
            <ul class="answers" data-type="perfect">
              <li data-correct="false" data-input-value="1">
                <p>\\(x\\)</p><br>
              </li>
              <li data-correct="true" data-input-value="2">
                <p>\\(2x\\)</p><br>
              </li>
              <li data-correct="false" data-input-value="3">
                <p>\\(x^2\\)</p><br>
              </li>
              <li data-correct="false" data-input-value="4">
                <p>\\(2x^2\\)</p><br>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  </body>
</html>`;

    const result = parseExerciseHTML(html);

    expect(result).toEqual({
      type: "choice",
      question: "\\(f(x)=x^2\\)の導関数は？",
      choices: ["\\(x\\)", "\\(2x\\)", "\\(x^2\\)", "\\(2x^2\\)"],
      answerIndex: 1,
    });
  });

  test("複数の問題がある場合、最初の問題を返す", () => {
    const html = `<!DOCTYPE HTML><html lang="ja">
  <body>
    <div id="kokuban-input-target">
      <section class="exercise">
        <div class="statement">
          <div><p>問題1</p></div>
        </div>
        <ul>
          <li data-type="normal">
            <div class="question">【選択肢】</div>
            <ul class="answers" data-type="perfect">
              <li data-correct="true"><p>答え1</p></li>
              <li data-correct="false"><p>答え2</p></li>
            </ul>
          </li>
        </ul>
      </section>
      <section class="exercise">
        <div class="statement">
          <div><p>問題2</p></div>
        </div>
        <ul>
          <li data-type="normal">
            <div class="question">【選択肢】</div>
            <ul class="answers" data-type="perfect">
              <li data-correct="false"><p>答えA</p></li>
              <li data-correct="true"><p>答えB</p></li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  </body>
</html>`;

    const result = parseExerciseHTML(html);

    expect(result).toEqual({
      type: "choice",
      question: "問題1",
      choices: ["答え1", "答え2"],
      answerIndex: 0,
    });
  });

  test("問題が見つからない場合はnullを返す", () => {
    const html = `<!DOCTYPE HTML><html lang="ja">
  <body>
    <div id="kokuban-input-target">
      <h1>コンテンツなし</h1>
    </div>
  </body>
</html>`;

    const result = parseExerciseHTML(html);
    expect(result).toBeNull();
  });

  test("選択肢が見つからない場合はnullを返す", () => {
    const html = `<!DOCTYPE HTML><html lang="ja">
  <body>
    <div id="kokuban-input-target">
      <section class="exercise">
        <div class="statement">
          <div><p>問題文のみ</p></div>
        </div>
      </section>
    </div>
  </body>
</html>`;

    const result = parseExerciseHTML(html);
    expect(result).toBeNull();
  });
});
