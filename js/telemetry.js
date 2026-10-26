/**
 * VEGAPilot Ground Control - Drone Telemetry Engine
 * Manages live/simulated vehicle state, battery, GNSS, communications, and safety failsafes
 */

class TelemetryEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.listeners = [];

    // State definition
    this.state = {
      connected: true,
      lastHeartbeat: Date.now(),
      rssi: 98, // %
      latency: 24, // ms
      packetLoss: 0.05, // %
      packetsReceived: 1240,

      // Vehicle State
      armed: true,
      flightMode: 'AUTO', // AUTO, GUIDED, RTL, LOITER, MANUAL, LAND

      // Battery
      batteryPercent: 84,
      voltage: 24.12, // 6S LiPo
      voltagePerCell: 4.02,
      current: 12.8, // Amperes
      power: 308.7, // Watts
      consumedMah: 1680,
      batteryCapacityMah: 5000,
      batteryWarning: false,
      batteryCritical: false,

      // Navigation & Position
      lat: config.defaultWaypoints[0].lat,
      lng: config.defaultWaypoints[0].lng,
      alt: 12.5, // meters AGL
      altMSL: 54.2, // meters MSL
      heading: 42, // degrees (0-360)
      groundSpeed: 3.8, // m/s
      verticalSpeed: 0.1, // m/s
      roll: 2.1, // deg
      pitch: 1.4, // deg
      homePosition: { lat: config.defaultWaypoints[0].lat, lng: config.defaultWaypoints[0].lng, alt: 0 },

      // GNSS
      gnssFix: '3D DGPS Fix',
      satellites: 18,
      hdop: 0.76,
      vdop: 0.88,

      // Health
      health: {
        fc: 'HEALTHY',
        imu: 'OPTIMAL',
        baro: 'OPTIMAL',
        compass: 'CALIBRATED',
        ekf: 'HEALTHY',
        esc: 'NORMAL',
        alertsCount: 0
      },

      // Failsafe status
      failsafes: {
        battery: 'CLEAR',
        comms: 'CLEAR',
        geofence: 'CLEAR',
        terrain: 'CLEAR',
        overall: 'NORMAL'
      },

      // Mission progress
      missionStatus: 'IN_PROGRESS', // READY, IN_PROGRESS, PAUSED, RTL, COMPLETED, ABORTED
      currentWaypointIndex: 1, // 0-based
      totalWaypoints: config.defaultWaypoints.length,
      waypoints: JSON.parse(JSON.stringify(config.defaultWaypoints)),
      distanceToNextWP: 14.8, // meters
      missionProgressPercent: 40,
      etaSeconds: 45
    };

    this.timer = null;
    this.isSimulating = true;
    this.startSimulation();
  }

  startSimulation() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.updateStep(), 400); // 2.5Hz update loop
  }

  stopSimulation() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateStep() {
    if (!this.state.connected) {
      this.notify();
      return;
    }

    this.state.lastHeartbeat = Date.now();
    this.state.packetsReceived += 1;

    // Small telemetry fluctuations (realistic radio telemetry jitter)
    this.state.rssi = Math.min(100, Math.max(85, Math.round(96 + (Math.random() * 6 - 3))));
    this.state.latency = Math.max(16, Math.min(45, Math.round(22 + (Math.random() * 8 - 4))));

    // Battery simulation
    if (this.state.armed && this.isSimulating) {
      const drain = 0.015 + (this.state.groundSpeed / 100);
      this.state.batteryPercent = Math.max(0, +(this.state.batteryPercent - drain * 0.1).toFixed(1));
      this.state.voltagePerCell = +(3.2 + (this.state.batteryPercent / 100) * 1.0).toFixed(2);
      this.state.voltage = +(this.state.voltagePerCell * this.config.safety.cellCount).toFixed(2);
      this.state.current = +(11.0 + (this.state.groundSpeed * 1.8) + (Math.random() * 0.8)).toFixed(1);
      // Auto-calculate consumed mAh and remaining flight time
      const remainingMah = (this.state.batteryCapacityMah * (this.state.batteryPercent / 100));
      this.state.consumedMah = Math.round(this.state.batteryCapacityMah - remainingMah);
      const currentMahPerSec = (this.state.current * 1000) / 3600; // mA to mAh/sec
      const remainingSec = currentMahPerSec > 0 ? Math.round(remainingMah / currentMahPerSec) : 0;
      this.state.flightTimeRemainingSec = remainingSec;
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      this.state.flightTimeString = `${mins}m ${String(secs).padStart(2, '0')}s`;

      // Check battery failsafe
      if (this.state.batteryPercent <= this.config.safety.batteryCriticalThreshold) {
        if (!this.state.batteryCritical) {
          this.state.batteryCritical = true;
          this.state.failsafes.battery = 'CRITICAL';
          this.logger.log('SAFETY', `CRITICAL BATTERY (${this.state.batteryPercent}%). Triggering Emergency RTL!`, 'ERROR');
          this.setFlightMode('RTL');
        }
      } else if (this.state.batteryPercent <= this.config.safety.batteryLowThreshold) {
        if (!this.state.batteryWarning) {
          this.state.batteryWarning = true;
          this.state.failsafes.battery = 'WARNING';
          this.logger.log('SAFETY', `Low battery threshold reached: ${this.state.batteryPercent}%`, 'WARN');
        }
      }
    }

    // Mission & Position Simulation
    if (this.isSimulating && this.state.armed && this.state.missionStatus === 'IN_PROGRESS') {
      const currentWP = this.state.waypoints[this.state.currentWaypointIndex];
      if (currentWP) {
        // Vector towards current waypoint
        const dLat = currentWP.lat - this.state.lat;
        const dLng = currentWP.lng - this.state.lng;
        const dAlt = currentWP.alt - this.state.alt;

        // Approx distance in meters (Vadodara ~ 1 deg lat = 110,800m, 1 deg lng = 102,800m)
        const distY = dLat * 110800;
        const distX = dLng * 102800;
        const dist2D = Math.sqrt(distX * distX + distY * distY);
        this.state.distanceToNextWP = +dist2D.toFixed(1);

        // Heading towards target
        const targetHeading = ((Math.atan2(distX, distY) * 180 / Math.PI) + 360) % 360;
        // Smooth heading turn
        let diffHeading = targetHeading - this.state.heading;
        if (diffHeading > 180) diffHeading -= 360;
        if (diffHeading < -180) diffHeading += 360;
        this.state.heading = Math.round((this.state.heading + diffHeading * 0.25 + 360) % 360);

        // Dynamic roll and pitch simulation for Artificial Horizon PFD
        const targetRoll = Math.max(-25, Math.min(25, -diffHeading * 0.7));
        this.state.roll = +(this.state.roll * 0.75 + targetRoll * 0.25).toFixed(1);
        const targetPitch = Math.max(-15, Math.min(15, this.state.verticalSpeed * 2.0 - (this.state.groundSpeed * 0.3)));
        this.state.pitch = +(this.state.pitch * 0.75 + targetPitch * 0.25).toFixed(1);

        if (dist2D < 1.5) {
          // Reached waypoint
          this.logger.log('NAV', `Reached Waypoint ${this.state.currentWaypointIndex + 1} (${currentWP.action})`, 'SUCCESS');
          
          if (this.state.currentWaypointIndex + 1 < this.state.waypoints.length) {
            this.state.currentWaypointIndex += 1;
            this.updateMissionProgress();
          } else {
            // Completed all waypoints
            this.state.missionStatus = 'COMPLETED';
            this.state.groundSpeed = 0;
            this.logger.log('MISSION', 'Mission completed all assigned waypoints successfully.', 'SUCCESS');
          }
        } else {
          // Move towards waypoint
          const stepDist = (currentWP.speed || 3.5) * 0.35; // meters per update tick
          const moveRatio = Math.min(1, stepDist / Math.max(0.1, dist2D));
          
          this.state.lat += dLat * moveRatio;
          this.state.lng += dLng * moveRatio;
          this.state.alt = +(this.state.alt + dAlt * 0.1).toFixed(1);
          this.state.altMSL = +(this.state.alt + 41.7).toFixed(1);
          this.state.groundSpeed = +(currentWP.speed * (0.9 + Math.random() * 0.15)).toFixed(1);
          this.state.verticalSpeed = +(dAlt * 0.2).toFixed(1);

          this.updateMissionProgress();
        }
      }
    } else if (this.state.missionStatus === 'RTL' && this.state.armed) {
      // Simulating return to home
      const dLat = this.state.homePosition.lat - this.state.lat;
      const dLng = this.state.homePosition.lng - this.state.lng;
      const dist2D = Math.sqrt(Math.pow(dLat * 110800, 2) + Math.pow(dLng * 102800, 2));

      if (dist2D > 1.0) {
        this.state.lat += dLat * 0.15;
        this.state.lng += dLng * 0.15;
        this.state.alt = Math.max(10.0, this.state.alt); // Return at safe transit altitude
        this.state.groundSpeed = 4.2;
      } else {
        // Over home, descending
        if (this.state.alt > 0.3) {
          this.state.alt = Math.max(0, +(this.state.alt - 0.5).toFixed(1));
          this.state.verticalSpeed = -0.5;
          this.state.groundSpeed = 0.2;
        } else {
          this.state.alt = 0;
          this.state.verticalSpeed = 0;
          this.state.groundSpeed = 0;
          this.setArmed(false);
          this.state.missionStatus = 'COMPLETED';
          this.logger.log('NAV', 'Drone touchdown at Home Point. Motors disarmed automatically.', 'SUCCESS');
        }
      }
    }

    // Geofence check
    this.checkGeofence();

    this.notify();
  }

  updateMissionProgress() {
    const total = this.state.waypoints.length;
    const progress = Math.min(100, Math.round(((this.state.currentWaypointIndex) / total) * 100));
    this.state.missionProgressPercent = progress;
    const remainingWps = total - this.state.currentWaypointIndex;
    this.state.etaSeconds = Math.max(0, remainingWps * 12);
  }

  checkGeofence() {
    const b = this.config.arena.boundary;
    // Bounding box quick check
    const minLat = Math.min(...b.map(p => p[0]));
    const maxLat = Math.max(...b.map(p => p[0]));
    const minLng = Math.min(...b.map(p => p[1]));
    const maxLng = Math.max(...b.map(p => p[1]));

    const inside = (
      this.state.lat >= minLat - 0.0001 &&
      this.state.lat <= maxLat + 0.0001 &&
      this.state.lng >= minLng - 0.0001 &&
      this.state.lng <= maxLng + 0.0001
    );

    if (!inside && this.state.armed) {
      if (this.state.failsafes.geofence !== 'BREACH') {
        this.state.failsafes.geofence = 'BREACH';
        this.logger.log('SAFETY', 'GEOFENCE WARNING: Vehicle approaching arena boundary!', 'WARN');
      }
    } else {
      this.state.failsafes.geofence = 'CLEAR';
    }
  }

  // Action methods
  setArmed(arm) {
    if (this.state.armed === arm) return;
    this.state.armed = arm;
    if (arm) {
      this.logger.log('VEHICLE', 'MOTORS ARMED. Stand clear of propellers.', 'WARN');
      if (this.state.alt < 0.5) {
        this.state.alt = 1.0; // Initial spin-up
      }
    } else {
      this.logger.log('VEHICLE', 'Motors DISARMED.', 'INFO');
      this.state.groundSpeed = 0;
      this.state.verticalSpeed = 0;
    }
    this.notify();
  }

  setFlightMode(mode) {
    if (this.state.flightMode === mode) return;
    const prev = this.state.flightMode;
    this.state.flightMode = mode;
    this.logger.log('FLIGHT', `Flight Mode changed: ${prev} -> ${mode}`, 'INFO');

    if (mode === 'RTL') {
      this.state.missionStatus = 'RTL';
      this.logger.log('SAFETY', 'Return-to-Home (RTL) activated. Navigating to Launch Point.', 'WARN');
    } else if (mode === 'LAND') {
      this.state.missionStatus = 'PAUSED';
      this.logger.log('FLIGHT', 'LAND mode active. Descent initiated at current coordinate.', 'WARN');
    }
    this.notify();
  }

  startMission() {
    this.state.missionStatus = 'IN_PROGRESS';
    this.state.flightMode = 'AUTO';
    if (!this.state.armed) {
      this.setArmed(true);
    }
    this.logger.log('MISSION', `Mission execution resumed at Waypoint ${this.state.currentWaypointIndex + 1}`, 'INFO');
    this.notify();
  }

  pauseMission() {
    this.state.missionStatus = 'PAUSED';
    this.state.flightMode = 'LOITER';
    this.state.groundSpeed = 0;
    this.logger.log('MISSION', 'Mission paused. Vehicle holding position (LOITER).', 'WARN');
    this.notify();
  }

  abortMission() {
    this.state.missionStatus = 'ABORTED';
    this.state.flightMode = 'LAND';
    this.logger.log('SAFETY', 'EMERGENCY MISSION ABORT! Vehicle landing immediately.', 'ERROR');
    this.notify();
  }

  triggerRTL() {
    this.setFlightMode('RTL');
  }

  emergencyKill() {
    this.setArmed(false);
    this.state.missionStatus = 'ABORTED';
    this.state.groundSpeed = 0;
    this.state.alt = 0;
    this.logger.log('SAFETY', 'EMERGENCY MOTOR CUT TRIGGERED! ALL MOTORS STOPPED.', 'ERROR');
    this.notify();
  }

  toggleComms(forceState = null) {
    this.state.connected = forceState !== null ? forceState : !this.state.connected;
    if (this.state.connected) {
      this.logger.log('COMMS', 'Telemetry connection established. Receiving MAVLink 2.0 stream.', 'SUCCESS');
      this.state.failsafes.comms = 'CLEAR';
    } else {
      this.logger.log('COMMS', 'TELEMETRY LINK LOST! Failsafe watchdog running.', 'ERROR');
      this.state.failsafes.comms = 'LINK_LOSS';
    }
    this.notify();
  }

  setWaypoints(newWaypoints) {
    this.state.waypoints = JSON.parse(JSON.stringify(newWaypoints));
    this.state.totalWaypoints = newWaypoints.length;
    this.state.currentWaypointIndex = 0;
    this.updateMissionProgress();
    this.logger.log('MISSION', `Updated mission waypoints (${newWaypoints.length} points loaded)`, 'INFO');
    this.notify();
  }

  injectFault(type) {
    if (type === 'battery') {
      this.state.batteryPercent = 14.2;
      this.state.batteryCritical = true;
      this.state.failsafes.battery = 'CRITICAL';
      this.logger.log('SAFETY', 'FAULT INJECTION: Simulated Critical Low Battery (14.2%). Triggering Emergency RTL!', 'ERROR');
      this.setFlightMode('RTL');
    } else if (type === 'comms') {
      this.state.connected = false;
      this.state.failsafes.comms = 'LINK_LOSS';
      this.logger.log('SAFETY', 'FAULT INJECTION: Telemetry Link Cut. Loss-of-Signal Failsafe Activated!', 'ERROR');
    } else if (type === 'geofence') {
      this.state.lat += 0.0006; // Push outside arena
      this.state.failsafes.geofence = 'BREACH';
      this.logger.log('SAFETY', 'FAULT INJECTION: Geofence Breach Triggered! Vehicle Outside Arena Perimeter.', 'ERROR');
    } else if (type === 'motor') {
      this.state.health.fc = 'WARNING';
      this.state.health.esc = 'MOTOR 3 ESC OVERHEAT (85°C)';
      this.state.health.alertsCount += 1;
      this.logger.log('SAFETY', 'FAULT INJECTION: Motor 3 ESC Overheat Alert (85°C)!', 'WARN');
    } else if (type === 'clear') {
      this.state.connected = true;
      this.state.batteryPercent = 84;
      this.state.batteryCritical = false;
      this.state.batteryWarning = false;
      this.state.failsafes.battery = 'CLEAR';
      this.state.failsafes.comms = 'CLEAR';
      this.state.failsafes.geofence = 'CLEAR';
      this.state.health.fc = 'HEALTHY';
      this.state.health.esc = 'NORMAL';
      this.state.health.alertsCount = 0;
      if (this.state.waypoints[this.state.currentWaypointIndex]) {
        this.state.lat = this.state.waypoints[this.state.currentWaypointIndex].lat;
        this.state.lng = this.state.waypoints[this.state.currentWaypointIndex].lng;
      }
      this.logger.log('SAFETY', 'FAULT INJECTION CLEARED: All systems restored to NOMINAL.', 'SUCCESS');
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.state);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.state));
  }
}

if (typeof window !== 'undefined') {
  window.TelemetryEngine = TelemetryEngine;
}
