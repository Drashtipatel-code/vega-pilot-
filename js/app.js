/**
 * VEGAPilot Ground Control - Main Application Coordinator
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize core subsystems
  const logger = new FlightLogger();
  const telemetry = new TelemetryEngine(GCS_CONFIG, logger);
  const map = new TacticalMap(GCS_CONFIG, telemetry, null);
  const mission = new MissionManager(telemetry, logger, map);
  map.mission = mission;

  // Make globally available for inline event handlers
  window.gcsLogger = logger;
  window.gcsTelemetry = telemetry;
  window.gcsMap = map;
  window.gcsMission = mission;

  // 2. Audio Alert Synthesizer (Web Audio API)
  class SoundAlert {
    constructor() {
      this.ctx = null;
    }
    beep(freq = 880, type = 'sine', duration = 0.15) {
      try {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Audio might be blocked until user interaction
      }
    }
    warning() {
      this.beep(600, 'triangle', 0.2);
      setTimeout(() => this.beep(600, 'triangle', 0.2), 250);
    }
    critical() {
      this.beep(900, 'sawtooth', 0.3);
      setTimeout(() => this.beep(900, 'sawtooth', 0.3), 350);
    }
  }
  const sound = new SoundAlert();

  // 3. UI Elements Cache
  const UI = {
    // Top Bar
    headerStatusDot: document.getElementById('header-status-dot'),
    headerStatusText: document.getElementById('header-status-text'),
    navTime: document.getElementById('nav-time'),
    btnToggleComms: document.getElementById('btn-toggle-comms'),

    // Battery HUD
    batteryPercent: document.getElementById('hud-battery-percent'),
    batteryBar: document.getElementById('hud-battery-bar'),
    batteryVoltage: document.getElementById('hud-battery-voltage'),
    batteryCurrent: document.getElementById('hud-battery-current'),
    batteryStatusBadge: document.getElementById('hud-battery-badge'),

    // Altitude & Speed
    altValue: document.getElementById('hud-alt-value'),
    altMsl: document.getElementById('hud-alt-msl'),
    vSpeed: document.getElementById('hud-vspeed'),
    gSpeed: document.getElementById('hud-gspeed'),
    headingValue: document.getElementById('hud-heading-val'),

    // Flight Mode & Arm Status
    flightModeBadge: document.getElementById('hud-flight-mode'),
    armBadge: document.getElementById('hud-arm-status'),
    btnArmToggle: document.getElementById('btn-arm-toggle'),
    modeSelectDropdown: document.getElementById('hud-mode-select'),

    // GNSS & Comms
    gnssFix: document.getElementById('hud-gnss-fix'),
    gnssSats: document.getElementById('hud-gnss-sats'),
    gnssHdop: document.getElementById('hud-gnss-hdop'),
    latValue: document.getElementById('hud-lat'),
    lngValue: document.getElementById('hud-lng'),
    commsRssi: document.getElementById('hud-comms-rssi'),
    commsLatency: document.getElementById('hud-comms-latency'),

    // Mission Monitoring
    missionStatusBadge: document.getElementById('hud-mission-status'),
    missionWpText: document.getElementById('hud-mission-wp'),
    missionProgressPercent: document.getElementById('hud-mission-pct'),
    missionProgressBar: document.getElementById('hud-mission-bar'),
    missionEta: document.getElementById('hud-mission-eta'),
    missionDistNext: document.getElementById('hud-mission-dist'),
    btnMissionPlayPause: document.getElementById('btn-mission-play-pause'),

    // Safety & Failsafes
    failsafeBanner: document.getElementById('failsafe-banner'),
    failsafeBannerText: document.getElementById('failsafe-banner-text'),
    fsBattery: document.getElementById('fs-battery'),
    fsComms: document.getElementById('fs-comms'),
    fsGeofence: document.getElementById('fs-geofence'),
    fsOverall: document.getElementById('fs-overall'),

    // System Health
    healthFc: document.getElementById('health-fc'),
    healthBattery: document.getElementById('health-battery'),
    healthNav: document.getElementById('health-nav'),
    healthAlertsCount: document.getElementById('health-alerts-count'),

    // Logs
    logsTbody: document.getElementById('logs-tbody'),
    logsCountBadge: document.getElementById('logs-count-badge'),
    logSearchInput: document.getElementById('log-search-input')
  };

  // Clock in navbar
  setInterval(() => {
    if (UI.navTime) {
      const now = new Date();
      UI.navTime.textContent = now.toLocaleTimeString();
    }
  }, 1000);

  // 4. Bind Flight Mode Selector
  if (UI.modeSelectDropdown) {
    UI.modeSelectDropdown.addEventListener('change', (e) => {
      telemetry.setFlightMode(e.target.value);
    });
  }

  // 5. Bind Comms Toggle
  if (UI.btnToggleComms) {
    UI.btnToggleComms.addEventListener('click', () => {
      telemetry.toggleComms();
    });
  }

  // 6. Navigation Tabs (Overview, Mission, Vehicle, Logs, Config)
  const navTabs = document.querySelectorAll('.nav-item');
  const sections = {
    overview: document.getElementById('section-overview'),
    mission: document.getElementById('section-mission'),
    vehicle: document.getElementById('section-vehicle'),
    logs: document.getElementById('section-logs'),
    config: document.getElementById('section-config')
  };

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.section;
      Object.keys(sections).forEach(secKey => {
        if (sections[secKey]) {
          sections[secKey].style.display = (secKey === target) ? 'block' : 'none';
        }
      });

      // If switched to map/overview, invalidate map size for crisp render
      if (target === 'overview' && map.map) {
        setTimeout(() => map.map.invalidateSize(), 150);
      }

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar && window.innerWidth <= 900) {
        sidebar.classList.remove('open');
      }
    });
  });

  // Real Arena & GCS Configuration Management
  const cfgPresetSelect = document.getElementById('cfg-preset-select');
  const cfgLat = document.getElementById('cfg-lat');
  const cfgLng = document.getElementById('cfg-lng');
  const cfgRadius = document.getElementById('cfg-radius');
  const cfgMaxAlt = document.getElementById('cfg-max-alt');
  const cfgCellCount = document.getElementById('cfg-cell-count');
  const cfgBatteryCap = document.getElementById('cfg-battery-cap');
  const cfgBatteryLow = document.getElementById('cfg-battery-low');
  const btnDetectGps = document.getElementById('btn-detect-gps');
  const gpsFeedback = document.getElementById('gps-status-feedback');
  const btnSaveConfig = document.getElementById('btn-save-config');
  const btnResetConfig = document.getElementById('btn-reset-config');

  // Preset location coordinates
  const locationPresets = {
    vadodara: [22.307200, 73.181200],
    ahmedabad: [23.076800, 72.498400],
    mumbai: [19.133400, 72.913300],
    bengaluru: [13.082700, 77.587700],
    delhi: [28.556200, 77.100000]
  };

  if (cfgPresetSelect) {
    cfgPresetSelect.addEventListener('change', (e) => {
      const coords = locationPresets[e.target.value];
      if (coords && cfgLat && cfgLng) {
        cfgLat.value = coords[0].toFixed(6);
        cfgLng.value = coords[1].toFixed(6);
      }
    });
  }

  // Detect My Real Location
  if (btnDetectGps) {
    btnDetectGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (gpsFeedback) gpsFeedback.innerHTML = '<span class="text-red">Geolocation is not supported by your browser.</span>';
        return;
      }
      if (gpsFeedback) gpsFeedback.innerHTML = '<span class="text-cyan">Acquiring real GNSS fix from device...</span>';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (cfgLat) cfgLat.value = lat.toFixed(6);
          if (cfgLng) cfgLng.value = lng.toFixed(6);
          if (gpsFeedback) {
            gpsFeedback.innerHTML = `<span class="text-green">✓ Real GPS Acquired: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Accuracy ±${Math.round(pos.coords.accuracy)}m)</span>`;
          }
          logger.log('GNSS', `Browser GNSS fix acquired at [${lat.toFixed(5)}, ${lng.toFixed(5)}]`, 'SUCCESS');
        },
        (err) => {
          if (gpsFeedback) {
            gpsFeedback.innerHTML = `<span class="text-orange">GPS access denied or timed out (${err.message}). Using manual input.</span>`;
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Save & Apply Configuration
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
      const newLat = parseFloat(cfgLat.value);
      const newLng = parseFloat(cfgLng.value);
      const radius = parseFloat(cfgRadius.value) || 30;
      const cells = parseInt(cfgCellCount.value) || 6;
      const cap = parseInt(cfgBatteryCap.value) || 5000;
      const lowBat = parseInt(cfgBatteryLow.value) || 25;
      const maxAlt = parseFloat(cfgMaxAlt.value) || 25;

      if (isNaN(newLat) || isNaN(newLng)) {
        alert('Please enter valid numeric latitude and longitude coordinates.');
        return;
      }

      // Update GCS_CONFIG
      GCS_CONFIG.arena.center = [newLat, newLng];
      GCS_CONFIG.arena.maxAltitude = maxAlt;
      GCS_CONFIG.safety.cellCount = cells;
      GCS_CONFIG.safety.batteryLowThreshold = lowBat;

      // Update map & boundary
      map.updateArenaCenter(newLat, newLng, radius);

      // Re-anchor drone and waypoints to new real coordinates
      telemetry.state.lat = newLat - 0.0001;
      telemetry.state.lng = newLng - 0.0001;
      telemetry.state.homePosition = { lat: newLat - 0.0001, lng: newLng - 0.0001, alt: 0 };
      telemetry.config.safety.cellCount = cells;

      // Rebuild waypoints around real arena center
      const dLat = (radius * 0.45) / 110800;
      const dLng = (radius * 0.45) / 102800;
      const newWps = [
        { id: 1, lat: +(newLat - dLat).toFixed(6), lng: +(newLng - dLng).toFixed(6), alt: 8.0, speed: 3.0, action: 'TAKEOFF' },
        { id: 2, lat: +(newLat + dLat).toFixed(6), lng: +(newLng - dLng).toFixed(6), alt: 12.0, speed: 4.0, action: 'WAYPOINT 2' },
        { id: 3, lat: +(newLat + dLat).toFixed(6), lng: +(newLng + dLng).toFixed(6), alt: 14.0, speed: 4.0, action: 'INSPECT WP 3' },
        { id: 4, lat: +(newLat - dLat).toFixed(6), lng: +(newLng + dLng).toFixed(6), alt: 10.0, speed: 3.5, action: 'WAYPOINT 4' },
        { id: 5, lat: +newLat.toFixed(6), lng: +newLng.toFixed(6), alt: 3.0, speed: 2.0, action: 'RTL' }
      ];

      mission.waypoints = newWps;
      mission.syncWaypoints();

      // Persist to localStorage
      try {
        localStorage.setItem('vegapilot_user_config', JSON.stringify({
          version: 2,
          center: [newLat, newLng],
          radius: radius,
          cellCount: cells,
          batteryCap: cap,
          batteryLow: lowBat,
          maxAltitude: maxAlt
        }));
      } catch (e) {
        console.warn('LocalStorage save failed', e);
      }

      logger.log('CONFIG', `Real Configuration Saved: Center [${newLat.toFixed(5)}, ${newLng.toFixed(5)}], ${cells}S LiPo`, 'SUCCESS');
      alert(`Real Configuration Applied!\nArena re-centered to [${newLat.toFixed(6)}, ${newLng.toFixed(6)}]. Map and waypoints updated.`);

      // Return to overview to see real map
      document.querySelector('[data-section="overview"]').click();
    });
  }

  // Reset to defaults
  if (btnResetConfig) {
    btnResetConfig.addEventListener('click', () => {
      localStorage.removeItem('vegapilot_user_config');
      location.reload();
    });
  }

  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // 7. Subscribe to Telemetry updates
  let prevArmed = null;
  let prevBatteryWarning = false;

  telemetry.subscribe((state) => {
    // Map & Marker update
    map.updateVehicleState(state);

    // Header Status
    if (state.connected) {
      UI.headerStatusDot.className = 'status-dot dot-green';
      UI.headerStatusText.textContent = 'TELEMETRY ONLINE';
      UI.btnToggleComms.textContent = 'Disconnect Comms';
      UI.btnToggleComms.className = 'btn-sm btn-ghost';
    } else {
      UI.headerStatusDot.className = 'status-dot dot-red';
      UI.headerStatusText.textContent = 'LINK LOST';
      UI.btnToggleComms.textContent = 'Reconnect Link';
      UI.btnToggleComms.className = 'btn-sm btn-danger';
    }

    // Battery HUD
    UI.batteryPercent.textContent = `${state.batteryPercent}%`;
    UI.batteryBar.style.width = `${state.batteryPercent}%`;
    UI.batteryVoltage.textContent = `${state.voltage}V`;
    UI.batteryCurrent.textContent = `${state.current}A · ${state.power}W`;

    if (state.batteryPercent <= GCS_CONFIG.safety.batteryCriticalThreshold) {
      UI.batteryStatusBadge.textContent = '● CRITICAL';
      UI.batteryStatusBadge.className = 'small text-red';
      UI.batteryBar.style.background = '#ff3b57';
      if (!prevBatteryWarning) { sound.critical(); prevBatteryWarning = true; }
    } else if (state.batteryPercent <= GCS_CONFIG.safety.batteryLowThreshold) {
      UI.batteryStatusBadge.textContent = '● LOW BATTERY';
      UI.batteryStatusBadge.className = 'small text-orange';
      UI.batteryBar.style.background = '#ffb020';
      if (!prevBatteryWarning) { sound.warning(); prevBatteryWarning = true; }
    } else {
      UI.batteryStatusBadge.textContent = '● Good (6S LiPo)';
      UI.batteryStatusBadge.className = 'small text-green';
      UI.batteryBar.style.background = '#00e599';
      prevBatteryWarning = false;
    }

    const hudBatteryTime = document.getElementById('hud-battery-time');
    if (hudBatteryTime && state.flightTimeString) {
      hudBatteryTime.textContent = state.flightTimeString;
    }

    // Altitude & Speed
    UI.altValue.textContent = `${state.alt.toFixed(1)} m`;
    UI.altMsl.textContent = `${state.altMSL.toFixed(1)} m`;
    UI.vSpeed.textContent = `${state.verticalSpeed > 0 ? '+' : ''}${state.verticalSpeed.toFixed(1)} m/s`;
    UI.gSpeed.textContent = `${state.groundSpeed.toFixed(1)} m/s (${(state.groundSpeed * 3.6).toFixed(0)} km/h)`;
    UI.headingValue.textContent = `${state.heading}°`;

    // Flight Mode & Arm Status
    UI.flightModeBadge.textContent = state.flightMode;
    if (UI.modeSelectDropdown && UI.modeSelectDropdown.value !== state.flightMode) {
      UI.modeSelectDropdown.value = state.flightMode;
    }

    if (state.armed) {
      UI.armBadge.textContent = 'ARMED';
      UI.armBadge.className = 'value text-green arm-pulse';
      UI.btnArmToggle.textContent = 'Disarm Vehicle';
      UI.btnArmToggle.className = 'btn-action btn-danger';
    } else {
      UI.armBadge.textContent = 'DISARMED';
      UI.armBadge.className = 'value text-muted';
      UI.btnArmToggle.textContent = 'Arm Vehicle';
      UI.btnArmToggle.className = 'btn-action btn-primary';
    }
    prevArmed = state.armed;

    // GNSS & Position
    UI.gnssFix.textContent = `● ${state.gnssFix}`;
    UI.gnssSats.textContent = `${state.satellites} Sats`;
    UI.gnssHdop.textContent = state.hdop.toFixed(2);
    UI.latValue.textContent = state.lat.toFixed(6);
    UI.lngValue.textContent = state.lng.toFixed(6);

    // Comms Link
    UI.commsRssi.textContent = `${state.rssi}%`;
    UI.commsLatency.textContent = `${state.latency} ms`;

    // Mission Monitoring
    UI.missionStatusBadge.textContent = state.missionStatus.replace('_', ' ');
    UI.missionWpText.textContent = `${state.currentWaypointIndex + 1} / ${state.totalWaypoints}`;
    UI.missionProgressPercent.textContent = `${state.missionProgressPercent}%`;
    UI.missionProgressBar.style.width = `${state.missionProgressPercent}%`;
    UI.missionEta.textContent = `${state.etaSeconds}s`;
    UI.missionDistNext.textContent = `${state.distanceToNextWP} m`;

    if (state.missionStatus === 'IN_PROGRESS') {
      UI.btnMissionPlayPause.innerHTML = '<span>⏸ Pause Mission</span>';
      UI.btnMissionPlayPause.className = 'btn-control btn-warning';
    } else {
      UI.btnMissionPlayPause.innerHTML = '<span>▶ Resume Mission</span>';
      UI.btnMissionPlayPause.className = 'btn-control btn-primary';
    }

    // Safety & Failsafe Banner
    const isAlert = state.failsafes.battery !== 'CLEAR' || 
                    state.failsafes.comms !== 'CLEAR' || 
                    state.failsafes.geofence !== 'CLEAR';

    if (isAlert) {
      UI.failsafeBanner.style.display = 'flex';
      let msg = 'CAUTION: ';
      if (state.failsafes.comms !== 'CLEAR') msg += '[TELEMETRY LINK LOSS] ';
      if (state.failsafes.battery === 'CRITICAL') msg += '[CRITICAL BATTERY] ';
      else if (state.failsafes.battery === 'WARNING') msg += '[LOW BATTERY] ';
      if (state.failsafes.geofence !== 'CLEAR') msg += '[ARENA GEOFENCE APPROACH] ';
      UI.failsafeBannerText.textContent = msg;
    } else {
      UI.failsafeBanner.style.display = 'none';
    }

    // Failsafe status chips
    UI.fsBattery.className = state.failsafes.battery === 'CLEAR' ? 'text-green' : 'text-red';
    UI.fsBattery.textContent = `● ${state.failsafes.battery}`;
    UI.fsComms.className = state.failsafes.comms === 'CLEAR' ? 'text-green' : 'text-red';
    UI.fsComms.textContent = `● ${state.failsafes.comms}`;
    UI.fsGeofence.className = state.failsafes.geofence === 'CLEAR' ? 'text-green' : 'text-orange';
    UI.fsGeofence.textContent = `● ${state.failsafes.geofence}`;
    UI.fsOverall.className = isAlert ? 'text-orange' : 'text-green';
    UI.fsOverall.textContent = isAlert ? '● ACTIVE WARNING' : '● NOMINAL';

    // System Health
    UI.healthFc.textContent = '● OK (IMU / Baro / Mag)';
    // Mobile Bottom Flight Dock Label
    const mobileArmBtn = document.getElementById('mobile-btn-arm');
    const mobileArmLabel = document.getElementById('mobile-arm-label');
    const hdrSatsCount = document.getElementById('hdr-sats-count');

    if (hdrSatsCount) hdrSatsCount.textContent = `${state.satellites} Sats`;
    if (mobileArmBtn && mobileArmLabel) {
      if (state.armed) {
        mobileArmLabel.textContent = 'DISARM MOTORS';
        mobileArmBtn.className = 'mobile-fab-btn btn-danger';
      } else {
        mobileArmLabel.textContent = 'ARM MOTORS';
        mobileArmBtn.className = 'mobile-fab-btn btn-primary';
      }
    }
    // Update Artificial Horizon PFD gyro & vehicle health telemetry
    const pfdHorizon = document.getElementById('pfd-horizon-surface');
    const pfdRoll = document.getElementById('pfd-roll-val');
    const pfdPitch = document.getElementById('pfd-pitch-val');
    const vehRoll = document.getElementById('veh-roll');
    const vehPitch = document.getElementById('veh-pitch');

    if (pfdHorizon) {
      pfdHorizon.style.transform = `rotate(${state.roll}deg) translateY(${state.pitch * 1.6}px)`;
    }
    if (pfdRoll) pfdRoll.textContent = `${state.roll > 0 ? '+' : ''}${state.roll}°`;
    if (pfdPitch) pfdPitch.textContent = `${state.pitch > 0 ? '+' : ''}${state.pitch}°`;
    if (vehRoll) vehRoll.textContent = `${state.roll > 0 ? '+' : ''}${state.roll}°`;
    if (vehPitch) vehPitch.textContent = `${state.pitch > 0 ? '+' : ''}${state.pitch}°`;

    // Update Checklist Modal Live Values
    const chkBat = document.getElementById('chk-val-bat');
    const chkGnss = document.getElementById('chk-val-gnss');
    const chkRssi = document.getElementById('chk-val-rssi');
    if (chkBat) chkBat.textContent = `PASS (${state.voltage}V)`;
    if (chkGnss) chkGnss.textContent = `PASS (${state.satellites} Sats)`;
    if (chkRssi) chkRssi.textContent = `PASS (${state.rssi}%)`;
  });

  // Feature 1: Fault Injection Buttons
  document.querySelectorAll('.btn-fault').forEach(btn => {
    btn.addEventListener('click', () => {
      telemetry.injectFault(btn.dataset.fault);
    });
  });

  // Feature 4: Toggle PiP Camera Feed
  const pipCamera = document.getElementById('dji-pip-camera');
  const btnToggleCamera = document.getElementById('fab-toggle-camera');
  const btnTogglePip = document.getElementById('btn-toggle-pip');

  if (btnToggleCamera && pipCamera) {
    btnToggleCamera.addEventListener('click', () => {
      const isVisible = pipCamera.style.display !== 'none';
      pipCamera.style.display = isVisible ? 'none' : 'flex';
      btnToggleCamera.classList.toggle('active', !isVisible);
    });
  }

  if (btnTogglePip && pipCamera) {
    btnTogglePip.addEventListener('click', () => {
      pipCamera.style.display = 'none';
      if (btnToggleCamera) btnToggleCamera.classList.remove('active');
    });
  }

  // Feature 3: Toggle Primary Flight Display (PFD)
  const pfdWidget = document.getElementById('dji-pfd-widget');
  const btnTogglePfd = document.getElementById('fab-toggle-pfd');

  if (btnTogglePfd && pfdWidget) {
    btnTogglePfd.addEventListener('click', () => {
      const isVisible = pfdWidget.style.display !== 'none';
      pfdWidget.style.display = isVisible ? 'none' : 'flex';
      btnTogglePfd.classList.toggle('active', !isVisible);
    });
  }

  // Feature 2: Pre-Flight Safety Checklist Modal
  const checklistModal = document.getElementById('checklist-modal');
  const btnOpenChecklist = document.getElementById('btn-open-checklist');
  const mobileBtnChecklist = document.getElementById('mobile-btn-checklist');
  const btnCloseChecklist = document.getElementById('btn-close-checklist');
  const btnCancelChecklist = document.getElementById('btn-checklist-cancel');
  const btnProceedArm = document.getElementById('btn-proceed-to-arm');

  function openChecklist() {
    if (checklistModal) checklistModal.classList.add('active');
  }

  function closeChecklist() {
    if (checklistModal) checklistModal.classList.remove('active');
  }

  if (btnOpenChecklist) btnOpenChecklist.addEventListener('click', openChecklist);
  if (mobileBtnChecklist) mobileBtnChecklist.addEventListener('click', openChecklist);
  if (btnCloseChecklist) btnCloseChecklist.addEventListener('click', closeChecklist);
  if (btnCancelChecklist) btnCancelChecklist.addEventListener('click', closeChecklist);

  if (btnProceedArm) {
    btnProceedArm.addEventListener('click', () => {
      closeChecklist();
      mission.handleArmButtonClick();
    });
  }

  // 8. Simple-Language [?] Information Explainer System
  const infoModal = document.getElementById('info-explainer-modal');
  const infoTitle = document.getElementById('info-modal-title');
  const infoText = document.getElementById('info-modal-text');
  const btnCloseInfo = document.getElementById('btn-close-info-modal');
  const btnInfoGotIt = document.getElementById('btn-info-got-it');

  function openHelp(key) {
    if (!infoModal || !GCS_CONFIG.helpDictionary) return;
    const item = GCS_CONFIG.helpDictionary[key];
    if (item) {
      infoTitle.textContent = item.title;
      infoText.textContent = item.text;
      infoModal.classList.add('active');
    }
  }

  function closeHelp() {
    if (infoModal) infoModal.classList.remove('active');
  }

  document.querySelectorAll('.info-help-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openHelp(btn.dataset.help);
    });
  });

  if (btnCloseInfo) btnCloseInfo.addEventListener('click', closeHelp);
  if (btnInfoGotIt) btnInfoGotIt.addEventListener('click', closeHelp);
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeHelp();
    });
  }

  // 9. Full-Screen Mobile Terminal Sheet
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
  }

  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeMobileSidebar);

  // 10. Mobile Bottom Flight Action Dock
  const mobileBtnArm = document.getElementById('mobile-btn-arm');
  const mobileBtnRtl = document.getElementById('mobile-btn-rtl');
  const mobileBtnAbort = document.getElementById('mobile-btn-abort');

  if (mobileBtnArm) {
    mobileBtnArm.addEventListener('click', () => mission.handleArmButtonClick());
  }
  if (mobileBtnRtl) {
    mobileBtnRtl.addEventListener('click', () => {
      if (confirm('Trigger Return-to-Home (RTL)? Drone will climb and return to Home Point.')) {
        telemetry.triggerRTL();
      }
    });
  }
  if (mobileBtnAbort) {
    mobileBtnAbort.addEventListener('click', () => mission.showAbortModal());
  }

  // 11. Flight Logs UI Handling
  function renderLogs(logs) {
    if (!UI.logsTbody) return;
    if (UI.logsCountBadge) UI.logsCountBadge.textContent = `${logs.length} events`;

    if (logs.length === 0) {
      UI.logsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 20px;">No flight log records match filter.</td></tr>`;
      return;
    }

    UI.logsTbody.innerHTML = logs.slice(0, 80).map(entry => {
      let badgeClass = 'log-badge-info';
      if (entry.level === 'SUCCESS') badgeClass = 'log-badge-success';
      if (entry.level === 'WARN') badgeClass = 'log-badge-warn';
      if (entry.level === 'ERROR') badgeClass = 'log-badge-error';

      return `
        <tr>
          <td class="mono small">${entry.timeStr}</td>
          <td><span class="log-badge ${badgeClass}">${entry.level}</span></td>
          <td><strong>${entry.subsystem}</strong></td>
          <td>${entry.message}</td>
        </tr>
      `;
    }).join('');
  }

  logger.subscribe(renderLogs);

  // Log filter buttons
  document.querySelectorAll('.btn-log-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-log-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      logger.setFilter(btn.dataset.level);
    });
  });

  // Log search input
  if (UI.logSearchInput) {
    UI.logSearchInput.addEventListener('input', (e) => {
      logger.setSearch(e.target.value);
    });
  }

  // Clear & Export log buttons
  const btnClearLogs = document.getElementById('btn-clear-logs');
  if (btnClearLogs) btnClearLogs.addEventListener('click', () => logger.clear());

  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) btnExportCsv.addEventListener('click', () => logger.exportCSV());

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) btnExportJson.addEventListener('click', () => logger.exportJSON());

  // Render initial mission waypoints table
  mission.renderWaypointsTable();

  // Add Waypoint button trigger
  const btnAddWp = document.getElementById('btn-add-wp');
  if (btnAddWp) {
    btnAddWp.addEventListener('click', () => {
      const c = GCS_CONFIG.arena.center;
      mission.addWaypointAt(c[0] + (Math.random() * 0.0004 - 0.0002), c[1] + (Math.random() * 0.0004 - 0.0002));
    });
  }
});
