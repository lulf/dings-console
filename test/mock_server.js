var container = require('rhea');

var listeners = {};

var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({'port':8080});
server.on('connection', function (ws) {
    console.log('Accepted incoming websocket connection');
    container.websocket_accept(ws);
});
function authenticate(username, password) {
    return true;
}
container.sasl_server_mechanisms.enable_plain(authenticate);
function subscribe(name, sender) {
    listeners[name] = sender;
}

container.on('sender_open', function (context) {
    subscribe(context.connection.remote.open.container_id, context.sender);
});

var values = [];
for (var i = 1; i <= 5; i++) {
    // Start at different phase of the sinus curve
    values[i] = Math.random() * 2 * Math.PI;

    // Wait for a random amount of seconds before starting
    setTimeout(function(id) {
        // Send updated payload every 1 second
        setInterval(function (context) {
            for (var name in listeners) {
                values[id] += 0.1;
                var message = {body:"{\"deviceId\":\"Dings " + id + "\",\"creationTime\": " + Date.now() / 1000 + ",\"payload\": " + Math.sin(values[id]) + "}"};
                listeners[name].send(message);
            }
        }, 1000);
    }, 1000 * Math.random(), i);
}
