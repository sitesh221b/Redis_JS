const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const simpleDataTypes = ["+", "-", ":", "#", "("];
const aggregateDataTypes = ["*", "$"];
const globalMap = {};

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const command = data.toString().trim().split("\r\n");
    let commandLength = 0;
    let i = 0;
    if (command[0].substring(0, 1) === "*") {
      commandLength = parseInt(command[0].substring(1), 10);
      i = 2;
    }
    while (i < command.length) {
      switch (command[i].toLowerCase()) {
        case "ping": {
          connection.write("+PONG\r\n");
          i++;
          break;
        }
        case "echo": {
          connection.write(`+${command[i + 2]}\r\n`);
          i += 2;
          break;
        }
        case "set": {
          const key = command[i + 2];
          const value = command[i + 4];
          globalMap[key] = value;
          if (command[i + 6] && command[i + 6].toLowerCase() === "px") {
            const expirationTime = parseInt(command[i + 8], 10);
            setTimeout(() => {
              delete globalMap[key];
            }, expirationTime);
            i += 9;
          } else if (command[i + 6] && command[i + 6].toLowerCase() === "ex") {
            const expirationTime = parseInt(command[i + 8], 10);
            setTimeout(() => {
              delete globalMap[key];
            }, expirationTime * 1000);
            i += 9;
          } else {
            i += 5;
          }
          connection.write(`+OK\r\n`);
          break;
        }
        case "get": {
          const key = command[i + 2];
          if (globalMap[key]) {
            connection.write(
              `$${globalMap[key].length}\r\n${globalMap[key]}\r\n`
            );
          } else {
            connection.write("$-1\r\n");
          }
          i += 3;
          break;
        }
        case "rpush": {
          const keyRPush = command[i + 2];
          if (!globalMap[keyRPush]) {
            globalMap[keyRPush] = [];
          }
          commandLength -= 2;
          i += 4;
          while (commandLength) {
            const valueRPush = command[i];
            globalMap[keyRPush].push(valueRPush);
            commandLength--;
            i += 2;
          }
          connection.write(`:${globalMap[keyRPush].length}\r\n`);
          i += 5;
          break;
        }
        case "lrange": {
          const keyLRange = command[i + 2];
          const start = parseInt(command[i + 4], 10);
          const end = parseInt(command[i + 6], 10);
          if (globalMap[keyLRange] && Array.isArray(globalMap[keyLRange])) {
            if (start > end || start >= globalMap[keyLRange].length) {
              connection.write("*0\r\n");
            }
            if (end >= globalMap[keyLRange].length) {
              end = globalMap[keyLRange].length - 1;
            }
            const range = globalMap[keyLRange].slice(start, end - start + 1);
            connection.write(`*${range.length}\r\n`);
            range.forEach((item) => {
              connection.write(`$${item.length}\r\n${item}\r\n`);
            });
          } else {
            connection.write("*0\r\n");
          }
          i += 7;
          break;
        }
        default:
          break;
      }
    }
  });

  connection.on("error", (err) => {
    console.error("Connection error:", err);
  });

  connection.on("end", () => {
    console.log("Connection ended");
  });
});

server.listen(6379, "127.0.0.1");
