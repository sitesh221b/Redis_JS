const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const simpleDataTypes = ["+", "-", ":", "#", "("];
const aggregateDataTypes = ["*", "$"];
const globalMap = {};

const setter = (command, conn) => {
    const key = command[2];
    const value = command[4];
    globalMap[key] = value;
    if (command[6] && command[6].toLowerCase() === "px") {
        const expirationTime = parseInt(command[8], 10);
        setTimeout(() => {
            delete globalMap[key];
        }, expirationTime);
    } else if (command[6] && command[6].toLowerCase() === "ex") {
        const expirationTime = parseInt(command[8], 10);
        setTimeout(() => {
            delete globalMap[key];
        }, expirationTime * 1000);
    }
    conn.write(`+OK\r\n`);
};

const getter = (command, conn) => {
    const key = command[4];
    if (globalMap[key]) {
        conn.write(`$${globalMap[key].length}\r\n${globalMap[key]}\r\n`);
    } else {
        conn.write("$-1\r\n");
    }
};

const listPush = (command, conn) => {
    const keyRPush = command[4];
    let commandLength = parseInt(command[0].substring(1), 10);
    if (!globalMap[keyRPush]) {
        globalMap[keyRPush] = [];
    }
    commandLength -= 2;
    let i = 6;
    while (commandLength) {
        const valueRPush = command[i];
        globalMap[keyRPush].push(valueRPush);
        commandLength--;
        i += 2;
    }
    conn.write(`:${globalMap[keyRPush].length}\r\n`);
};

const listRange = (command, conn) => {
    // *4 $5 lrange $3 key $5 value1 $5 value2
    const keyLRange = command[2];
    const start = parseInt(command[4], 10);
    const end = parseInt(command[6], 10);
    if (globalMap[keyLRange] && Array.isArray(globalMap[keyLRange])) {
        if (start > end || start >= globalMap[keyLRange].length) {
            conn.write("*0\r\n");
        }
        if (end >= globalMap[keyLRange].length) {
            end = globalMap[keyLRange].length - 1;
        }
        const range = globalMap[keyLRange].slice(start, end - start + 1);
        conn.write(`*${range.length}\r\n`);
        range.forEach((item) => {
            conn.write(`$${item.length}\r\n${item}\r\n`);
        });
    } else {
        conn.write("*0\r\n");
    }
};

const getResponse = (command, conn) => {
    const mainCommand = command[2].toLowerCase();
    switch (mainCommand) {
        case "ping":
            connection.write("+PONG\r\n");
            break;
        case "echo":
            connection.write(`+${command[4]}\r\n`);
            break;
        case "get":
            getter(command, conn);
            break;
        case "set":
            setter(command, conn);
            break;
        case "rpush":
            listPush(command, conn);
            break;
        case "lrange":
            listRange(command, conn);
            break;
        default:
            break;
    }
};

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {
    connection.on("data", (data) => {
        const command = data.toString().trim().split("\r\n");
        getResponse(command, connection);
    });

    connection.on("error", (err) => {
        console.error("Connection error:", err);
    });

    connection.on("end", () => {
        console.log("Connection ended");
    });
});

server.listen(6379, "127.0.0.1");
