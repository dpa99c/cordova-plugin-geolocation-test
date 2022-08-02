var diagnostic, watchId, platform, $output, osDetails, retryCount = 0;

var android = {
    confirmAllowViaPrompt: "Would you like to do this now?",
    confirmSwitchToSettings: "Would you like to do this now in Settings?",
    lteApi32:{
        approximateLocationPermissionIssue: {
            confirmTitle: "Location permission issue",
            confirmMessage: "Approximate location permission has been set but may not work correctly on this version of Android so please allow precise location permission.\n\n",
        }
    },
    gteApi32:{
        preciseLocationRequired: {
            confirmTitle: "Precise location required",
            confirmMessage: "This app requires access to your precise location but only approximate location permission has been set which means the app cannot work correctly. Please allow precise location permission.\n\n",
        }
    },
    howToEnablePreciseLocationInSettings: {
        title: "How to enable accurate location permission",
        message: "When you press \"OK\", the Settings page for this app will open. Please select 'Permissions' > 'Location' and turn on 'Use precise location'. Press \"Back\" to return to the app."
    }
}


function onDeviceReady() {
    $('#platform').text(device.platform);
    $('#os-version').text(device.version);

    diagnostic = cordova.plugins.diagnostic;
    platform = device.platform.toLowerCase();

    $('body').addClass(platform);

    diagnostic.getDeviceOSVersion(function(details){
        osDetails = details;

        $('#get-current-position').on('click', onClickGetCurrentPosition);
        $('#watch-position').on('click', onClickWatchPosition);
        $('#clear-watch').on('click', clearWatch);
        $output = $('#log-output');

        diagnostic.registerLocationStateChangeHandler(checkAndroidLocationPermissions, handleError);
        checkAndroidLocationPermissions();
    }, handleError);
}

function getOpts(){
    var highAccuracy = $('#high-accuracy').is(':checked');
    return {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 5000
    };
}

function onClickGetCurrentPosition(){
    retryCount = 0;
    getCurrentPosition();
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
        checkAndroidLocationPermissions(function(statuses){
            handlePositionError(opts, error, getCurrentPosition, "getCurrentPosition", statuses);
        });
    }, opts);
}

function onClickWatchPosition(){
    retryCount = 0;
    watchPosition();
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
        logError("Position watch error", error);
        checkAndroidLocationPermissions(function(statuses){
            handlePositionError(opts, error, watchPosition, "watchPosition", statuses);
        });
    }, opts);
}

function handlePositionError(opts, error, retryFn, retryFnName, statuses){
    if(error.code === 3 && osDetails.apiLevel === 31 && retryCount < 1){
        log("Retrying "+retryFnName+" on Android API 31 after TIMEOUT");
        retryCount++;
        retryFn();
    }else if(error.code === 1 && osDetails.apiLevel >= 32 && opts.enableHighAccuracy){
        // Check if approximate (COARSE but not FINE) permission has been set on API >=32 when precise location was requested
        requirePreciseLocation(android.gteApi32.preciseLocationRequired, statuses);
    }
}

function clearWatch(){
    if(watchId){
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        log("Cleared existing location watch");
    }
}

function checkAndroidLocationPermissions(cb){
    if(platform !== 'android') return;
    
    cb = cb || function(){};

    diagnostic.getLocationAuthorizationStatuses(function(statuses){
        if(osDetails.apiLevel < 32){
            // Check if approximate (COARSE but not FINE) permission has been set on API < 32 due to bug in WebView
            requirePreciseLocation(android.lteApi32.approximateLocationPermissionIssue, statuses);
        }
        cb(statuses);
    }, handleError);
}

function requirePreciseLocation(reason, statuses){
    var coarsePermission = statuses[diagnostic.permission.ACCESS_COARSE_LOCATION],
        finePermission = statuses[diagnostic.permission.ACCESS_FINE_LOCATION];
    if(coarsePermission === diagnostic.permissionStatus.GRANTED && finePermission !== diagnostic.permissionStatus.GRANTED){
        if(finePermission === diagnostic.permissionStatus.NOT_REQUESTED || finePermission === diagnostic.permissionStatus.DENIED_ONCE){
            // Ask user to allow accurate location via permission prompt
            showConfirm(function(i){
                if(i === 1){
                    diagnostic.requestLocationAuthorization(function(newStatus){
                            log("Newly authorized location status: " + newStatus);
                        }, handleError,
                        diagnostic.locationAuthorizationMode.WHEN_IN_USE,
                        diagnostic.locationAccuracyAuthorization.FULL
                    );
                }
            }, reason.confirmMessage + android.confirmAllowViaPrompt, reason.confirmTitle)
        }else if(finePermission === diagnostic.permissionStatus.DENIED_ALWAYS){
            // Ask user to allow accurate location via Settings
            showConfirm(function(i){
                if(i === 1){
                    showAlert(android.howToEnablePreciseLocationInSettings.message, android.howToEnablePreciseLocationInSettings.title, function(){
                        diagnostic.switchToSettings();
                    });
                }
            }, reason.confirmMessage + android.confirmSwitchToSettings, reason.confirmTitle)
        }
    }
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
    if(error instanceof GeolocationPositionError){
        msg += ': code='+error.code+'; message='+error.message;
    }else if(typeof error === 'object'){
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
