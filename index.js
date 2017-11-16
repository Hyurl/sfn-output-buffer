const path = require("path");
const util = require("util");
const fs = require("fs-extra");
const { EOL } = require("os");

/**
 * Output buffer, data are firstly stored in memory, then after a TTL time, 
 * flushed to a disk file or to the console.
 */
class OutputBuffer {
    /**
     * Creates a new output buffer.
     * 
     * @param {String|Object} options Include these options:
     *  - `ttl` Time to live, default is `1000`ms.
     *  - `size` Buffer size, if set, then `ttl` will be ignored.
     *  - `filename` Flush buffer to a disk file.
     *  - `fileSize` Maximum size of the output file.
     *  - `limitHandler` A function called when the output file's size up to 
     *      limit, rewrite by default.
     *  - `errorHandler` A function called when any error occurred in the 
     *      asynchronous timer scope.
     * 
     *  If this parameter is passed as a string, then it will be treated as 
     *  a `filename`.
     */
    constructor(options = {}) {
        if (typeof options == "string") {
            options = { filename: options };
        }
        this.ttl = options.ttl || 1000;
        this.size = options.size || 0;
        this.filename = options.filename; // Flush to file when expires.
        this.fileSize = options.fileSize || 1024 * 1024 * 2; // 2 MB.
        this.limitHandler = options.limitHandler || ((file, data, next) => {
            fs.writeFile(file, data, err => {
                if (err)
                    this.errorHandler(err);
                next();
            });
        });
        this.errorHandler = options.errorHandler || (err => {
            console.error(err);
        });
        this.EOL = this.filename ? EOL : "\n";
        this.timer = null;
        this.buffer = null;
        this.closed = false; // Whether the buffer is closed.
    }

    /**
     * Flushes the buffer immediately.
     * @param {Function} cb 
     */
    flush(cb = null) {
        cb = cb || (() => {});
        if (this.buffer === null || this.buffer.length === 0) return cb();
        if (this.filename) {
            var data = this.get() + this.EOL,
                handleError = (e) => {
                    this.errorHandler(e);
                    return cb();
                };
            this.clean();
            fs.exists(this.filename, exists => {
                if (exists) {
                    fs.stat(this.filename, (err, stat) => {
                        if (err)
                            return handleError(err);
                        var size = stat.size + Buffer.byteLength(data);
                        if (size >= this.fileSize) {
                            this.limitHandler(this.filename, data, cb);
                        } else {
                            fs.appendFile(this.filename, data, err => {
                                if (err)
                                    return handleError(err);
                                cb();
                            });
                        }
                    });
                } else {
                    var dirname = path.dirname(this.filename);
                    fs.ensureDir(dirname, err => {
                        if (err)
                            return handleError(err);
                        fs.writeFile(this.filename, data, err => {
                            if (err)
                                return handleError(err);
                            cb();
                        });
                    });
                }
            });
        } else {
            console.log(this.get());
            this.clean();
            cb();
        }
    }

    /**
     * Pushes data into the buffer.
     * @param {Any} data The data needs to be stored.
     */
    push(...data) {
        if (arguments.length > 1) {
            for (let part of data) {
                this.push(part);
            }
            return;
        } else {
            data = data[0];
        }
        if (data === null || data === undefined) {
            return;
        } else if (typeof data != "string") {
            data = util.format(data);
        }
        if (this.closed) {
            throw new Error("Cannot push data after closing the buffer.");
        } else if (this.buffer === null && !this.size && !this.timer) {
            var next = () => {
                this.timer = setTimeout(() => {
                    this.flush(next);
                }, this.ttl);
            };
            next();
        }

        data = this.buffer === null ? data : this.buffer + this.EOL + data;
        this.buffer = Buffer.from(data);

        if (this.size && this.buffer && this.buffer.length >= this.size) {
            this.flush();
        }
    }

    /** Gets buffer contents. */
    get() {
        return this.buffer === null ? null : this.buffer.toString();
    }

    /** Cleans buffer contents without flushing. */
    clean() {
        this.buffer = null;
    }

    /** Destroys the buffer without flushing. */
    destroy() {
        this.closed = true;
        clearTimeout(this.timer);
        this.clean();
    }

    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    close() {
        this.flush(() => this.destroy());
    }
}

module.exports = OutputBuffer;