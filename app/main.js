const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const simpleDataTypes = ["+", "-", ":", "#", "("];
const aggregateDataTypes = ["*", "$"];

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const command = data.toString().trim().split("\r\n");
    let commandLength = 0;
    if (command[0].substring(0, 1) === "*") {
      commandLength = parseInt(command[0].substring(1), 10);
    }
    let i = 0;
    if (command[2].toLowerCase() === "ping") {
      connection.write("+PONG\r\n");
    } else if (command[2].toLowerCase() === "echo") {
      connection.write(`+${command[4]}\r\n`);
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
