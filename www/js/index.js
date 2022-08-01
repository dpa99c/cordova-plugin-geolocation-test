var watchId;

function onDeviceReady() {
    $('body').addClass(cordova.platformId);

    $('#get-current-position').on('click', getCurrentPosition);
    $('#watch-position').on('click', watchPosition);
    $('#clear-watch').on('click', clearWatch);
}

function getOpts(){
    var highAccuracy = $('#high-accuracy').is(':checked');
    return {
        enableHighAccuracy: highAccuracy,
        timeout: 35000,
        maximumAge: 5000
    };
}

function getCurrentPosition(){
    navigator.geolocation.getCurrentPosition(function(position){
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        console.log("Current position: "+lat+","+lon);
    }, function(error){
        console.error("Error getting current position: " + JSON.stringify(error));
    }, getOpts());
}

function watchPosition(){
    watchId = navigator.geolocation.watchPosition(function(position){
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        console.log("Latest position: "+lat+","+lon);
    }, function(error){
        console.error("Error setting watch position: " + JSON.stringify(error));
    }, getOpts());
}

function clearWatch(){
    if(watchId){
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Cleared location watch");
    }
}

$(document).on("deviceready", onDeviceReady);
