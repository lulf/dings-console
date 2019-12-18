<script>
  import ApolloClient from 'apollo-boost';
  import Chart from 'chart.js';
  import gql from "graphql-tag";

  const client = new ApolloClient({
    uri: 'http://api.teig.cloud:8080/graphql'
  });

  var sensorTypes = ["motion", "temperature"];
  var deviceData = new Map();
  var deviceInfo = new Map();
  var charts = {};
  var window = 4 * 60 * 60; // 24 hours
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
      var now = Math.floor(Date.now() / 1000);
      var since = now - window; 
      for (var idx in data.devices) {
        var device = data.devices[idx];
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
        
        deviceInfo = deviceInfo;
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
            var entries = {};
            for (var eidx in events) {
              var event = events[eidx];
              for (var dataKey in event.data) {
                if (deviceData.get(device.id).get(dataKey) !== undefined) {
                  var entry = {timestamp: event.creationTime};
                  entry[dataKey] = event.data[dataKey];
                  if (entries[dataKey] === undefined) {
                    entries[dataKey] = [];
                  }
                  entries[dataKey].push(entry);
                }
              }
            }
            for (var dataKey in entries) {
              deviceData.get(device.id).set(dataKey, entries[dataKey]);
            }
            updateChart(device.id);
          }
        });
      }
    }
  });

  var motionChart = function (options, dataset, sensorData) {
    dataset.label = 'Motion';
    dataset.data = sensorData.map(function (v) { return v.motion === true ? 1 : 0; });
    dataset.steppedLine = true;
    options.elements = {
      point: {
        radius: 0
      }
    };
    options.scales.yAxes = [
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
    ];
  };

  var updateChart = function (deviceId) {
    var now = Math.floor(Date.now() / 1000);
    var since = now - window; 
    var sensors = deviceData.get(deviceId);
    if (sensors !== undefined) {
      for (var [sensorId, sensorData] of sensors) {
        var chartName = "chart_" + deviceId + "_" + sensorId;
        var element = document.getElementById(chartName);
        sensorData = sensorData.filter(function (v) {
          return v.timestamp >= since;
        });
        labels = [new Date(since * 1000)];
        labels.push(sensorData.map(function (v) { return new Date(v.timestamp * 1000); }));
        labels.push(new Date(now * 1000));
        if (element != null) {
          var cdata = {
            labels: labels,
            datasets: [
              {
                fill: false,
                borderColor: '#fe8b36',
                backgroundColor: '#fe8b36',
                lineTension: 0,
              }
            ]
          };
          var options = {
            animation: false,
            legend: {
              display: false
            },
            fill: false,
            responsive: true,
            scales: {
              bounds: 'ticks',
              xAxes: [
                {
                  type: 'time',
                  display: true,
                  distribution: 'linear',
                  source: 'auto',
                  bounds: 'ticks',
                  ticks: {
                    bounds: 'ticks',
                  },
                  scaleLabel: {
                    display: false,
                    labelString: "Date"
                  }
                }
              ],
            }
          };
          if (sensorId == "motion") {
            motionChart(options, cdata.datasets[0], sensorData);
          }

          console.log("Cdata (data: " + cdata.datasets[0].data.length + ", labels: " + cdata.labels.length + ": " + JSON.stringify(cdata.datasets[0].data));
          var ctx = element.getContext('2d');
          if (charts[chartName] === undefined) {
            console.log("Creating new chart " + chartName);
            var chart = new Chart(ctx, {
              type: 'line',
              data: cdata,
              options: options
            });
            charts[chartName] = chart;
          } else {
            console.log("Updating chart " + chartName);
            chart = charts[chartName];
            chart.data = cdata;
            chart.options = options;
            chart.update();
          }
        }
      }
    }
  };

  var updateState = function () {
    for (var [deviceId, sensors] of deviceData) {
        updateChart(deviceId);
        /*
        for (var [sensorId, sensorData] of sensors) {
            console.log("Data for " + deviceId + " sensor " + sensorId + ": " + JSON.stringify(sensorData));
        }
        */
    }
    deviceInfo = deviceInfo;
    setTimeout(updateState, 30000);
  };
  setTimeout(updateState, 30000);

</script>

<style>
  div {
    border: 1px solid black;
  }
  table, th, td {
    border: 1px solid black;
  }
</style>

<h1>Teig Console</h1>

<h2>Dingser (totalt {deviceInfo.size})</h2>

<table>
<tr>
<th>Dings</th>
<th colspan="{sensorTypes.length}">Historikk</th>
</tr>
{#each Array.from(deviceInfo.keys()) as device}
<tr>
<td>
{deviceInfo.get(device).description}
</td>
{#each Array.from(deviceInfo.get(device).sensors) as sensor}
<td>
<canvas id="chart_{device}_{sensor}" width="800" height="200"></canvas>
</td>
{/each}
</tr>
{/each}

</table>
