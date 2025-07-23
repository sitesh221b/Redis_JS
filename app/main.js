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
      if (command[i].toLowerCase() === "ping") {
        connection.write("+PONG\r\n");
        i++;
      } else if (command[i].toLowerCase() === "echo") {
        connection.write(`+${command[i + 2]}\r\n`);
        i += 2;
      } else if (command[i].toLowerCase() === "set") {
        const key = command[i + 2];
        const value = command[i + 4];
        globalMap[key] = value;
        connection.write(`+OK\r\n`);
        i += 5;
      } else if (command[i].toLowerCase() === "get") {
        const key = command[i + 2];
        if (globalMap[key]) {
          connection.write(
            `$${globalMap[key].length}\r\n${globalMap[key]}\r\n`
          );
        } else {
          connection.write("$-1\r\n");
        }
        i += 3;
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
