/// <reference types="vite/client" />

declare global {
  interface CoreSnapshot {
    id: string;
    name: string;
    category?: string;
    description?: string;
    doc?: string;
    running: boolean;
    autoStart: boolean;
    executable?: string | null;
    relativeExecutable?: string | null;
    args?: string[];
    argsLine?: string | null;
    configHint?: string;
    cwd?: string;
    pid?: number | null;
    startedAt?: string | Date | null;
  }

  interface LogEntryDto {
    id: number;
    coreId?: string;
    level?: string;
    message: string;
    timestamp: number;
  }

  interface BridgeResult<T = unknown> {
    success?: boolean;
    message?: string;
    data?: T;
    results?: Array<{ success?: boolean; message?: string; id?: string }>;
  }

  interface V2rayNBridge {
    listCores: () => Promise<CoreSnapshot[]>;
    startCore: (id: string) => Promise<BridgeResult<CoreSnapshot>>;
    restartCore: (id: string) => Promise<BridgeResult<CoreSnapshot>>;
    stopCore: (id: string) => Promise<BridgeResult<CoreSnapshot>>;
    startAll: () => Promise<BridgeResult>;
    stopAll: () => Promise<BridgeResult>;
    updateCoreConfig: (id: string, payload: Record<string, unknown>) => Promise<BridgeResult<CoreSnapshot>>;
    readLogs: (coreId: string, after: number) => Promise<LogEntryDto[]>;
  }

  interface Window {
    v2raynBridge?: V2rayNBridge;
  }
}

export {};
