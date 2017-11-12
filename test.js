const OutputBuffer = require("./");

var ob = new OutputBuffer();
ob.size = 50;
var count = 0;
var i = setInterval(() => {
    ob.push("Hello, World!");
    count += 1;
    if (count == 10) {
        ob.close();
        clearInterval(i);
    }
}, 1500);