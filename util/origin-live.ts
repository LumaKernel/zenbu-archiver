import { Layer, Option } from "effect";
import { Origin } from "./origin.js";

export const makeOriginLive = (
  origin: Option.Option<string>,
  originApi: Option.Option<string>,
) => {
  const webOrigin = Option.getOrElse(
    origin,
    () => process.env.ZENBU_ARCHIVE_ORIGIN || "",
  );

  const apiOrigin =
    Option.getOrUndefined(originApi) ||
    process.env.ZENBU_ARCHIVE_ORIGIN_API ||
    webOrigin.replace(/^(https?:\/\/)(?:www\.)?/, "$1api.");

  return Layer.succeed(Origin, {
    webOrigin,
    apiOrigin,
  });
};

export const validateOrigin = (origin: Option.Option<string>) => {
  const originValue = Option.getOrElse(
    origin,
    () => process.env.ZENBU_ARCHIVE_ORIGIN || "",
  );

  if (!originValue) {
    throw new Error("オリジンが指定されていません");
  }

  return originValue;
};
