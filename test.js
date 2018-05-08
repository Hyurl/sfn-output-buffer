require("source-map-support/register");
const OutputBuffer = require("./");
const assert = require("assert");
const { EOL } = require("os");
const fs = require("fs");

var file1 = "logs/example1.log",
    file2 = "logs/example2.log",
    file3 = "logs/example3.log",
    fileContents = [
        "Hello, World!",
        "Hi, Ayon!",
        "{ hello: 'world!' }"
    ].join(EOL);

describe("new OutputBuffer()", () => {
    describe("new OutputBuffer()", () => {
        it("should create instance without arguments", () => {
            let ob = new OutputBuffer(),
                expected = Object.assign({}, ob);

            delete expected.timer;
            delete expected.queue;

            try {
                assert.ok(typeof ob.queue == "object");
                assert.ok(typeof ob.timer == "object");
                assert.deepStrictEqual(expected, {
                    closed: false,
                    buffer: null,
                    ttl: 1000,
                    size: undefined,
                    filename: undefined,
                    fileSize: 2097152,
                    limitHandler: OutputBuffer.Options.limitHandler,
                    errorHandler: OutputBuffer.Options.errorHandler,
                    EOL: "\n"
                });

                ob.close();
            } catch (err) {
                ob.close();
                throw err;
            }
        });
    });

    describe("new OutputBuffer(filename: string)", () => {
        it("should create instance with a filename", () => {
            let ob = new OutputBuffer(file1),
                expected = Object.assign({}, ob);

            delete expected.timer;
            delete expected.queue;

            try {
                assert.ok(typeof ob.queue == "object");
                assert.ok(typeof ob.timer == "object");
                assert.deepEqual(expected, {
                    closed: false,
                    buffer: null,
                    ttl: 1000,
                    size: undefined,
                    filename: file1,
                    fileSize: 2097152,
                    limitHandler: OutputBuffer.Options.limitHandler,
                    errorHandler: OutputBuffer.Options.errorHandler,
                    EOL
                });

                ob.close();
            } catch (err) {
                ob.close();
                throw err;
            }
        });
    });

    describe("new OutputBuffer(options: OutputBuffer.Options)", () => {
        it("should create instance with options", () => {
            let ob = new OutputBuffer({
                filename: file2,
                size: 4096
            });

            let expected = Object.assign({}, ob);

            delete expected.queue;

            try {
                assert.deepEqual(expected, {
                    closed: false,
                    timer: null,
                    buffer: null,
                    ttl: undefined,
                    size: 4096,
                    filename: file2,
                    fileSize: 2097152,
                    limitHandler: OutputBuffer.Options.limitHandler,
                    errorHandler: OutputBuffer.Options.errorHandler,
                    EOL
                });

                ob.close();
            } catch (err) {
                ob.close();
                throw err;
            }
        });
    });

    describe("OutputBuffer.prototype.push(...data: any[]), get() and close()", () => {
        it("should push data into the buffer and log to the console as expected", () => {
            let ob = new OutputBuffer();

            ob.push("Hello, World!");
            assert.equal(ob.get(), "Hello, World!");

            ob.push("Hi, Ayon!");

            assert.equal(ob.get(), "Hello, World!" + "\n" + "Hi, Ayon!");

            ob.push({ hello: "world!" });

            assert.equal(ob.get(), [
                "Hello, World!",
                "Hi, Ayon!",
                "{ hello: 'world!' }"
            ].join("\n"));

            ob.close();
            assert.ok(ob.closed);
        });

        it("should push data into the buffer and log to a file as expected", (done) => {
            if (fs.existsSync(file1)) {
                fs.unlinkSync(file1); // remove file if exists.
            }

            let ob = new OutputBuffer(file1);

            ob.push("Hello, World!");
            assert.equal(ob.get(), "Hello, World!");

            ob.push("Hi, Ayon!");

            assert.equal(ob.get(), "Hello, World!" + EOL + "Hi, Ayon!");

            ob.push({ hello: "world!" });

            assert.equal(ob.get(), fileContents);

            ob.close();
            assert.ok(ob.closed);

            setTimeout(() => {
                assert.ok(fs.existsSync(file1));
                assert.equal(fs.readFileSync(file1, "utf8"), fileContents + EOL);

                done();
            }, 1500);
        });

        it("should push data into the buffer and log to a file in 2 seconds", function (done) {
            this.timeout(3000);

            if (fs.existsSync(file2)) {
                fs.unlinkSync(file2); // remove file if exists.
            }

            let ob = new OutputBuffer(file2, {
                ttl: 2000
            });

            ob.push("Hello, World!");
            assert.equal(ob.get(), "Hello, World!");

            ob.push("Hi, Ayon!");

            assert.equal(ob.get(), "Hello, World!" + EOL + "Hi, Ayon!");

            ob.push({ hello: "world!" });

            assert.equal(ob.get(), fileContents);

            ob.close();
            assert.ok(ob.closed);

            setTimeout(() => {
                assert.ok(fs.existsSync(file2));
                assert.equal(fs.readFileSync(file2, "utf8"), fileContents + EOL);

                done();
            }, 2500);
        });

        it("should push data into the buffer and log to a file when the buffer size up to limit or the process exit", () => {
            if (fs.existsSync(file3)) {
                fs.unlinkSync(file3); // remove file if exists.
            }

            let ob = new OutputBuffer(file3, {
                size: 4096
            });

            ob.push("Hello, World!");
            assert.equal(ob.get(), "Hello, World!");

            ob.push("Hi, Ayon!");

            assert.equal(ob.get(), "Hello, World!" + EOL + "Hi, Ayon!");

            ob.push({ hello: "world!" });

            assert.equal(ob.get(), fileContents);
        });
    });
});

describe("OutputBuffer.prototype.destroy()", () => {
    it("should destroy the buffer as expected", () => {
        let ob = new OutputBuffer(file3, {
            size: 4096
        });

        ob.push("Hello, World!");
        assert.equal(ob.get(), "Hello, World!");

        ob.push("Hi, Ayon!");

        assert.equal(ob.get(), "Hello, World!" + EOL + "Hi, Ayon!");

        ob.push({ hello: "world!" });

        assert.equal(ob.get(), fileContents);

        ob.destroy();

        assert.equal(ob.get(), "");
        assert.ok(ob.closed);
    });
});