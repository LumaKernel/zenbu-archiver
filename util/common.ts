import { chromium } from "playwright";

export const makeBrowser = async (headless: boolean) => {
  const browser = await chromium.launch({
    headless,
  });
  return browser;
};

/**
 * ファイル名に使用できない特殊文字を全角に置換
 */
export const replaceSpecials = (str: string) =>
  str
    .replace(/\?/g, "？")
    .replace(/</g, "＜")
    .replace(/>/g, "＞")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/,/g, "，")
    .replace(/!/g, "！")
    .replace(/:/g, "：")
    .replace(/;/g, "；")
    .replace(/\\/g, "＼")
    .replace(/\//g, "／")
    .replace(/\|/g, "｜")
    .replace(/[*]/g, "＊")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F]/g, "");
