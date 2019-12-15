<script>
  import ApolloClient from 'apollo-boost';
  import Chart from 'chart.js';
  import gql from "graphql-tag";

  const client = new ApolloClient({
    uri: 'http://api.teig.cloud:8080/graphql'
  });

  console.log("Creating graphql sub");
  var sensorTypes = ["motion", "temperature"];
  var deviceData = new Map();
  var deviceInfo = new Map();
  var charts = {};
  var window = 6 * 60 * 60; // 6 hours
  var now = Math.floor(Date.now() / 1000);
  var since = now - window; 
  console.log("Since " + since);
  const deviceQuery = gql`query Query {
      devices {
        id
        name
        description
        enabled
        sensors
      }
    }`;


  const deviceObservable = client.watchQuery({query: deviceQuery, pollInterval: 10000});
  deviceObservable.subscribe({
    next: ({data}) => {
      for (var idx in data.devices) {
        var device = data.devices[idx];
        console.log("Id: " + device.id);
        if (deviceData.get(device.id) === undefined) {
          var sensorData = new Map();
          for (var sensorIdx in device.sensors) {
            var sensor = device.sensors[sensorIdx];
            console.log("Registering sensor " + sensor + " for device " + device.id);
            sensorData.set(sensor, []);
          }
          deviceData.set(device.id, sensorData);
          deviceInfo.set(device.id, device);
        }
        
        const eventObservable = client.watchQuery({
          query: gql`query Query {
            events (deviceId: "${device.id}", since: ${since}) {
              creationTime
              data {
                temperature
                motion
              }
            }
          }`,
          pollInterval: 5000,
        });
        eventObservable.subscribe({
          next: ({data}) => {
            var events = data.events
            for (var eidx in events) {
              var event = events[eidx];
              for (var dataKey in event.data) {
                if (deviceData.get(device.id).get(dataKey) !== undefined) {
                  var entry = {timestamp: event.creationTime, value: event.data[dataKey]};
                  deviceData.get(device.id).get(dataKey).push(entry);
                }
              }
            }  
          }
        });
      }
    }
  });

  var updateCharts = function () {
    for (var [deviceId, sensors] of deviceData) {
      for (var [sensorId, sensorData] of sensors) {
        var date = new Date(sensorData.timestamp * 1000);
        var formatted_date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

        var chartName = "chart_" + deviceId + "_" + sensorId;
        if (charts[chartName] === undefined) {
          var element = document.getElementById(chartName);
          if (element != null) {
            var ctx = element.getContext('2d');
            const cdata = {
              labels: sensorData.map(function (v) { return new Date(v.timestamp * 1000); }),
              datasets: [
                {
                  fill: false,
                  label: 'Motion',
                  data: sensorData.map(function (v) { return v.value ? 1 : 0; }),
                  borderColor: '#fe8b36',
                  backgroundColor: '#fe8b36',
                  lineTension: 0,
                  steppedLine: true,
                }
              ]
            };
            const options = {
              legend: {
                display: false
              },
              fill: false,
              responsive: true,
              scales: {
                xAxes: [
                  {
                    type: 'time',
                    display: true,
                    ticks: {
                      min: since,
                      max: now
                    },
                    scaleLabel: {
                      display: true,
                      labelString: "Date"
                    }
                  }
                ],
                yAxes: [
                  {
                    ticks: {
                      padding: 5,
                      display: false,
                      beginAtZero: true,
                      min: 0,
                      max: 1.5,
                    },
                    display: true,
                    scaleLabel: {
                      display: true,
                      labelString: "Motion"
                    }
                  }
                ]
              }
            };
            var chart = new Chart(ctx, {
              type: 'line',
              data: cdata,
              options: options
            });
            charts[chartName] = chart;
          }
        }/* else {
          chart = charts[chartName];
          chart.data.labels.push(value.date);
          chart.data.datasets.forEach((dataset) => {
            dataset.data.push(value.data);
           });
           chart.update();
        }
        */
      }
    }
  };

  var updateState = function () {
  /*
    for (var [deviceId, sensors] of deviceData) {
        for (var [sensorId, sensorData] of sensors) {
            console.log("Data for " + deviceId + " sensor " + sensorId + ": " + JSON.stringify(sensorData));
        }
    }
    */
    updateCharts();
    deviceData = deviceData;
    deviceInfo = deviceInfo;
    setTimeout(updateState, 5000);
  };

  setTimeout(updateState, 5000);
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

<h2>Dingser (totalt {deviceInfo.size})</h2>

<table>
<tr>
<th>Dings</th>
<th colspan="{sensorTypes.length}">Historikk</th>
</tr>
{#each Array.from(deviceData.keys()) as device}
<tr>
<td>
{deviceInfo.get(device).description}
</td>
{#each Array.from(deviceData.get(device).keys()) as sensor}
<td>
<canvas id="chart_{device}_{sensor}" width="400" height="150"></canvas>
</td>
{/each}
</tr>
{/each}

</table>
