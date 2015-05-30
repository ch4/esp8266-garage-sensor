var express = require('express');
var _ = require('underscore');
var querystring = require('querystring');
var Mailgun = require('mailgun');

/**
 * Create an express application instance
 */
var app = express();

///**
// * Create a Parse ACL which prohibits public access.  This will be used
// *   in several places throughout the application, to explicitly protect
// *   Parse User, TokenRequest, and TokenStorage objects.
// */
//var restrictedAcl = new Parse.ACL();
//restrictedAcl.setPublicReadAccess(false);
//restrictedAcl.setPublicWriteAccess(false);

/**
 * Global app configuration section
 */
//app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'ejs'); // Set the template engine
app.use(express.bodyParser()); // Middleware for reading request body


Parse.Cloud.job("TriggerAlerts", function(request, status) {
    // Set up to modify user data
    Parse.Cloud.useMasterKey();
    TriggerAlerts(undefined, function() {
        status.success();
    });
});

function SendPlivoSms(targetNumber, message, callback) {
    Parse.Config.get().then(function(config) {
        var plivoId = config.get("PLIVO_ID");
        var plivoToken = config.get("PLIVO_TOKEN");
        var plivoNumber = config.get("PLIVO_NUMBER");
        var plivoAccountUri = 'https://' + plivoId + ':' + plivoToken + '@api.plivo.com/v1/Account/' + plivoId;

        Parse.Cloud.httpRequest({
            url: plivoAccountUri + '/Message/',
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                "src": plivoNumber,
                "dst": targetNumber,
                "text": message
            },
            success: function(httpResponse) {
                callback();
            },
            error: function(httpResponse) {
                callback();
            }
        });
    }, function(error) {
        // Something went wrong (e.g. request timed out)
        callback();
    });
}

function SendNexmoSms(targetNumber, message, callback) {
    Parse.Config.get().then(function(config) {
        var nexmoKey = config.get("NEXMO_KEY");
        var nexmoSecret = config.get("NEXMO_SECRET");
        var nexmoNumber = config.get("NEXMO_NUMBER");

        Parse.Cloud.httpRequest({
            uri: 'https://rest.nexmo.com/sms/json?api_key=' + nexmoKey + '&api_secret=' + nexmoSecret + '&from=' + nexmoNumber + '&to=' + targetNumber + '&text=' + message,
            method: "GET",
            success: function(httpResponse) {
                callback();
            },
            error: function(httpResponse) {
                callback();
            }
        });
    }, function(error) {
        // Something went wrong (e.g. request timed out)
        callback();
    });
}

function SendEmailNotification(targetEmail, subject, message, callback) {
    Parse.Config.get().then(function(config) {
        var mailgunDomain = config.get("MAILGUN_DOMAIN");
        var mailgunKey = config.get("MAILGUN_KEY");
        var mailgunEmail = config.get("MAILGUN_EMAIL");
        Mailgun.initialize(mailgunDomain, mailgunKey);

        Mailgun.sendEmail({
            to: targetEmail,
            from: mailgunEmail,
            subject: subject,
            text: message
        }, {
            success: function(httpResponse) {
                console.log(httpResponse);
                //            response.success("Email sent!");
                callback();
            },
            error: function(httpResponse) {
                console.error(httpResponse);
                //            response.error("Uh oh, something went wrong");
                callback();
            }
        });
    }, function(error) {
        // Something went wrong (e.g. request timed out)
        callback();
    });
}

