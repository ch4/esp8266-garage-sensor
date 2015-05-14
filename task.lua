-- voltageFile = file.open('voltage.txt','r')
-- voltage = voltageFile.read()
-- voltageFile.close()

print(voltage) -- see if this variable is carried over from init.lua

backendRoot = 'example.parseapp.com'
backendRoute = '/sensor/ping'
sensorMac = wifi.ap.getmac()

function pingBackend()
    conn=net.createConnection(net.TCP,0) 
    conn:on("receive", function(conn, pl) print("response: ",pl) end)
    conn:on("connection",function(conn, payload)
    conn:send("POST " .. backendRoute .. "?voltage=" .. voltage .. "&mac=" .. sensorMac .. " HTTP/1.1\r\nHost: " .. backendRoot .."\r\n".."Connection: close\r\nAccept: */*\r\n\r\n")
    end)
    conn:connect(80,backendRoot)
end

-- every 14 seconds, ping server
tmr.alarm(1, 14000, 1, pingBackend)