declare class OutputBuffer {
    ttl: number;
    size: number;
    /** Flush to file when expires. */
    filename: string;
    fileSize: number;
    limitHandler: (filename: string, data: Buffer, next: Function) => void;
    errorHandler: (err: Error) => void;
    private EOL: "\n" | "\r" | "\r\n";
    private timer: any;
    private buffer: Buffer;
    readonly closed: boolean;

    constructor(filename?: string);
    constructor(options?: {
        ttl?: number;
        size?: number;
        /** Flush to file when expires. */
        filename?: string;
        fileSize?: number;
        limitHandler?: (filename: string, data: Buffer, next: Function) => void;
        errorHandler?: (err: Error) => void;
    });

    /** Flushes the buffer immediately. */
    flush(cb: () => void): void;

    /** Pushes data into the buffer. */
    push(...data: any[]): void;

    /** Gets buffer contents. */
    get(): string;

    /** Cleans buffer contents without flushing. */
    clean(): void;

    /** Destroys the buffer without flushing. */
    destroy(): void;

    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    close(): void;
}

export = OutputBuffer;