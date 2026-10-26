/**
 * VEGAPilot Ground Control Station Configuration
 * NiDAR Competition Edition - Professional DJI-Style Architecture
 */

const GCS_CONFIG = {
  appName: 'VEGAPilot Ground Control',
  version: '2.5.0',
  competition: 'NiDAR Competition',

  // Arena & Geofence (Centered on wide open Vadodara Navlakhi Open Grounds: 22.2982, 73.1948)
  arena: {
    name: 'NiDAR Competition Open Arena (Navlakhi Field)',
    center: [22.29820, 73.19480],
    zoom: 17,
    maxZoom: 17, // Strict cap: prevents 'Map data not yet available'
    minZoom: 14,
    // 110m x 120m clear open ground safety polygon
    boundary: [
      [22.29870, 73.19420],
      [22.29870, 73.19540],
      [22.29770, 73.19540],
      [22.29770, 73.19420]
    ],
    maxAltitude: 30.0, // meters AGL
    minAltitude: 1.0,
    maxSpeed: 8.0, // m/s
  },

  // Realistic DJI-style spaced flight waypoints (Takeoff Home -> Survey Leg -> Inspect -> Return)
  defaultWaypoints: [
    { id: 1, lat: 22.29790, lng: 73.19450, alt: 8.0, speed: 2.5, action: 'HOME / TAKEOFF', isHome: true },
    { id: 2, lat: 22.29850, lng: 73.19450, alt: 14.0, speed: 4.0, action: 'SURVEY NORTH (WP 2)' },
    { id: 3, lat: 22.29850, lng: 73.19510, alt: 16.0, speed: 4.0, action: 'INSPECT EAST (WP 3)' },
    { id: 4, lat: 22.29790, lng: 73.19510, alt: 12.0, speed: 3.5, action: 'SURVEY SOUTH (WP 4)' },
    { id: 5, lat: 22.29792, lng: 73.19460, alt: 3.5, speed: 2.0, action: 'APPROACH & LAND (RTL)' }
  ],

  // Safety & Failsafe Thresholds
  safety: {
    batteryLowThreshold: 25, // %
    batteryCriticalThreshold: 15, // %
    voltagePerCellLow: 3.6, // Volts
    voltagePerCellCritical: 3.4,
    cellCount: 6, // 6S LiPo default (Nominal 22.2V, Max 25.2V)
    linkLossTimeoutMs: 3000,
    geofenceBreachToleranceMeters: 2.0
  },

  // Map Tile Providers (100% Free, High Reliability, No 403 or Missing Data errors)
  mapProviders: {
    satellite: {
      name: 'Google Satellite Hybrid (Ultra Sharp)',
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: '&copy; Google Maps'
    },
    esriSatellite: {
      name: 'Esri World Imagery (Satellite)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar'
    },
    streets: {
      name: 'Real World Streets (Esri Street Map)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, HERE, Garmin'
    }
  },

  // Simple-Language Plain English Help Explanations for [?] Tags
  helpDictionary: {
    battery: {
      title: 'Battery Level (%)',
      text: 'Shows remaining battery life in percent. When it drops below 25%, the drone will warn you. At 15%, it will automatically fly back home to avoid a crash.'
    },
    voltage: {
      title: 'Pack Voltage & Power',
      text: 'The electrical strength of your drone battery. A full 6S LiPo pack is 25.2 Volts; an empty pack is around 21.0 Volts. Current (A) and Power (W) show how much energy the motors are using right now.'
    },
    altitude: {
      title: 'Altitude (AGL & MSL)',
      text: 'AGL means Above Ground Level: how high your drone is flying straight above the takeoff spot in meters. MSL is height above sea level.'
    },
    speed: {
      title: 'Flight Speeds',
      text: 'Ground Speed: horizontal forward speed over the ground in m/s and km/h. Vertical Speed: how fast the drone is climbing up (+) or descending down (-).'
    },
    heading: {
      title: 'Compass Heading (HDG)',
      text: 'The exact compass direction the drone camera/nose is facing, from 0° (North), 90° (East), 180° (South), to 270° (West).'
    },
    flightMode: {
      title: 'Flight Mode',
      text: 'AUTO = Flies the programmed waypoints automatically. LOITER = Brakes and hovers steadily in the air. RTL = Climbs and flies back to where it took off. LAND = Gently touches down on the spot.'
    },
    armStatus: {
      title: 'Arming Status (SAFETY)',
      text: 'ARMED: Motors are energized and propellers will spin! Stand well clear. DISARMED: Motors are completely powered off and safe to approach.'
    },
    gnss: {
      title: 'GPS / GNSS Navigation',
      text: 'Positioning from satellites in orbit. 3D Fix with 14+ satellites locks the drone tightly in 3D space so wind cannot blow it off course.'
    },
    hdop: {
      title: 'HDOP (GPS Accuracy)',
      text: 'Horizontal Dilution of Precision. Measures satellite positioning accuracy. Lower is better: values under 1.0 mean pinpoint accuracy within a few centimeters.'
    },
    comms: {
      title: 'Telemetry Radio Link (RSSI)',
      text: 'Signal strength of the wireless connection between ground station and drone. 90-100% is excellent. If signal drops below 40%, move closer.'
    },
    failsafe: {
      title: 'Safety Failsafe System',
      text: 'An automated electronic safeguard. If telemetry link is lost, battery gets critically low, or GPS drops, failsafe automatically triggers Return-to-Home.'
    },
    geofence: {
      title: 'Arena Geofence Boundary',
      text: 'A virtual invisible cage around the competition arena. If the drone approaches this boundary, it stops or returns to prevent leaving the arena.'
    },
    mission: {
      title: 'Mission Waypoints',
      text: 'A pre-planned autonomous flight path. The drone flies smoothly from Waypoint 1 (Takeoff) to each checkpoint at specified heights and speeds, then returns home.'
    },
    rtl: {
      title: 'Return to Home (RTL / RTH)',
      text: 'Emergency button: Commands the drone to climb to a safe transit altitude, fly directly back to its takeoff spot, and land automatically.'
    },
    abort: {
      title: 'Emergency Mission Abort',
      text: 'Immediate safety intervention: Choose between LAND NOW (soft landing at current spot) or EMERGENCY MOTOR CUT (cuts motors immediately in severe danger).'
    }
  }
};

// Load saved custom configuration from localStorage if available (version 2+)
try {
  const savedCfg = localStorage.getItem('vegapilot_user_config');
  if (savedCfg) {
    const parsed = JSON.parse(savedCfg);
    if (parsed.version >= 2) {
      if (parsed.center) GCS_CONFIG.arena.center = parsed.center;
      if (parsed.arenaName) GCS_CONFIG.arena.name = parsed.arenaName;
      if (parsed.cellCount) GCS_CONFIG.safety.cellCount = parsed.cellCount;
      if (parsed.maxAltitude) GCS_CONFIG.arena.maxAltitude = parsed.maxAltitude;
    }
  }
} catch (e) {
  console.warn('Could not read saved config from localStorage', e);
}

if (typeof window !== 'undefined') {
  window.GCS_CONFIG = GCS_CONFIG;
}
