-- voltageFile = file.open('voltage.txt','r')
-- voltage = voltageFile.read()
-- voltageFile.close()

print(voltage) -- see if this variable is carried over from init.lua

backendRoot = 'example.parseapp.com'
backendRoute = '/sensor/ping'
sensorMac = wifi.ap.getmac()

function pingBackend()
    local data = "voltage=" .. voltage .. "&mac=" .. sensorMac
    
    conn=net.createConnection(net.TCP,0) 
    conn:on("receive", function(conn, pl) print("response: ",pl) end)
    conn:on("connection",function(conn, payload)
    conn:send("POST " .. backendRoute .. " HTTP/1.1\r\nHost: " .. backendRoot .."\r\n" .. "Connection: close\r\nContent-Type: application/x-www-form-urlencoded\r\n" .. "Content-Length: "..string.len(data).."\r\n"..
     "\r\n" .. data)
    end)
    conn:connect(80,backendRoot)
end

-- every 14 seconds, ping server
tmr.alarm(1, 14000, 1, pingBackend)