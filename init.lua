timeout = 30 -- seconds to wait for connect before going to AP mode
voltage = node.readvdd33()
print("Voltage: " .. voltage)               
statuses = {[0]="Idle",
            [1]="Connecting",
            [2]="Wrong password",
            [3]="No AP found",
            [4]="Connect fail",
            [5]="Got IP",
            [255]="Not in STATION mode"}
            
checkCount = 0
function checkStatus()
  checkCount = checkCount + 1
  local s=wifi.sta.status()
  print("Status = " .. s .. " (" .. statuses[s] .. ")")  
  if(s==5) then -- successful connect
    launchApp()
    return
  elseif(s==2 or s==3 or s==4) then -- failed
    startServer()
    return
  end
  if(checkCount >= timeout) then
    startServer()
    return
  end
end

function launchApp()
  cleanup()
  print("I'm connected to my last network. Launching my real task.")
  local task = 'task.lua'
  local f=file.open(task, 'r')
  if(f == nil) then
    print('Error opening file ' .. task)
    return
  end
  f.close()
  dofile(task)
end

function startServer()
  lastStatus = statuses[wifi.sta.status()]
  cleanup()
  print("network not found, switching to AP mode")
  dofile('configServer.lua')
end

function cleanup()
  -- stop our alarm
  tmr.stop(0)
  -- nil out all global vars we used
  timeout = nil
  statuses = nil
  checkCount = nil
  -- nil out any functions we defined
  checkStatus = nil
  launchApp = nil
  startServer = nil
  cleanup = nil
  -- take out the trash
  collectgarbage()
  -- pause a few seconds to allow garbage to collect and free up heap
  tmr.delay(5000)
end

-- make sure we are trying to connect as clients
wifi.setmode(wifi.STATION)
wifi.sta.autoconnect(1)

-- every second, check our status
tmr.alarm(0, 1000, 1, checkStatus)
