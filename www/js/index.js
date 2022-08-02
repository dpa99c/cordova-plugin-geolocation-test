var watchId, platform, $output, osDetails;

var androidConfirmAccuratePermission = {
    title: "Location permission issue",
    message: "Approximate location permission has been set but may not work correctly on this version of Android (v%os_version%) so please allow precise location permission.\n\n",
    confirmAllow: "Would you like to do this now?",
    confirmSwitchToSettings: "Would you like to do this now in Settings?"
}

var androidHowToChangeAccuracyInSettings = {
    title: "How to enable accurate location permission",
    message: "When you press \"OK\", the Settings page for this app will open. Please select 'Permissions' > 'Location' and turn on 'Use precise location'. Press \"Back\" to return to the app."
};

function onDeviceReady() {
    $('#platform').text(device.platform);
    $('#os-version').text(device.version);

    platform = device.platform.toLowerCase();

    $('body').addClass(platform);

    cordova.plugins.diagnostic.getDeviceOSVersion(function(details){
        osDetails = details;

        $('#get-current-position').on('click', getCurrentPosition);
        $('#watch-position').on('click', watchPosition);
        $('#clear-watch').on('click', clearWatch);
        $output = $('#log-output');

        cordova.plugins.diagnostic.registerLocationStateChangeHandler(checkLocationPermissions, handleError);
        checkLocationPermissions();
    }, handleError);
}

function getOpts(){
    var highAccuracy = $('#high-accuracy').is(':checked')
        || (platform === 'android' && osDetails.apiLevel < 32); // always request high accuracy on API < 32 due to bug in WebView
    return {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 5000
    };
}

function getCurrentPosition(){
    var opts = getOpts();
    log("Getting current position with "+(opts.enableHighAccuracy ? 'precise' : 'approximate')+" accuracy");
    navigator.geolocation.getCurrentPosition(function(position){
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        log("Current position: "+lat+","+lon);
    }, function(error){
        logError("Error getting current position", error);
        checkLocationPermissions();
    }, opts);
}

function watchPosition(){
    clearWatch();
    var opts = getOpts();
    log("Adding position watch with "+(opts.enableHighAccuracy ? 'precise' : 'approximate')+" accuracy");
    watchId = navigator.geolocation.watchPosition(function(position){
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        log("Latest position: "+lat+","+lon);
    }, function(error){
        logError("Error setting watch position", error);
        checkLocationPermissions();
    }, opts);
}

function clearWatch(){
    if(watchId){
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        log("Cleared existing location watch");
    }
}

function checkLocationPermissions(){
    if(platform !== 'android') return;

    cordova.plugins.diagnostic.getLocationAuthorizationStatuses(function(statuses){
        var coarsePermission = statuses[cordova.plugins.diagnostic.permission.ACCESS_COARSE_LOCATION],
            finePermission = statuses[cordova.plugins.diagnostic.permission.ACCESS_FINE_LOCATION];

        // Check if only COARSE but not FINE permission (i.e. approximate) has been set on API < 32 due to bug in WebView
        if(coarsePermission === cordova.plugins.diagnostic.permissionStatus.GRANTED){
            if(finePermission !== cordova.plugins.diagnostic.permissionStatus.GRANTED){
                if(osDetails.apiLevel < 32){
                    if(finePermission === cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED || finePermission === cordova.plugins.diagnostic.permissionStatus.DENIED_ONCE){
                        // Ask user to allow accurate location via permission prompt
                        showConfirm(function(i){
                            if(i === 1){
                                cordova.plugins.diagnostic.requestLocationAuthorization(function(newStatus){
                                    log("Newly authorized location status: " + newStatus);
                                }, handleError,
                                   cordova.plugins.diagnostic.locationAuthorizationMode.WHEN_IN_USE,
                                   cordova.plugins.diagnostic.locationAccuracyAuthorization.FULL
                                );
                            }
                        }, androidConfirmAccuratePermission.message.replace('%os_version%', osDetails.version) + androidConfirmAccuratePermission.confirmAllow, androidConfirmAccuratePermission.title)
                    }else if(finePermission === cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS){
                        // Ask user to allow accurate location via Settings
                        showConfirm(function(i){
                            if(i === 1){
                                showAlert(androidHowToChangeAccuracyInSettings.message, androidHowToChangeAccuracyInSettings.title, function(){
                                    cordova.plugins.diagnostic.switchToSettings();
                                });
                            }
                        }, androidConfirmAccuratePermission.message.replace('%os_version%', osDetails.version) + androidConfirmAccuratePermission.confirmSwitchToSettings, androidConfirmAccuratePermission.title)
                    }
                }
            }
        }
    }, handleError);
}

// UI logging
function prependLogMessage(message){
    $output.prepend('<span class="'+(message.logLevel ? message.logLevel : '')+'">' +message.msg + '</span>' + (message.nobreak ? "<br/>" : "<br/><br/>" ));
}

function log(msg, opts){
    opts = opts || {};

    opts.logLevel = opts.logLevel || "log";
    console[opts.logLevel](msg);

    opts.msg = msg;
    prependLogMessage(opts);
}

function logError(msg, error){
    if(typeof error === 'object'){
        msg += ': ' + JSON.stringify(error);
    }else if(typeof error === 'string'){
        msg += ': ' + error;
    }
    log(msg, {
        logLevel: "error"
    });
}

function handleError(error){
    logError(error.message, error);
}

function showAlert(msg, title, resultHandler, buttonLabel){
    navigator.notification.alert(msg, resultHandler,title, buttonLabel);
}

function showConfirm(resultHandler, msg, title, buttonLabels){
    navigator.notification.confirm(msg, resultHandler, title, buttonLabels || ["Yes", "No"]);
}

$(document).on("deviceready", onDeviceReady);
