// @ts-nocheck 
import { NetworkClient } from './network.js';

export class OpenRGBClient {
    constructor(address = '127.0.0.1', port = 6742, name = 'GNOME-OpenRGB-AccentSync', settings = null) {
        this.networkClient = new NetworkClient(address, port, name);
        this.settings = settings;
        this.devices = [];
        this.connected = false;
    }

    async connect() {
        await this.networkClient.connect();
        this.connected = true;
    }

    disconnect() {
        this.networkClient.disconnect();
        this.connected = false;
    }

    async discoverDevices() {
        if (!this.connected) {
            throw new Error('Not connected');
        }

        console.log('OpenRGB: Starting device discovery...');
        
        await this.networkClient.registerClient();
        
        try {
            const deviceCount = await this.networkClient.getControllerCount();
            console.log(`OpenRGB: Found ${deviceCount} devices`);
            
            this.devices = [];
            for (let i = 0; i < deviceCount; i++) {
                try {
                    const deviceData = await this.networkClient.getControllerData(i);
                    
                    let directModeIndex = 0;
                    for (let j = 0; j < deviceData.modes.length; j++) {
                        if (deviceData.modes[j].name.toLowerCase().includes('direct')) {
                            directModeIndex = j;
                            break;
                        }
                    }
                    
                    const device = {
                        id: i,
                        name: deviceData.name,
                        ledCount: deviceData.leds.length,
                        directModeIndex: directModeIndex,
                        data: deviceData
                    };
                    
                    if (device.ledCount > 0) {
                        try {
                            await this.networkClient.setDeviceMode(device.id, device.directModeIndex);
                            console.log(`OpenRGB: Device ${i} - Set to direct mode ${device.directModeIndex} during discovery`);
                        } catch (modeError) {
                            console.warn(`OpenRGB: Failed to set device ${i} to direct mode during discovery:`, modeError.message);
                        }
                    }
                    
                    this.devices.push(device);
                    console.log(`OpenRGB: Device ${i}: ${device.name} (${device.ledCount} LEDs, direct mode: ${device.directModeIndex})`);
                } catch (error) {
                    console.warn(`OpenRGB: Failed to get device ${i}:`, error.message);
                    
                    this.devices.push({
                        id: i,
                        name: `Device ${i} (Failed)`,
                        ledCount: 0,
                        directModeIndex: 0,
                        data: null
                    });
                }
            }
            
            if (this.devices.length === 0) {
                console.warn('OpenRGB: No devices discovered - no fallback devices');
                this.devices = [];
            }
            
        } catch (error) {
            console.error('OpenRGB: Device discovery failed:', error.message);
            this.devices = [];
        }
        
        console.log(`OpenRGB: Device discovery complete - ${this.devices.length} devices`);
        return this.devices;
    }

    async setAllDevicesColor(color) {
        const results = [];
        
        if (!this.connected) {
            console.warn('OpenRGB: Not connected');
            return results;
        }
        
        const selectedDeviceIds = this.settings ? this.settings.get_strv('selected-devices').map(id => parseInt(id)) : [];
        const devicesToSync = selectedDeviceIds.length > 0 
            ? this.devices.filter(device => selectedDeviceIds.includes(device.id))
            : this.devices;
        
        console.log(`OpenRGB: Syncing ${devicesToSync.length} devices`);
        
        for (const device of devicesToSync) {
            try {
                if (device.ledCount === 0) {
                    console.log(`OpenRGB: Skipping device ${device.id} - 0 LEDs`);
                    results.push({ deviceId: device.id, success: false, error: 'Device skipped (0 LEDs)' });
                    continue;
                }
                
                console.log(`OpenRGB: Updating device ${device.id} (${device.name}) with ${device.ledCount} LEDs`);
                
                const setDirectModeOnUpdate = this.settings ? this.settings.get_boolean('set-direct-mode-on-update') : false;
                if (setDirectModeOnUpdate) {
                    try {
                        await this.networkClient.setDeviceMode(device.id, device.directModeIndex);
                        console.log(`OpenRGB: Device ${device.id} - Set to direct mode ${device.directModeIndex} before update`);
                    } catch (modeError) {
                        console.warn(`OpenRGB: Failed to set device ${device.id} to direct mode before update:`, modeError.message);
                    }
                }
                
                await this.networkClient.updateLeds(device.id, color, device.ledCount);
                console.log(`OpenRGB: Device ${device.id} - Color update sent successfully`);
                results.push({ deviceId: device.id, success: true });
                
            } catch (error) {
                console.error(`OpenRGB: Failed to update device ${device.id}:`, error.message);
                results.push({ deviceId: device.id, success: false, error: error.message });
            }
        }
        
        return results;
    }
}
