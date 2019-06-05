<script>
  import client from 'rhea';
  var server = "ws://127.0.0.1:8080";
  client.on("message", function (context) {
      console.log("Got message?");
  });
  client.on("connection_open", function (context) {
      console.log("Connected!");
  });
  var ws = client.websocket_connect(WebSocket);
  console.log("Connecting");
  client.options.username = "test";
  client.options.password = "test";
  var connection = client.connect({"connection_details":ws(server, ["binary", "AMQPWSB10", "amqp"]), "reconnect":false});
  console.log("Opening receiver");
  connection.open_receiver("events");
</script>

<style>
	h1 {
		color: purple;
	}
</style>

<h1>Teig Dashboard</h1>
