import { dirname } from "path";
import { EOL } from "os";
import { format } from "util";
import * as fs from "fs-extra";
import { Queue } from "dynamic-queue";

namespace OutputBuffer {
    export interface Options {
        /**
         * How much time that the output buffer should keep contents before
         * flushing, default value is `1000` ms.
         */
        ttl?: number;
        /**
         * How much size that the output buffer should keep contents before
         * flushing. This option is conflicted with `ttl`, set one of them.
         */
        size?: number;
        /** Writes the contents to the target file. */
        filename?: string;
        /**
         * The target file size, when up to limit, the `limitHandler` will be 
         * called, default vlaue is `2097152` bytes (2 Mb).
         */
        fileSize?: number;
        /** Called when the target file size is up to limit. */
        limitHandler?: (filename: string, data: string, next: Function) => void;
        /** Called when any error occoured. */
        errorHandler?: (err: Error) => void;
        /**
         * End of line, when `filename` is set, the default value is 
         * `os.EOL`, otherwise, it's `\n`.
          */
        EOL?: string;
    }
}

class OutputBuffer implements OutputBuffer.Options {
    readonly ttl: number;
    readonly size: number;
    readonly filename: string;
    readonly fileSize: number;
    readonly limitHandler: OutputBuffer.Options["limitHandler"];
    readonly errorHandler: OutputBuffer.Options["errorHandler"];
    readonly EOL: string;

    /** Whether the output buffer is closed. */
    closed: boolean = false;

    private timer: NodeJS.Timer = null;
    private buffer: Buffer = null;
    private queue: Queue;

    static Options: OutputBuffer.Options = {
        ttl: 1000,
        size: undefined,
        filename: undefined,
        fileSize: 1024 * 1024 * 2, // 2Mb
        limitHandler: function limitHandler(filename, data, next) {
            fs.writeFile(filename, data, "utf8", (err) => {
                if (err)
                    this.errorHandler(err);

                next();
            });
        },
        errorHandler: function errorHandler(err: Error) {
            throw err;
        },
        EOL
    }

    constructor(options?: OutputBuffer.Options);
    constructor(filename?: string, options?: OutputBuffer.Options);
    constructor(filename, options = null) {
        if (typeof filename == "object") {
            options = filename;
        } else {
            options = Object.assign({ filename }, options);
        }

        Object.assign(this, (<typeof OutputBuffer>this.constructor).Options, options);
        this.EOL = this.filename ? EOL : "\n";
        this.queue = new Queue();

        if (this.size) {
            this.ttl = undefined;

            process.on("beforeExit", (code) => {
                if (!code) {
                    this.close();
                }
            });
        } else {
            let next = () => {
                this.timer = setTimeout(() => {
                    this.flush(next);
                }, this.ttl);
            };

            next();
        }
    }

    /** Flushes the output buffer immediately. */
    flush(cb?: () => void): void {
        cb = cb || (() => { });

        if (this.buffer === null || this.buffer.length === 0)
            return cb();

        let data = this.get();

        this.clean(); // clean the buffer before output.

        if (!this.filename) {
            console.log(data);
            return cb();
        }

        data += this.EOL;

        let handleError = (err: Error, next: Function) => {
            this.errorHandler.call(this, err);
            cb();
            next();
        };
        let writeFile = (data: string, next: Function) => {
            fs.ensureDir(dirname(this.filename), err => {
                if (err)
                    return handleError(err, next);

                fs.writeFile(this.filename, data, "utf8", err => {
                    if (err)
                        return handleError(err, next);

                    cb();
                    next();
                });
            });
        };

        this.queue.push((next) => {
            fs.exists(this.filename, exists => {
                if (exists) {
                    fs.stat(this.filename, (err, stat) => {
                        if (err)
                            return handleError(err, next);
    
                        let size = stat.size + Buffer.byteLength(data);
    
                        if (size < this.fileSize) {
                            fs.appendFile(this.filename, data, err => {
                                if (err)
                                    return handleError(err, next);
    
                                cb();
                                next();
                            });
                        } else {
                            this.limitHandler.call(this, this.filename, data, () => {
                                writeFile(data, next);
                            });
                        }
                    });
                } else {
                    return writeFile(data, next);
                }
            });
        });
    }

    /** Pushes data into the buffer. */
    push(...data: any[]): void {
        if (this.closed)
            throw new Error("Cannot push data after closing the buffer.");

        let contents: any;
        let buf: Buffer;

        if (data.length > 1) {
            for (let part of data) {
                this.push(part);
            }

            return;
        } else {
            contents = data[0];
        }

        if (contents === null || contents === undefined) {
            return;
        } else if (typeof contents == "string") {
            buf = Buffer.from(contents);
        } else if (Buffer.isBuffer(contents)) {
            buf = contents;
        } else {
            buf = Buffer.from(format(contents));
        }

        if (this.buffer) {
            let eolBuf = Buffer.from(this.EOL);

            if (this.size) {
                let size = this.buffer.length + eolBuf.length + buf.length;

                if (size >= this.size) {
                    this.flush();
                    this.buffer = buf;
                    return;
                }
            }

            this.buffer = Buffer.concat([this.buffer, eolBuf, buf]);
        } else {
            this.buffer = buf;
        }
    }

    /** Gets buffer contents. */
    get(): string {
        return this.buffer ? this.buffer.toString() : "";
    }

    /** Cleans buffer contents without flushing. */
    clean(): void {
        this.buffer = null;
    }

    /** Destroys the buffer without flushing. */
    destroy(): void {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.clean();
    }

    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    close(): void {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.flush();
    }
}

export = OutputBuffer;