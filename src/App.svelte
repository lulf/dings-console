<script>
  import client from 'rhea';
  import Chart from 'chart.js';
  // var server = "wss://127.0.0.1:8443";
  var server = "ws://127.0.0.1:8080";
  var deviceData = new Map();
  var lastValue = {};
  var lastUpdate = {};
  var charts = {};
  let sanitize_device_id = function(id) {
      return id.toLowerCase().split(" ").join("_");
  };
  client.on("message", function (context) {
      //console.log("Got message: " + context.message.body);
      var data = JSON.parse(context.message.body);
      if (deviceData.get(data.deviceId) === undefined) {
        deviceData.set(data.deviceId, []);
      }

      var date = new Date(data.creationTime * 1000);
      // TODO: Fix this ugly bugly stuff and use proper formatter
      var formatted_date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
      var value = {timestamp: data.creationTime, data: data.payload, fdate: formatted_date, date: date};
      if (lastValue[data.deviceId] === undefined || lastValue[data.deviceId].timestamp < data.creationTime) {
         lastValue[data.deviceId] = value;
      }
      deviceData.get(data.deviceId).push(value);
      deviceData = deviceData;
      lastValue = lastValue;

      // Update chart for device
      if (charts[data.deviceId] === undefined) {
          var canvasId = sanitize_device_id("chart_" + data.deviceId);
          var element = document.getElementById(canvasId);
          if (element != null) {
            var ctx = element.getContext('2d');

            const cdata = {
                  labels: deviceData.get(data.deviceId).map(function (v) { return v.date; }),
                  // deviceData.get(data.deviceId).map(function (v) { return v.date; }),
                  datasets: [{
                            fill: false,
                            label: 'Temperatur',
                            data: deviceData.get(data.deviceId).map(function (v) { return v.data; }),
                            borderColor: '#fe8b36',
                            backgroundColor: '#fe8b36',
                            lineTension: 0
                  }]
            };

            const options = {
                  legend: {
                          display: false
                  },
                  fill: false,
                  responsive: true,
                  scales: {
                          xAxes: [{
                                type: 'time',
                                display: true,
                                scaleLabel: {
                                            display: true,
                                            labelString: "Date"
                                }
                          }],
                          yAxes: [{
                                ticks: {
                                        padding: 5
                                },
                                display: true,
                                scaleLabel: {
                                            display: true,
                                            labelString: "Temperatur"
                                }
                          }]
                  }
            };

            var chart = new Chart(ctx, {
                type: 'line',
                data: cdata,
                options: options
            });
            charts[data.deviceId] = chart;
            }
         } else {
           chart = charts[data.deviceId];
           chart.data.labels.push(value.date);
           chart.data.datasets.forEach((dataset) => {
                                                 dataset.data.push(value.data);
           });
           chart.update();
         }
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
  connection.open_receiver({source:{address:"events",filter:{"offset": 0}}});
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
<td>{lastValue[device].fdate}</td>
<td>{lastValue[device].data}</td>
<td><canvas id="chart_{sanitize_device_id(device)}" width="400" height="150"></canvas></td>
</tr>
{/each}

</table>
