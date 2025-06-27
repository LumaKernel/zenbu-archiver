import { chromium } from "playwright";

export const makeBrowser = async (headless: boolean) => {
  const browser = await chromium.launch({
    headless,
  });
  return browser;
};
