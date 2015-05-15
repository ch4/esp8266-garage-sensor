var _ = require('underscore');

Parse.Cloud.job("TriggerAlerts", function(request, status) {
    // Set up to modify user data
    Parse.Cloud.useMasterKey();
    TriggerAlerts(undefined,function(){
        status.success();
    });
});

function TriggerAlerts(sensorId, callback){
    //note: if there are a lot of unprocessed pings, this might take a while, so only call this from a cloud job
    if(sensorId){
        //a sensor is specified, trigger alerts only for that sensor
    } else {
        //grab all pings from within the last minute
        var Ping = Parse.Object.extend("Pings");
        var pingQuery = new Parse.Query(Ping);
        pingQuery.equalTo("mac", sensorMac);
        pingQuery.greaterThan('createdAt',(new Date((new Date()).getTime()-60000))); //get pings from the last minute
        pingQuery.find({
          success: function(results) {
              var sortedPings = _.groupBy(results, function(pfObject){ return pfObject.get('mac'); });
              var deviceCount = sortedPings.length;
              console.log('deviceCount:',deviceCount);
                //if pings count<3
                //if lastsensorstate = open, set to closed, send notification
                //if lastsensorstate = closed, set to open, send notification
              
              function callbackCounter(){
                deviceCount = deviceCount - 1;
                if(deviceCount < 1){
                    callback();   
                }
              }
              
              _.each(sortedPings, function(pingsArray){
                if(pingsArray.length < 3) {
                    //this is either a off->on or on->off transition   
                    GetSensorByMac(pingsArray[0].get('mac'),function(sensorObject){
                        if(sensorObject.get('isActive')){
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
                            //sensor is in active, so this transition is off->on
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

function GetSensorByMac(sensorMac,callback){
    var Sensor = Parse.Object.extend("Sensors");
    var sensorQuery = new Parse.Query(Sensor);
    sensorQuery.equalTo("mac", sensorMac);
    sensorQuery.descending("createdAt");
    sensorQuery.limit(2);
    sensorQuery.find({
      success: function(results) {
        //alert("Successfully retrieved " + results.length + " scores.");
        // Do something with the returned Parse.Object values
//        for (var i = 0; i < results.length; i++) { 
//          var object = results[i];
//          alert(object.id + ' - ' + object.get('playerName'));
//        }
          if(results.length > 0){
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

Parse.Cloud.define("SensorPing", function(request, response) {
    var parameters = request.params;
    var voltage = parameter.voltage;
    var mac = parameter.mac;
    
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