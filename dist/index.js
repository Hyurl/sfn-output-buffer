"use strict";
var path_1 = require("path");
var os_1 = require("os");
var util_1 = require("util");
var fs = require("fs");
var dynamic_queue_1 = require("dynamic-queue");
var assign = require("lodash/assign");
var mkdir = require("mkdirp");
var isOldNode = parseFloat(process.version.slice(1)) < 6.0;
function toBuffer(input) {
    return isOldNode ? new Buffer(input) : Buffer.from(input);
}
var OutputBuffer = /** @class */ (function () {
    function OutputBuffer(filename, options) {
        if (options === void 0) { options = null; }
        var _this = this;
        /** Whether the output buffer is closed. */
        this.closed = false;
        this.timer = null;
        this.buffer = null;
        if (typeof filename == "object") {
            options = filename;
        }
        else {
            options = assign({ filename: filename }, options);
        }
        assign(this, this.constructor.Options, options);
        this.EOL = this.filename ? os_1.EOL : "\n";
        this.queue = new dynamic_queue_1.Queue();
        if (this.size) {
            this.ttl = undefined;
            process.on("beforeExit", function (code) {
                if (!code) {
                    _this.close();
                }
            });
        }
        else {
            var next_1 = function () {
                _this.timer = setTimeout(function () {
                    _this.flush(next_1);
                }, _this.ttl);
            };
            next_1();
        }
    }
    /** Flushes the output buffer immediately. */
    OutputBuffer.prototype.flush = function (cb) {
        var _this = this;
        cb = cb || (function () { });
        if (this.buffer === null || this.buffer.length === 0)
            return cb();
        var data = this.get();
        this.clean(); // clean the buffer before output.
        if (!this.filename) {
            console.log(data);
            return cb();
        }
        data += this.EOL;
        var handleError = function (err, next) {
            _this.errorHandler.call(_this, err);
            cb();
            next();
        };
        var writeFile = function (data, next) {
            var dir = path_1.dirname(_this.filename), write = function () {
                fs.writeFile(_this.filename, data, "utf8", function (err) {
                    if (err)
                        return handleError(err, next);
                    cb();
                    next();
                });
            };
            fs.exists(dir, function (exists) {
                if (exists) {
                    write();
                }
                else {
                    mkdir(dir, function (err) {
                        if (err)
                            return handleError(err, next);
                        write();
                    });
                }
            });
        };
        this.queue.push(function (next) {
            fs.exists(_this.filename, function (exists) {
                if (exists) {
                    fs.stat(_this.filename, function (err, stat) {
                        if (err)
                            return handleError(err, next);
                        var size = stat.size + Buffer.byteLength(data);
                        if (size < _this.fileSize) {
                            fs.appendFile(_this.filename, data, function (err) {
                                if (err)
                                    return handleError(err, next);
                                cb();
                                next();
                            });
                        }
                        else {
                            _this.limitHandler.call(_this, _this.filename, data, function () {
                                writeFile(data, next);
                            });
                        }
                    });
                }
                else {
                    return writeFile(data, next);
                }
            });
        });
    };
    /** Pushes data into the buffer. */
    OutputBuffer.prototype.push = function () {
        var data = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            data[_i] = arguments[_i];
        }
        if (this.closed)
            throw new Error("Cannot push data after closing the buffer.");
        var contents;
        var buf;
        if (data.length > 1) {
            for (var _a = 0, data_1 = data; _a < data_1.length; _a++) {
                var part = data_1[_a];
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
            buf = toBuffer(contents);
        }
        else if (Buffer.isBuffer(contents)) {
            buf = contents;
        }
        else {
            buf = toBuffer(util_1.format(contents));
        }
        if (this.buffer) {
            var eolBuf = toBuffer(this.EOL);
            if (this.size) {
                var size = this.buffer.length + eolBuf.length + buf.length;
                if (size >= this.size) {
                    this.flush();
                    this.buffer = buf;
                    return;
                }
            }
            this.buffer = Buffer.concat([this.buffer, eolBuf, buf]);
        }
        else {
            this.buffer = buf;
        }
    };
    /** Gets buffer contents. */
    OutputBuffer.prototype.get = function () {
        return this.buffer ? this.buffer.toString() : "";
    };
    /** Cleans buffer contents without flushing. */
    OutputBuffer.prototype.clean = function () {
        this.buffer = null;
    };
    /** Destroys the buffer without flushing. */
    OutputBuffer.prototype.destroy = function () {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.clean();
    };
    /**
     * Closes the buffer safely, buffer will be flushed before destroying.
     */
    OutputBuffer.prototype.close = function () {
        this.closed = true;
        this.timer ? clearTimeout(this.timer) : null;
        this.flush();
    };
    OutputBuffer.Options = {
        ttl: 1000,
        size: undefined,
        filename: undefined,
        fileSize: 1024 * 1024 * 2,
        limitHandler: function limitHandler(filename, data, next) {
            var _this = this;
            fs.writeFile(filename, data, "utf8", function (err) {
                if (err)
                    _this.errorHandler(err);
                next();
            });
        },
        errorHandler: function errorHandler(err) {
            throw err;
        },
        EOL: os_1.EOL
    };
    return OutputBuffer;
}());
module.exports = OutputBuffer;
//# sourceMappingURL=index.js.map