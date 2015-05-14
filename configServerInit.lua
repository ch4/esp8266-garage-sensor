apNamePrefix = "ESP8266" 

apNetConfig = {ip      = "192.168.4.1", 
               netmask = "255.255.255.0",
               gateway = "192.168.4.1"}

local apName = apNamePrefix .. "-" .. string.sub(wifi.ap.getmac(),13)
print("Starting up AP with SSID: " .. apName);
wifi.setmode(wifi.STATIONAP)
local apSsidConfig = {}
apSsidConfig.ssid = apName
wifi.ap.config(apSsidConfig)
wifi.ap.setip(apNetConfig)