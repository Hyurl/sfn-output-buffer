# SFN-Output-Buffer

**Simple Friendly Node.js Output Buffer.**

## Install

```sh
npm install sfn-output-buffer --save
```

## Import

```javascript
const OutputBuffer = require("sfn-output-buffer");
```

## Example

```javascript
var ob = new OutputBuffer({
    size: 50,
    filename: "example.log"
});

var count = 0;
var i = setInterval(() => {
    ob.push("Hello, World!"); // Push data into the buffer.

    count += 1;
    if (count == 10) {
        ob.close(); // Close the buffer.
        clearInterval(i);
    }
}, 1500);
```

## API

- `new OutputBuffer([options: any])` Creates a new output buffer.
- `ob.push(...data: any)` Pushes data into the buffer.
- `ob.get(): string` Gets buffer contents.
- `ob.clean()` Cleans buffer contents without flushing.
- `ob.destroy()` Destroys the buffer without flushing.
- `ob.close()` Closes the buffer safely, buffer will be flushed before 
    destroying.
- `ob.closed` Whether the buffer is closed.

## new OutputBuffer()

- `[options]` Include these options:
    - `ttl` Time to live, default is `1000`ms.
    - `size` Buffer size, if set, then `ttl` will be ignored.
    - `filename` Flush buffer to a disk file.
    - `fileSize` Maximum size of the output file.
    - `limitHandler` A function called when the output file's size up to 
        limit, rewrite by default.
    - `errorHandler` A function called when any error occurred in the 
        asynchronous timer scope.
    
    If this parameter is passed as a string, then it will be treated as 
    a `filename`.

```javascript
// Simplest way, buffer will be flushed to console every 1000 ms.
var ob = new OutputBuffer();

// Flush buffer to a file in 1000 ms:
var ob = new OutputBuffer("example.log");

// Flush buffer to a file when the buffer size up to 1 Mb:
var ob = new OutputBuffer({
    size: 1024 * 1024,
    filename: "example.log"
});

// Rewrite the output file when its size up to 10 Mb:
var ob = new OutputBuffer({
    size: 1024 * 1024,
    filename: "example.log",
    fileSize: 1024 * 1024 * 10
});

// Customize handlers:
var ob = new OutputBuffer({
    ttl: 10000, // Flush buffer every 10 seconds.
    filename: "example.log",
    fileSize: 1024 * 1024 * 10,
    limitHandler: (filename, data, next) => {
        // Do some stuffs...
        next(); // Must call next(), otherwise the timer-chain will be broken.
    },
    errorHandler: (e) => {
        console.error(e);
    }
});
```

## Thread Safety

This module is thread-safe, that means no matter how many times you create a 
new instance, if only they are specified to the same output file, then they 
will share the same memory storage of the buffer, and only one timer will be 
generated for flushing data to the file.