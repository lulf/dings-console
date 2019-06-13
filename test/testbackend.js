var container = require('rhea');

var args = require('../options.js').options({
    'm': { alias: 'messages', default: 0, describe: 'number of messages to expect'},
    'p': { alias: 'port', default: 8888, describe: 'port to listen on'}
}).help('help').argv;

var received = 0;
var expected = args.messages;
var listeners = {};

var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({'port':args.port});
server.on('connection', function (ws) {
    console.log('Accepted incoming websocket connection');
    container.websocket_accept(ws);
});

function subscribe(name, sender) {
    listeners[name] = sender;
}

function unsubscribe(name) {
    delete listeners[name];
}

container.on('sender_open', function (context) {
    subscribe(context.connection.remote.open.container_id, context.sender);
});
container.on('sender_close', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});
container.on('connection_close', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});
container.on('disconnected', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});

var value = 0.0;
setInterval(function (context) {
    for (var name in listeners) {
        if (value > (2 * Math.PI)) {
            value = 0.0;
        }
        var message = {deviceId: "Dings 1", creationTime: Date.now(), payload: value};
        listeners[name].send(message);
    }
}, 1000);
