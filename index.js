const fs = require("fs");
const path = require("path");
const util = require("util");
const EventEmitter = require("events");
const { EOL } = require("os");
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const Buffers = {};

/** 
 * Generates a random integer.
 * @param {Number} min The minimum number.
 * @param {Number} max The maximum number (inclusive).
 */
function rand(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 
 * Generates a random string.
 * @param {Number} length The string length.
 * @param {String} chars The possible characters.
 */
function randStr(length = 5, chars = "") {
    chars = chars || CHARS;
    var str = "",
        max = chars.length - 1;
    for (var i = 0; i < length; i++) {
        str += chars[rand(0, max)];
    }
    return str;
}

/** 
 * Makes a directory recursively.
 * @param {String} dir The directory path.
 * @param {Number} mode Default is 0777.
 */
function xmkdir(dir, mode = 0777) {
    dir = path.normalize(dir).replace(/\\/g, "/").split("/");
    var _dir = [];
    for (var i = 0; i < dir.length; i++) {
        _dir.push(dir[i]);
        let dirname = _dir.join("/");
        if (dirname && !fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, mode);
        }
    }
}

/**
 * Output buffer, data are firstly stored in memory, then after a TTL time, 
 * flushed to a disk file or the console.
 */
class OutputBuffer {
    /**
     * Creates a new output buffer.
     * 
     * @param {String|Object} options Include these options:
     *  - `ttl` Time to live, default is `1000`ms.
     *  - `size` Buffer size, if set, then `ttl` will be ignored.
     *  - `filename` A disk file for storing data.
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
        this.id = options.filename || randStr(16);
        this.ttl = options.ttl || 1000;
        this.size = options.size || 0;
        this.filename = options.filename; // Flush to file when expires.
        this.fileSize = options.fileSize || 1024 * 1024 * 2; // 2 MB.
        this.limitHandler = options.limitHandler || ((file, data, next) => {
            try {
                fs.writeFileSync(file, data);
                next();
            } catch (e) {
                this.errorHandler(e);
            }
        });
        this.errorHandler = options.errorHandler || (err => {
            console.error(err);
        });
        this.EOL = this.filename ? EOL : "\n";
        this.timer = null;

        if (Buffers[this.id] === undefined) {
            Buffers[this.id] = null;
        }
    }

    /**
     * Flushes the buffer immediately.
     * @param {Function} cb 
     */
    flush(cb = null) {
        cb = cb || (() => {});
        if (Buffers[this.id].length === 0) return cb();
        if (this.filename) {
            var data = this.get() + this.EOL;
            this.clean();
            setImmediate(() => { // Asynchronize the procedure.
                try {
                    if (fs.existsSync(this.filename)) {
                        // File exists, test file size.
                        var stat = fs.statSync(this.filename),
                            size = stat.size + Buffer.byteLength(data);
                        if (size >= this.fileSize) {
                            this.limitHandler(this.filename, data, cb);
                        } else {
                            // if not up to limit, then append contents.
                            fs.appendFileSync(this.filename, data);
                            cb();
                        }
                    } else {
                        var dirname = path.dirname(this.filename);
                        if (!fs.existsSync(dirname)) {
                            // If the directory doesn't exist, create a new one.
                            xmkdir(dirname);
                        }
                        // File not exists, create a new one.
                        fs.writeFileSync(this.filename, data);
                        cb();
                    }
                } catch (e) {
                    this.errorHandler(e);
                    cb();
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
        } else if (Buffers[this.id] === null) {
            Buffers[this.id] = [];
            if (!this.size && !this.timer) {
                var next = () => {
                    this.timer = setTimeout(() => {
                        this.flush(next);
                    }, this.ttl);
                };
                next();
            }
        } else if (this.size) {
            var size = Buffer.byteLength(this.get() + data);
            if (size >= this.size) {
                this.flush();
            }
        }

        Buffers[this.id].push(data);
    }

    /** Gets buffer contents. */
    get() {
        return Buffers[this.id] ? Buffers[this.id].join(this.EOL) : null;
    }

    /** Cleans buffer contents without flushing. */
    clean() {
        Buffers[this.id] = [];
    }

    /** Destroys the buffer without flushing. */
    destroy() {
        clearTimeout(this.timer);
        delete Buffers[this.id];
    }

    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    close() {
        this.flush(() => this.destroy());
    }

    /** Whether the buffer is closed. */
    get closed() {
        return Buffers[this.id] === undefined;
    }
}

module.exports = OutputBuffer;