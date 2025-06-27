import { Context, Layer } from "effect";

export interface OriginConfig {
  readonly webOrigin: string;
  readonly apiOrigin: string;
}

export class Origin extends Context.Tag("Origin")<Origin, OriginConfig>() {}

export const makeOriginLive = (webOrigin: string, apiOrigin?: string) =>
  Layer.succeed(Origin, {
    webOrigin,
    apiOrigin: apiOrigin || webOrigin,
  });