function TriggerAlerts(sensorId, callback) {
    //note: if there are a lot of unprocessed pings, this might take a while, so only call this from a cloud job
    if (sensorId) {
        //a sensor is specified, trigger alerts only for that sensor
    } else {
        //grab all pings from within the last minute
        var Ping = Parse.Object.extend("Pings");
        var pingQuery = new Parse.Query(Ping);
        pingQuery.equalTo("mac", sensorMac);
        pingQuery.greaterThan('createdAt', (new Date((new Date()).getTime() - 60000))); //get pings from the last minute
        pingQuery.find({
            success: function(results) {
                var sortedPings = _.groupBy(results, function(pfObject) {
                    return pfObject.get('mac');
                });
                var deviceCount = sortedPings.length;
                console.log('deviceCount:', deviceCount);
                //if pings count<3
                //if lastsensorstate = open, set to closed, send notification
                //if lastsensorstate = closed, set to open, send notification

                function callbackCounter() {
                    deviceCount = deviceCount - 1;
                    if (deviceCount < 1) {
                        callback();
                    }
                }

                _.each(sortedPings, function(pingsArray) {
                    if (pingsArray.length < 3) {
                        //this is either a off->on or on->off transition   
                        GetSensorByMac(pingsArray[0].get('mac'), function(sensorObject) {
                            if (sensorObject.get('isActive')) {
                                //sensor is already marked active, so this transition is on->off
                                sensorObject.set('isActive', false);
                                sensorObject.save(null, {
                                    success: function(gameScore) {
                                        // Execute any logic that should take place after the object is saved.
                                        //                                alert('New object created with objectId: ' + gameScore.id);
                                        callbackCounter();
                                    },
                                    error: function(gameScore, error) {
                                        // Execute any logic that should take place if the save fails.
                                        // error is a Parse.Error with an error code and message.
                                        //                                alert('Failed to create new object, with error code: ' + error.message);
                                        callbackCounter();
                                    }
                                });
                            } else {
                                //sensor is not active, so this transition is off->on
                                sensorObject.set('isActive', true);
                                sensorObject.save(null, {
                                    success: function(gameScore) {
                                        // Execute any logic that should take place after the object is saved.
                                        //                                alert('New object created with objectId: ' + gameScore.id);
                                        callbackCounter();
                                    },
                                    error: function(gameScore, error) {
                                        // Execute any logic that should take place if the save fails.
                                        // error is a Parse.Error with an error code and message.
                                        //                                alert('Failed to create new object, with error code: ' + error.message);
                                        callbackCounter();
                                    }
                                });
                            }
                        });
                    } else {
                        //this is an ongoing pinging device, do nothing 
                        callbackCounter();
                    }
                });
            },
            error: function(error) {
                alert("Error: " + error.code + " " + error.message);
                callback();
            }
        });
    }
}

function GetSensorByMac(sensorMac, callback) {
    console.log('sensorMac: ' + sensorMac);
    var Sensor = Parse.Object.extend("Sensors");
    var sensorQuery = new Parse.Query(Sensor);
    sensorQuery.equalTo("mac", sensorMac);
    sensorQuery.descending("createdAt");
    sensorQuery.limit(2);
    sensorQuery.find({
        success: function(results) {
            if (results.length > 0) {
                callback(results[0]);
            } else {
                callback(undefined);
            }
        },
        error: function(error) {
            alert("Error: " + error.code + " " + error.message);
            callback(undefined);
        }
    });
}

function GetListenersByMac(sensorMac, callback) {
    console.log('sensorMac: ' + sensorMac);
    var Listener = Parse.Object.extend("Listeners");
    var listenerQuery = new Parse.Query(Listener);
    listenerQuery.equalTo("sensorMac", sensorMac);

    sensorQuery.find({
        success: function(results) {
            callback(results);
        },
        error: function(error) {
            alert("Error: " + error.code + " " + error.message);
            callback(undefined);
        }
    });
}

Parse.Cloud.define("SensorPing", function(request, response) {
    console.log(JSON.stringify(request));
    var parameters = request.params;
    var voltage = parameters.voltage;
    var mac = parameters.mac;

    var Ping = Parse.Object.extend("Pings");
    var newPing = new Ping();

    //newPing.set("time", parameters.time);
    newPing.set("voltage", voltage);
    newPing.set("mac", mac);

    newPing.save(null, {
        success: function(result) {
            // Execute any logic that should take place after the object is saved.
            response.success();
        },
        error: function(result, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            alert('Failed to create new object, with error code: ' + error.message);
            response.error();
        }
    });
});

Parse.Cloud.afterSave("Pings", function(request) {
    Parse.Cloud.useMasterKey();
    GetListenersByMac(request.object.get('mac'), function(listenerObjects) {
        console.log('found: ' + JSON.stringify(listenerObjects));
        var count = listenerObjects.length;

        function asyncCallback() {
            count = count - 1;
            if (count < 1) {
                //done   
                return;
            }
        }

        _.each(listenerObjects, function(listener) {
            var email = listener.get('email');
            var garagemessage = 'GARAGE DOOR IS OPEN';
            SendEmailNotification(email, garagemessage, garagemessage, function() {
                asyncCallback();
            });
        });
    });
});

//app.post('/sensor/ping', function(request, response) {
//    console.log(request.body);
//
//    response.json({});
//});

app.post('/sensor/:mac/voltage/:voltage', function(request, response) {
    Parse.Cloud.useMasterKey();
    var parameters = request.params;
    var voltage = parameters.voltage;
    var mac = parameters.mac;

    var Ping = Parse.Object.extend("Pings");
    var newPing = new Ping();

    //newPing.set("time", parameters.time);
    newPing.set("voltage", voltage);
    newPing.set("mac", mac);

    newPing.save(null, {
        success: function(result) {
            // Execute any logic that should take place after the object is saved.
            response.success();
        },
        error: function(result, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            alert('Failed to create new object, with error code: ' + error.message);
            response.error();
        }
    });

    response.json({});
});

// Attach the Express app to your Cloud Code
app.listen();