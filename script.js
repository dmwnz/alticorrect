const inputElement = document.getElementById("inputElement")

// get the value every time the user selects a new file
inputElement.addEventListener("change", (e) => {
    // e.target points to the input element
    var selectedFile = e.target.files[0]
    processFile(selectedFile)
})

const downloadButton = document.getElementById("download")


function processFile(file) {

    const reader = new FileReader();
    reader.onload = (e) => {
        // e.target points to the reader
        const textContent = e.target.result
        
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(textContent, "text/xml");
        
        var points = getAllPoints(xmlDoc);
        var altitudes = getPointsAltitude(points);
        fixGpxAltitudes(xmlDoc, altitudes);
        
        var newName = file.name.split('.')[0] + '_alticorrect.gpx'
        var xmlString = new XMLSerializer().serializeToString(xmlDoc);
        downloadButton.innerHTML = "Télécharger le fichier corrigé"
        downloadButton.disabled = false
        downloadButton.addEventListener("click", (e) => {
            download(newName, xmlString);
        })
        
        buildChart(points, altitudes)
    };
    reader.onerror = (e) => {
        const error = e.target.error
        console.error(`Error occured while reading ${file.name}`, error)
    };
    downloadButton.disabled = true
    downloadButton.innerHTML = "Merci de patienter..."
    reader.readAsText(file);
}


function getAllPoints(xml) {
    var points = []
    var trkpts = xml.getElementsByTagName('trkpt')
    for (var i = 0; i < trkpts.length; i++) {
        var longitude = trkpts[i].attributes['lon'].value
        var latitude = trkpts[i].attributes['lat'].value
        var altitude = parseFloat(trkpts[i].getElementsByTagName('ele')[0].innerHTML)
        points.push([longitude, latitude, altitude])
    }
    return points
}

function getPointsAltitude(points) {
    var chunk_length = 300
    var res = []
    for(var chunk_start = 0; chunk_start < points.length; chunk_start = chunk_start + chunk_length) {
        var sub_points = points.slice(chunk_start, chunk_start + chunk_length)
        var lons = sub_points.map(sp => sp[0]).join('|')
        var lats = sub_points.map(sp => sp[1]).join('|')

        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", `https://wxs.ign.fr/choisirgeoportail/alti/rest/elevation.json?lon=${lons}&lat=${lats}`, false);
        xmlHttp.send(null);
        if (xmlHttp.status == 200) {
            var response = JSON.parse(xmlHttp.responseText);
            response.elevations.forEach(one_point => {
                var point_data = [one_point.lon, one_point.lat, one_point.z]
                res.push(point_data)
            });
        }
    }
    return res
}

function fixGpxAltitudes(xml, altitudes) {
    var trkpts = xml.getElementsByTagName('trkpt')
    for (var i = 0; i < trkpts.length; i++) {
        var longitude = trkpts[i].attributes['lon'].value
        var latitude = trkpts[i].attributes['lat'].value
        trkpts[i].getElementsByTagName('ele')[0].innerHTML = altitudes[i][2]
    }
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}



function buildChart(altitudesInit, altitudesNew) {

    var dataInit = [altitudesInit[0][2]] //.map(a => a[2]);
    var dataNew = [altitudesNew[0][2]] //.map(a => a[2]);
    var labels = [0.0]
    var totalDistance = 0.0
    let [subDistance, subInit, subNew, subCount] = [0, 0, 0, 0]

    for(var i = 1; i < altitudesInit.length; i++) {
        var distance = calcDistance(altitudesInit[i-1], altitudesInit[i])
        subDistance += distance
        subInit += altitudesInit[i][2]
        subNew += altitudesNew[i][2]
        subCount++
        if(subDistance >= 0.025) {
            totalDistance += subDistance
            labels.push(totalDistance)            
            dataInit.push(subInit / subCount)
            dataNew.push(subNew / subCount)
            subDistance=0
            subInit=0
            subNew=0
            subCount=0
        }        
    }

    const data = {
      labels: labels,
      datasets: [{
        label: 'New',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 2,
        lineTension: 0,
        data: dataNew
      },{
        label: 'Initial',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 2,
        lineTension: 0,
        data: dataInit
        
      }]
    };
    const config = {
        type: 'line',
        data,
        options: {
            interaction: {
                mode: 'x'
            },
            radius: 0,
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                    text: 'Distance (km)'
                }
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: 'Altitude (m)'
                },
                suggestedMin: 0,
              }
            }
        }
    };
    
    var chart = new Chart(document.getElementById('myChart'), config);
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function calcDistance(pointA, pointB) {
    var earthRadiusKm = 6371;
    
    let [lon1, lat1, lon2, lat2] = [pointA[0], pointA[1], pointB[0], pointB[1]]
    
    var dLat = degreesToRadians(lat2-lat1);
    var dLon = degreesToRadians(lon2-lon1);

    lat1 = degreesToRadians(lat1);
    lat2 = degreesToRadians(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return earthRadiusKm * c;

}

