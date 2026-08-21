declare module "cookie-parser" {
  import { RequestHandler } from "express";
  interface CookieParseOptions {
    decode?: (val: string) => string;
  }
  function cookieParser(secret?: string | string[], options?: CookieParseOptions): RequestHandler;
  export = cookieParser;
}
