export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

type Colors = {
  [key in LogLevel]: string;
};

const logLevel = Number(
  localStorage.getItem('logLevel') ?? import.meta.env.VITE_LOG_LEVEL
);

export class Logger {
  private static level: LogLevel = logLevel;

  private static colors: Colors = {
    [LogLevel.NONE]: 'gray',
    [LogLevel.DEBUG]: 'gray',
    [LogLevel.INFO]: 'blue',
    [LogLevel.WARN]: 'orange',
    [LogLevel.ERROR]: 'red',
  };

  static debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  static info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    this._error(LogLevel.ERROR, message, ...args);
  }

  static _error(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.level || this.level < level) {
      return;
    }

    const color = this.colors[level] ?? 'black';
    const prefix = `[${LogLevel[level]}]`;
    console.error(`%c ${prefix} ${message}`, `color: ${color}`, ...args);
  }

  static log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.level || this.level < level) {
      return;
    }

    const color = this.colors[level] ?? 'black';
    const prefix = `[${LogLevel[level]}]`;
    console.log(`%c ${prefix} ${message}`, `color: ${color}`, ...args);
  }
}
