<script>
  import client from 'rhea';
//  import Chart from 'chart.js';
  // var server = "wss://127.0.0.1:8443";
  var server = "ws://127.0.0.1:8080";
  var deviceData = new Map();
  var lastValue = {};
  var lastUpdate = {};
  client.on("message", function (context) {
      //console.log("Got message: " + context.message.body);
      var data = JSON.parse(context.message.body);
      if (!(data.deviceId in deviceData)) {
        deviceData.set(data.deviceId, []);
      }

      var date = new Date(data.creationTime * 1000);
      var formatted_date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
      var value = {timestamp: data.creationTime, data: data.payload, date: formatted_date};
      if (lastValue[data.deviceId] === undefined || lastValue[data.deviceId].timestamp < data.creationTime) {
         lastValue[data.deviceId] = value;
      }
      deviceData.get(data.deviceId).push(value);
      deviceData = deviceData;
      lastValue = lastValue;
  });
  client.on("connection_open", function (context) {
      console.log("Connected!");
  });
  var ws = client.websocket_connect(WebSocket);
  console.log("Connecting");
  client.options.username = "test";
  client.options.password = "test";
  // TODO: Enable TLS
  // client.options.transport = "tls";
  // client.options.rejectUnauthorized = false;
  // var connection = client.connect({"connection_details":ws(server, ["binary", "AMQPWSB10", "amqps"]), "reconnect":false});
  var connection = client.connect({"connection_details":ws(server, ["binary", "AMQPWSB10", "amqp"]), "reconnect":false});
  connection.open_receiver("events");
</script>

<style>
  div {
    border: 1px solid black;
  }
  table, th, td {
    border: 1px solid black;
  }
</style>

<h1>Teig Dashboard</h1>

<h2>Dingser (totalt {deviceData.size})</h2>

<!-- TODO: Support groups -->
<h3>Potetlager</h3>

<table>
<tr>
<th>Dings</th>
<th>Sist oppdatert</th>
<th>Siste måling</th>
<th>Historikk</th>
</tr>
{#each Array.from(deviceData.keys()) as device}
<tr>
<td>{device}</td>
<td>{lastValue[device].date}</td>
<td>{lastValue[device].data}</td>
<td>Graph!</td>
</tr>
{/each}

</table>