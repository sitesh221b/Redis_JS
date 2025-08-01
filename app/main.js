const net = require("net");

const globalMap = {};
const streamData = new Map();

const setter = (command, conn) => {
    const key = command[4];
    const value = command[6];
    globalMap[key] = { value };
    if (command[8] && command[8].toLowerCase() === "px") {
        const expirationTime = parseInt(command[10], 10);
        // setTimeout(() => {
        //     delete globalMap[key];
        // }, expirationTime);
        globalMap[key].expiration = Date.now() + expirationTime;
    } else if (command[8] && command[8].toLowerCase() === "ex") {
        const expirationTime = parseInt(command[10], 10);
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
            return;
        }
        conn.write(
            `$${globalMap[key].value.length}\r\n${globalMap[key].value}\r\n`
        );
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
    } else if (streamData.has(keyType)) {
        conn.write(`+stream\r\n`);
    } else {
        conn.write(`+none\r\n`);
    }
};

const verifyStreamId = (streamId, streamKey) => {
    if (streamId === "0-0") {
        return "-ERR The ID specified in XADD must be greater than 0-0\r\n";
    }
    if (streamData.has(streamKey)) {
        const lastId = streamData.get(streamKey).slice(-1)[0].id;
        const milliseconds = parseInt(streamId.split("-")[0], 10);
        const sequence = parseInt(streamId.split("-")[1], 10);
        const lastMilliseconds = parseInt(lastId.split("-")[0], 10);
        const lastSequence = parseInt(lastId.split("-")[1], 10);
        if (
            milliseconds < lastMilliseconds ||
            (milliseconds === lastMilliseconds && sequence <= lastSequence)
        ) {
            return "-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n";
        }
    }
    return null;
};

const autoGenSequence = (streamKey, streamId) => {
    if (streamData.has(streamKey)) {
        const lastId = streamData.get(streamKey).slice(-1)?.[0].id;
        //const milliseconds = parseInt(lastId.split("-")[0], 10);
        const sequence = parseInt(lastId.split("-")[1], 10) + 1;
        return `${sequence}`;
    } else {
        const sequence = 1;
        return `${sequence}`;
    }
};

const addToStream = (command, conn) => {
    const streamKey = command[4];
    let streamId = command[6];
    if (streamId.split("-")[1] === "*") {
        const sequence = autoGenSequence(streamKey, streamId);
        streamId = streamId.replace("*", sequence);
        conn.write(`$${streamId.length}\r\n${streamId}\r\n`);
    }
    const error = verifyStreamId(streamId, streamKey);
    if (error) {
        conn.write(error);
        return;
    }
    const streamValues = command.slice(8);
    const data = {};
    for (let i = 0; i < streamValues.length; i += 4) {
        data[streamValues[i]] = streamValues[i + 2];
    }
    if (streamData.has(streamKey)) {
        streamData.get(streamKey).push({
            id: streamId,
            ...{ data },
        });
    } else {
        streamData.set(streamKey, [
            {
                id: streamId,
                ...{ data },
            },
        ]);
    }

    conn.write(`$${streamId.length}\r\n${streamId}\r\n`);
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
            case "xadd":
                addToStream(command, conn);
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
