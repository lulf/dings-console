<script>
  import ApolloClient from 'apollo-boost';
  import Chart from 'chart.js';
  import gql from "graphql-tag";
  import slider from "nouislider";

  const client = new ApolloClient({
    uri: 'http://api.teig.cloud:8080/graphql'
  });

  // Supported sensor types
  const sensorTypes = ["motion", "temperature", "soil"];
  const maxWindow = 30 * 24 * 60 * 60; // Up to a month
  var window = 7 * 24 * 60 * 60; // Default 1 week window for graphs

  var maxDate = new Date();

  // Data structure storing device information, updated by graphql watch query
  var deviceInfo = new Map();

  // Data structure storing sensor data per device per sensor, updated by graphql watch query
  var deviceData = new Map();

  // Map of charts present in the DOM
  var charts = {};

  // GraphQL query for querying devices
  const deviceQuery = gql`query Query {
      devices {
        id
        name
        description
        enabled
        sensors
      }
    }`;

  // Function constructing GraphQL query for watching events
  const eventQuery = function (id, since) {
    return gql`query Query {
      events (deviceId: "${id}", since: ${since}) {
        creationTime
        data {
          temperature {
            celcius
            humidity
            heatindexCelcius
          }
          motion
          soil
        }
      }
    }`;
  };


  // Poll device data every 10 seconds
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
        
        // Update state to trigger redraw
        deviceInfo = deviceInfo;

        // Create subscription for watching events for this device, polling every 5 seconds
        const eventObservable = client.watchQuery({query: eventQuery(device.id, since), pollInterval: 5000});
        eventObservable.subscribe({
          next: ({data}) => {
            var events = data.events
            var entries = {};

            // Process events and format as expected by chart processing
            for (var eidx in events) {
              const event = events[eidx];
              for (var dataKey in event.data) {
                if (deviceData.get(device.id).get(dataKey) !== undefined) {
                  // console.log("Found defined sensor " + dataKey + " for " + device.id);
                  if (event.data[dataKey] != null) {
                    var entry = {timestamp: event.creationTime};
                    entry[dataKey] = event.data[dataKey];
                    if (entries[dataKey] === undefined) {
                        entries[dataKey] = [];
                    }
                    entries[dataKey].push(entry);
                  }
                }
              }
            }
            for (var dataKey in entries) {
              deviceData.get(device.id).set(dataKey, entries[dataKey]);
            }

            // Update chart data
            updateChart(device.id);
          }
        });
      }
    }
  });


  // Chart options to reduce duplication between chart types
  const defaultChartOptions = function(min, max) {
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

  // Motion charts show 'motion detected' events
  const motionChart = function (options, cdata, sensorData) {
    cdata.labels = sensorData.map(function (v) { return new Date(v.timestamp * 1000); });

    cdata.datasets = [
      {
        fill: false,
        borderColor: '#fe8b36',
        backgroundColor: '#fe8b36',
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

  // Temperature charts show temperature, potentially with multiple values
  const temperatureChart = function (options, cdata, sensorData) {
    cdata.labels = sensorData.map(function (v) { return new Date(v.timestamp * 1000); });

    cdata.datasets = [
      {
        fill: false,
        borderColor: '#fe8b36',
        backgroundColor: '#fe8b36',
        lineTension: 0,
        label: 'Temperature',
        steppedLine: false,
        data: sensorData.filter(function(v) { return v.temperature != null; }).map(function (v) { return v.temperature.celcius; }),
      },
      {
        fill: false,
        borderColor: '#ae8567',
        backgroundColor: '#ae8567',
        lineTension: 0,
        label: 'Humiture',
        steppedLine: false,
        data: sensorData.filter(function(v) { return v.temperature != null; }).map(function (v) { return v.temperature.heatindexCelcius; }),
      }
    ];

    if (window > 80000) {
      options.elements = {
        point: {
          radius: 0
        }
      };
    }
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

  // Soil charts show soil moisture, potentially with multiple values
  const soilChart = function (options, cdata, sensorData) {
    cdata.labels = sensorData.map(function (v) { return new Date(v.timestamp * 1000); });

    var numSensors = 0;
    if (sensorData.length > 0) {
       numSensors = sensorData[0].soil.length;
    }

    cdata.datasets = [];
    for (var i = 0; i < numSensors; i++) {
      cdata.datasets.push({
        fill: false,
        borderColor: '#fe8b36',
        backgroundColor: '#fe8b36',
        lineTension: 0,
        label: 'Plant ' + (i + 1),
        steppedLine: false,
        data: sensorData.map(function (v) { return v.soil[i]; }),
      });
    }

    if (window > 80000) {
      options.elements = {
        point: {
          radius: 0
        }
      };
    }
    options.legend.display = true;
    options.scales.yAxes = [
      {
        ticks: {
          padding: 5,
          display: true,
          beginAtZero: false,
        },
        display: true,
        scaleLabel: {
          display: true,
          labelString: "Soil conductivity"
        }
      }
    ];
  };

  // Update chart element in DOM for a given device
  const updateChart = function (deviceId) {
    const now = Math.floor(Date.now() / 1000);
    const since = now - window; 
    const sensors = deviceData.get(deviceId);
    if (sensors !== undefined) {
      for (var [sensorId, sensorData] of sensors) {
        const chartName = "chart_" + deviceId + "_" + sensorId;
        const element = document.getElementById(chartName);
        if (element != null) {

          // Filter data due to stale watch function
          sensorData = sensorData.filter(function (v) {
            return v.timestamp >= since;
          });

          var options = defaultChartOptions(since, now);
          var cdata = {};
          if (sensorId == "motion") {
            motionChart(options, cdata, sensorData);
          } else if (sensorId == "temperature") {
            temperatureChart(options, cdata, sensorData);
          } else if (sensorId == "soil") {
            soilChart(options, cdata, sensorData);
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


  // Regurarily re-render charts to ensure time window is moving
  const updateCharts = function () {
  
    console.log("UPDATE CHARTS");
    for (var [deviceId, sensors] of deviceData) {
        updateChart(deviceId);
        /*
        for (var [sensorId, sensorData] of sensors) {
            console.log("Data for " + deviceId + " sensor " + sensorId + ": " + JSON.stringify(sensorData));
        }
        */
    }

    maxDate = new Date();
    setTimeout(updateCharts, 30000);
  };
  setTimeout(updateCharts, 30000);

  const addSeconds = function(existing, seconds) {
    var dt = new Date(existing);
    dt.setSeconds(dt.getSeconds() + seconds);
    return dt;
  };

/*
  const setupSlider = function() {
    var range = document.getElementById('range');
    if (range != null) {
      console.log("Creating slider");
      range.style.height = "40px";
      range.style.width = "400px";
      slider.create(range, {
        range: {
          min: addSeconds(maxDate, -maxWindow).getTime(),
          max: maxDate.getTime()
        },
        step: 3600,
        start: [addSeconds(maxDate, -window).getTime(), maxDate.getTime()]
      });
    } else {
      setTimeout(setupSlider, 500);
    }
  };
  */

//  setTimeout(setupSlider, 500);

  var dateSince = addSeconds(maxDate, -window).toString();
  const rangeUpdated = function() {
    updateCharts();
    dateSince = addSeconds(maxDate, -window).toString();
  };

</script>

<!--<link href='https://cdnjs.cloudflare.com/ajax/libs/noUiSlider/9.0.0/nouislider.min.css' rel="stylesheet"> -->

<style>
  table {
    border: 0px solid black;
    border-collapse: collapse;
    width: 70%;
  }
  tr {
    border: 1px solid black;
  }
  .desc {
    width: 10%;
  }
  .chart {
    width: 40%;
    height: 300px;
  }
  .slider {
    width: 70%;
  }
</style>

<h1>Dings Console</h1>

<p>
Last updated: {maxDate}
</p>

<p>
Events since: {dateSince}
</p>

<!--
<div id='range' class="slider"></div> -->
<div>
<input id="windowrange" type="range" class="slider" value="{window}" step="3600" min="0" max="{maxWindow}" on:change="{() => rangeUpdated()}" bind:value={window} />
</div>

<table>
<tr>
<th>Description</th>
<th colspan="{sensorTypes.length}">History</th>
</tr>
{#each Array.from(deviceInfo.keys()) as device}
<tr>
<td class="desc">
{deviceInfo.get(device).description}
</td>
{#each Array.from(deviceInfo.get(device).sensors) as sensor}
<td class="chart">
<canvas id="chart_{device}_{sensor}" height="200px"></canvas>
</td>
{/each}
</tr>
{/each}

</table>
