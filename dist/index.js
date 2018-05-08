"use strict";
const path_1 = require("path");
const os_1 = require("os");
const util_1 = require("util");
const fs = require("fs-extra");
class OutputBuffer {
    constructor(filename, options = null) {
        /** Whether the output buffer is closed. */
        this.closed = false;
        this.timer = null;
        this.buffer = null;
        if (typeof filename == "object") {
            options = filename;
        }
        else {
            options = Object.assign({ filename }, options);
        }
        Object.assign(this, this.constructor.Options, options);
        this.EOL = this.filename ? os_1.EOL : "\n";
        if (this.size) {
            this.ttl = undefined;
            process.on("beforeExit", (code) => {
                if (!code) {
                    this.close();
                }
            });
        }
    }
    /** Flushes the output buffer immediately. */
    flush(cb) {
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
        let handleError = (err) => {
            this.errorHandler.call(this, err);
            return cb();
        };
        let writeFile = (data) => {
            fs.ensureDir(path_1.dirname(this.filename), err => {
                if (err)
                    return handleError(err);
                fs.writeFile(this.filename, data, "utf8", err => {
                    if (err)
                        return handleError(err);
                    return cb();
                });
            });
        };
        fs.exists(this.filename, exists => {
            if (exists) {
                fs.stat(this.filename, (err, stat) => {
                    if (err)
                        return handleError(err);
                    let size = stat.size + Buffer.byteLength(data);
                    if (size < this.fileSize) {
                        fs.appendFile(this.filename, data, err => {
                            if (err)
                                return handleError(err);
                            return cb();
                        });
                    }
                    else {
                        this.limitHandler.call(this, this.filename, data, () => {
                            writeFile(data);
                        });
                    }
                });
            }
            else {
                return writeFile(data);
            }
        });
    }
    /** Pushes data into the buffer. */
    push(...data) {
        if (this.closed)
            throw new Error("Cannot push data after closing the buffer.");
        let contents;
        let buf;
        if (data.length > 1) {
            for (let part of data) {
                this.push(part);
            }
            return;
        }
        else {
            contents = data[0];
        }
        if (contents === null || contents === undefined) {
            return;
        }
        else if (typeof contents == "string") {
            buf = Buffer.from(contents);
        }
        else if (Buffer.isBuffer(contents)) {
            buf = contents;
        }
        else {
            buf = Buffer.from(util_1.format(contents));
        }
        if (this.buffer === null && !this.size && !this.timer) {
            let next = () => {
                this.timer = setTimeout(() => {
                    this.flush(next);
                }, this.ttl);
            };
            next();
        }
        if (this.buffer) {
            let eolBuf = Buffer.from(this.EOL);
            if (this.size) {
                let size = this.buffer.length + eolBuf.length + buf.length;
                if (size >= this.size) {
                    this.flush();
                }
            }
            this.buffer = Buffer.concat([this.buffer, eolBuf, buf]);
        }
        else {
            this.buffer = buf;
        }
    }
    /** Gets buffer contents. */
    get() {
        return this.buffer ? this.buffer.toString() : "";
    }
    /** Cleans buffer contents without flushing. */
    clean() {
        this.buffer = null;
    }
    /** Destroys the buffer without flushing. */
    destroy() {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.clean();
    }
    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    close() {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.flush();
    }
}
OutputBuffer.Options = {
    ttl: 1000,
    size: undefined,
    filename: undefined,
    fileSize: 1024 * 1024 * 2,
    limitHandler: function limitHandler(filename, data, next) {
        fs.writeFile(filename, data, "utf8", (err) => {
            if (err)
                this.errorHandler(err);
            next();
        });
    },
    errorHandler: function errorHandler(err) {
        throw err;
    },
    EOL: os_1.EOL
};
module.exports = OutputBuffer;
//# sourceMappingURL=index.js.map