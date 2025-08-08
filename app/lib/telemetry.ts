export type ConsoleLogEntry = {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  args: string[];
  timestamp: string; // ISO
};

export type ConsoleCapture = {
  stop: () => void;
  getLogs: () => ConsoleLogEntry[];
};

function stringifyArg(arg: unknown): string {
  try {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    return JSON.stringify(arg);
  } catch {
    try {
      return String(arg);
    } catch {
      return "[unserializable]";
    }
  }
}

export function startConsoleCapture(maxEntries = 2000): ConsoleCapture {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  } as const;

  const logs: ConsoleLogEntry[] = [];
  const push = (level: ConsoleLogEntry["level"], args: unknown[]) => {
    const entry: ConsoleLogEntry = {
      level,
      message: args.map(stringifyArg).join(" "),
      args: args.map(stringifyArg),
      timestamp: new Date().toISOString(),
    };
    logs.push(entry);
    if (logs.length > maxEntries) logs.shift();
  };

  console.log = (...args: any[]) => {
    try { push("log", args); } catch {}
    // @ts-ignore
    return original.log.apply(console, args);
  };
  console.info = (...args: any[]) => {
    try { push("info", args); } catch {}
    // @ts-ignore
    return original.info.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    try { push("warn", args); } catch {}
    // @ts-ignore
    return original.warn.apply(console, args);
  };
  console.error = (...args: any[]) => {
    try { push("error", args); } catch {}
    // @ts-ignore
    return original.error.apply(console, args);
  };
  console.debug = (...args: any[]) => {
    try { push("debug", args); } catch {}
    // @ts-ignore
    return original.debug.apply(console, args);
  };

  return {
    stop: () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
      console.debug = original.debug;
    },
    getLogs: () => logs.slice(),
  };
}


