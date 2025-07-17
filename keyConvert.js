const fs = require("fs");
const key = fs.readFileSync("./daily-market-bd-fb-token.json");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);
