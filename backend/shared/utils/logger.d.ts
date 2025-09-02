declare const logger: import("winston").Logger;
export default logger;
export declare const logInfo: (message: string, meta?: any) => void;
export declare const logError: (message: string, error?: Error, meta?: any) => void;
export declare const logWarn: (message: string, meta?: any) => void;
export declare const logDebug: (message: string, meta?: any) => void;
export declare const requestLogger: (req: any, res: any, next: any) => void;
//# sourceMappingURL=logger.d.ts.map