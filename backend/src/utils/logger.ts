const ts = () => new Date().toISOString();

export const logger = {
  info: (msg: string, meta?: unknown) =>
    console.log(`${ts()} INFO  ${msg}`, meta ? JSON.stringify(meta) : ""),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`${ts()} WARN  ${msg}`, meta ? JSON.stringify(meta) : ""),
  error: (msg: string, meta?: unknown) =>
    console.error(`${ts()} ERROR ${msg}`, meta ? JSON.stringify(meta) : ""),
  debug: (msg: string, meta?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`${ts()} DEBUG ${msg}`, meta ? JSON.stringify(meta) : "");
    }
  },
};
