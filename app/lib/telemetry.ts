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
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}${arg.stack ? '\nStack: ' + arg.stack : ''}`;
    }
    if (arg instanceof Event) {
      return `Event: ${arg.type} on ${(arg.target as any)?.tagName || 'unknown'}`;
    }
    if (typeof arg === 'object' && arg !== null) {
      // Better handling of DOM nodes and circular references
      return JSON.stringify(arg, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value instanceof Node) {
            return `[${value.constructor.name}${(value as any).id ? '#' + (value as any).id : ''}]`;
          }
          if (value instanceof Event) {
            return `[Event: ${value.type}]`;
          }
        }
        return value;
      }, 2);
    }
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

  // Store original error handlers
  const originalErrorHandler = window.onerror;
  const originalRejectionHandler = window.onunhandledrejection;

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

  // Capture unhandled JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    try {
      const errorInfo = [
        `Uncaught Error: ${message}`,
        `Source: ${source}:${lineno}:${colno}`,
        error ? `Stack: ${error.stack}` : ''
      ].filter(Boolean);
      push("error", errorInfo);
    } catch {}
    
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  // Capture unhandled promise rejections
  window.onunhandledrejection = (event) => {
    try {
      const reason = event.reason;
      const errorInfo = [
        'Unhandled Promise Rejection:',
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
        reason instanceof Error && reason.stack ? `Stack: ${reason.stack}` : ''
      ].filter(Boolean);
      push("error", errorInfo);
    } catch {}
    
    if (originalRejectionHandler) {
      return originalRejectionHandler.call(window, event);
    }
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
      
      // Restore original error handlers
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalRejectionHandler;
    },
    getLogs: () => logs.slice(),
  };
}


