<script>
  import ApolloClient from 'apollo-boost';
  import Chart from 'chart.js';
  import gql from "graphql-tag";

  const client = new ApolloClient({
    uri: 'http://api.teig.cloud:8080/graphql'
  });

  const sensorTypes = ["motion", "temperature"];
  var deviceData = new Map();
  var deviceInfo = new Map();
  var charts = {};
  const window = 4 * 60 * 60; // 4 hours
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
      const now = Math.floor(Date.now() / 1000);
      const since = now - window; 
      for (var idx in data.devices) {
        const device = data.devices[idx];
        if (deviceData.get(device.id) === undefined) {
          var sensorData = new Map();
          for (var sensorIdx in device.sensors) {
            const sensor = device.sensors[sensorIdx];
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
                temperature {
                  celcius
                  humidity
                  heatindexCelcius
                }
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
              const event = events[eidx];
              for (var dataKey in event.data) {
                if (deviceData.get(device.id).get(dataKey) !== undefined) {
                  // console.log("Found defined sensor " + dataKey + " for " + device.id);
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

  var defaultChartOptions = function(min, max) {
    return {
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
            time: {
              min: new Date(min * 1000),
              max: new Date(max * 1000),
            },
            scaleLabel: {
              display: false,
              labelString: "Date"
            }
          }
        ],
      }
    };
  };

  const chartBackgroundColor = '#fe8b36';
  const chartBorderColor = '#fe8b36';

  const motionChart = function (options, cdata, sensorData) {
    cdata.labels = sensorData.map(function (v) { return new Date(v.timestamp * 1000); });

    cdata.datasets = [
      {
        fill: false,
        borderColor: chartBorderColor,
        backgroundColor: chartBackgroundColor,
        lineTension: 0,
        label: 'Motion',
        steppedLine: true,
        data: sensorData.map(function (v) { return v.motion === true ? 1 : 0; }),
      }
    ];

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

  const temperatureChart = function (options, cdata, sensorData) {
    cdata.labels = sensorData.map(function (v) { return new Date(v.timestamp * 1000); });

    cdata.datasets = [
      {
        fill: false,
        borderColor: chartBorderColor,
        backgroundColor: chartBackgroundColor,
        lineTension: 0,
        label: 'Temperature',
        steppedLine: false,
        data: sensorData.map(function (v) { return v.temperature.celcius; }),
      },
      {
        fill: false,
        borderColor: '#ae8567',
        backgroundColor: '#ae8567',
        lineTension: 0,
        label: 'Humiture',
        steppedLine: false,
        data: sensorData.map(function (v) { return v.temperature.heatindexCelcius; }),
      }
    ];

    options.legend.display = true;
    options.scales.yAxes = [
      {
        ticks: {
          padding: 5,
          display: true,
          beginAtZero: true,
        },
        display: true,
        scaleLabel: {
          display: true,
          labelString: "Temperature (Celcius)"
        }
      }
    ];
  };


  const updateChart = function (deviceId) {
    const now = Math.floor(Date.now() / 1000);
    const since = now - window; 
    const sensors = deviceData.get(deviceId);
    if (sensors !== undefined) {
      for (var [sensorId, sensorData] of sensors) {
        const chartName = "chart_" + deviceId + "_" + sensorId;
        const element = document.getElementById(chartName);
        if (element != null) {
          sensorData = sensorData.filter(function (v) {
            return v.timestamp >= since;
          });

          var options = defaultChartOptions(since, now);
          var cdata = {};
          if (sensorId == "motion") {
            motionChart(options, cdata, sensorData);
          } else if (sensorId == "temperature") {
            temperatureChart(options, cdata, sensorData);
          }

          if (cdata.datasets !== undefined && cdata.datasets.length > 0) {
            console.log("Cdata (data: " + cdata.datasets[0].data.length + ", labels: " + cdata.labels.length + ": " + JSON.stringify(cdata.datasets[0].data));
          }
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
            var chart = charts[chartName];
            chart.data = cdata;
            chart.options = options;
            chart.update();
          }
        }
      }
    }
  };

  const updateState = function () {
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

<h2>Devices (total: {deviceInfo.size})</h2>

<table>
<tr>
<th>Dings</th>
<th colspan="{sensorTypes.length}">History</th>
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
