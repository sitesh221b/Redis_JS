const net = require("net");

const globalMap = {};

const setter = (command, conn) => {
    const key = command[4];
    const value = command[6];
    globalMap[key] = { value };
    if (command[8] && command[8].toLowerCase() === "px") {
        const expirationTime = parseInt(command[8], 10);
        // setTimeout(() => {
        //     delete globalMap[key];
        // }, expirationTime);
        globalMap[key].expiration = Date.now() + expirationTime;
    } else if (command[8] && command[8].toLowerCase() === "ex") {
        const expirationTime = parseInt(command[8], 10);
        // setTimeout(() => {
        //     delete globalMap[key];
        // }, expirationTime * 1000);
        globalMap[key].expiration = Date.now() + expirationTime * 1000;
    }
    conn.write(`+OK\r\n`);
};

const getter = (command, conn) => {
    const key = command[4];
    if (globalMap[key]) {
        if (
            globalMap[key].expiration &&
            Date.now() > globalMap[key].expiration
        ) {
            //delete globalMap[key];
            conn.write("$-1\r\n");
        } else {
            conn.write(
                `$${globalMap[key].value.length}\r\n${globalMap[key].value}\r\n`
            );
        }
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
    const keyLRange = command[4];
    const start = parseInt(command[6], 10);
    let end = parseInt(command[8], 10);
    if (globalMap[keyLRange] && Array.isArray(globalMap[keyLRange])) {
        if (start > end || start >= globalMap[keyLRange].length) {
            console.log("Invalid range: start > end or start >= length");
            conn.write("*0\r\n");
        }
        // if (end >= globalMap[keyLRange].length) {
        //     end = globalMap[keyLRange].length - 1;
        // }
        //
        const range = globalMap[keyLRange].slice(start, end + 1);
        console.log(
            "Start:",
            start,
            "End:",
            end,
            "Range Length:",
            range.length
        );
        conn.write(`*${range.length}\r\n`);
        range.forEach((item) => {
            conn.write(`$${item.length}\r\n${item}\r\n`);
        });
    } else {
        conn.write("*0\r\n");
    }
};

const getType = (command, conn) => {
    const keyType = command[4];
    if (globalMap[keyType]) {
        if (Array.isArray(globalMap[keyType])) {
            conn.write(`+list\r\n`);
        } else {
            conn.write(`+string\r\n`);
        }
    } else {
        conn.write(`+none\r\n`);
    }
};

const getResponse = (command, conn) => {
    try {
        const mainCommand = command[2].toLowerCase();
        switch (mainCommand) {
            case "ping":
                conn.write("+PONG\r\n");
                break;
            case "echo":
                conn.write(`+${command[4]}\r\n`);
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
            case "type":
                getType(command, conn);
                break;
            default:
                break;
        }
    } catch (error) {
        console.error("Error processing command:", command);
        throw error;
    } finally {
    }
};

const server = net.createServer((connection) => {
    connection.on("data", (data) => {
        const command = data.toString().trim().split("\r\n");
        // const command = [
        //     "*4",
        //     "$6",
        //     "LRANGE",
        //     "$5",
        //     "apple",
        //     "$1",
        //     "0",
        //     "$2",
        //     "10",
        //     "",
        // ];
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
