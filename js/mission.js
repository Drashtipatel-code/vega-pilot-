/**
 * VEGAPilot Ground Control - Mission Planning & Vehicle Controls
 * Handles waypoints configuration, upload/download, arming confirmation, and safety overrides
 */

class MissionManager {
  constructor(telemetry, logger, map) {
    this.telemetry = telemetry;
    this.logger = logger;
    this.map = map;
    this.waypoints = JSON.parse(JSON.stringify(telemetry.state.waypoints));

    this.pendingArmAction = false;
    this.pendingAbortAction = false;

    this.initEventListeners();
  }

  setMap(map) {
    this.map = map;
  }

  initEventListeners() {
    // Mission Upload File Input
    const fileInput = document.getElementById('mission-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleMissionFileUpload(e));
    }

    // Arming Slide / Button Trigger
    const armBtn = document.getElementById('btn-arm-toggle');
    if (armBtn) {
      armBtn.addEventListener('click', () => this.handleArmButtonClick());
    }

    // RTL Button
    const rtlBtn = document.getElementById('btn-cmd-rtl');
    if (rtlBtn) {
      rtlBtn.addEventListener('click', () => {
        if (confirm('Initiate Return-to-Home (RTL)? Vehicle will ascend to safe altitude and return to launch coordinate.')) {
          this.telemetry.triggerRTL();
        }
      });
    }

    // Emergency Abort Button
    const abortBtn = document.getElementById('btn-cmd-abort');
    if (abortBtn) {
      abortBtn.addEventListener('click', () => this.showAbortModal());
    }

    // Mission Start / Pause Button
    const playPauseBtn = document.getElementById('btn-mission-play-pause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => this.toggleMissionExecution());
    }

    // Restart Mission
    const restartBtn = document.getElementById('btn-mission-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restartMission());
    }

    // Skip Waypoint
    const skipBtn = document.getElementById('btn-mission-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.skipWaypoint());
    }

    // Export Mission Button
    const exportBtn = document.getElementById('btn-export-mission');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportMission());
    }

    // Preset Mission Selector
    const presetSelect = document.getElementById('mission-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => this.loadPreset(e.target.value));
    }

    // Modal Confirmation Handlers
    this.initModalSafeguards();
  }

  handleArmButtonClick() {
    if (this.telemetry.state.armed) {
      // Safe disarm
      if (confirm('Disarm vehicle motors now?')) {
        this.telemetry.setArmed(false);
      }
    } else {
      // Show Safety Arming Confirmation Modal
      this.showArmModal();
    }
  }

  showArmModal() {
    const modal = document.getElementById('arm-safety-modal');
    if (modal) {
      modal.classList.add('active');
      const slider = document.getElementById('arm-slide-range');
      if (slider) slider.value = 0;
    }
  }

  closeArmModal() {
    const modal = document.getElementById('arm-safety-modal');
    if (modal) modal.classList.remove('active');
  }

  showAbortModal() {
    const modal = document.getElementById('abort-safety-modal');
    if (modal) modal.classList.add('active');
  }

  closeAbortModal() {
    const modal = document.getElementById('abort-safety-modal');
    if (modal) modal.classList.remove('active');
  }

  initModalSafeguards() {
    // Arm Slider confirmation
    const slider = document.getElementById('arm-slide-range');
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (Number(e.target.value) >= 95) {
          this.closeArmModal();
          this.telemetry.setArmed(true);
        }
      });
      slider.addEventListener('mouseup', (e) => {
        if (Number(e.target.value) < 95) {
          e.target.value = 0;
        }
      });
      slider.addEventListener('touchend', (e) => {
        if (Number(e.target.value) < 95) {
          e.target.value = 0;
        }
      });
    }

    // Close arm modal buttons
    const cancelArmBtn = document.getElementById('btn-cancel-arm');
    if (cancelArmBtn) cancelArmBtn.addEventListener('click', () => this.closeArmModal());

    // Abort actions
    const confirmLandBtn = document.getElementById('btn-abort-land');
    if (confirmLandBtn) {
      confirmLandBtn.addEventListener('click', () => {
        this.closeAbortModal();
        this.telemetry.abortMission();
      });
    }

    const confirmKillBtn = document.getElementById('btn-abort-kill');
    if (confirmKillBtn) {
      confirmKillBtn.addEventListener('click', () => {
        if (confirm('WARNING: Emergency Motor Cut will stop motors instantly! Vehicle will drop. Confirm?')) {
          this.closeAbortModal();
          this.telemetry.emergencyKill();
        }
      });
    }

    const cancelAbortBtn = document.getElementById('btn-cancel-abort');
    if (cancelAbortBtn) cancelAbortBtn.addEventListener('click', () => this.closeAbortModal());
  }

  toggleMissionExecution() {
    if (this.telemetry.state.missionStatus === 'IN_PROGRESS') {
      this.telemetry.pauseMission();
    } else {
      this.telemetry.startMission();
    }
  }

  restartMission() {
    this.telemetry.state.currentWaypointIndex = 0;
    this.telemetry.updateMissionProgress();
    this.telemetry.startMission();
    this.logger.log('MISSION', 'Mission restarted from Waypoint 1.', 'INFO');
  }

  skipWaypoint() {
    if (this.telemetry.state.currentWaypointIndex + 1 < this.telemetry.state.waypoints.length) {
      this.telemetry.state.currentWaypointIndex += 1;
      this.telemetry.updateMissionProgress();
      this.logger.log('MISSION', `Skipped to Waypoint ${this.telemetry.state.currentWaypointIndex + 1}`, 'WARN');
    }
  }

  addWaypointAt(lat, lng) {
    const nextId = this.waypoints.length + 1;
    const newWP = {
      id: nextId,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      alt: 12.0,
      speed: 3.5,
      action: `WAYPOINT ${nextId}`
    };
    this.waypoints.push(newWP);
    this.syncWaypoints();
    this.logger.log('MISSION', `Added Waypoint ${nextId} at [${newWP.lat}, ${newWP.lng}]`, 'INFO');
  }

  removeWaypoint(index) {
    if (this.waypoints.length <= 2) {
      alert('Mission must have at least 2 waypoints.');
      return;
    }
    const removed = this.waypoints.splice(index, 1);
    // Re-index
    this.waypoints.forEach((wp, idx) => { wp.id = idx + 1; });
    this.syncWaypoints();
    this.logger.log('MISSION', `Removed Waypoint ${index + 1}`, 'INFO');
  }

  updateWaypointField(index, field, value) {
    if (this.waypoints[index]) {
      this.waypoints[index][field] = field === 'alt' || field === 'speed' ? Number(value) : value;
      this.syncWaypoints();
    }
  }

  syncWaypoints() {
    this.telemetry.setWaypoints(this.waypoints);
    if (this.map) {
      this.map.renderWaypoints(this.waypoints);
    }
    this.renderWaypointsTable();
  }

  renderWaypointsTable() {
    const container = document.getElementById('waypoints-list-tbody');
    if (!container) return;

    container.innerHTML = this.waypoints.map((wp, idx) => `
      <tr class="${idx === this.telemetry.state.currentWaypointIndex ? 'active-row' : ''}">
        <td><strong>#${wp.id}</strong></td>
        <td>
          <input type="number" step="0.00001" value="${wp.lat}" 
            onchange="window.gcsMission.updateWaypointField(${idx}, 'lat', this.value)" class="table-input coord-input"/>
        </td>
        <td>
          <input type="number" step="0.00001" value="${wp.lng}" 
            onchange="window.gcsMission.updateWaypointField(${idx}, 'lng', this.value)" class="table-input coord-input"/>
        </td>
        <td>
          <input type="number" step="0.5" min="1" max="50" value="${wp.alt}" 
            onchange="window.gcsMission.updateWaypointField(${idx}, 'alt', this.value)" class="table-input num-input"/> m
        </td>
        <td>
          <input type="number" step="0.5" min="1" max="15" value="${wp.speed}" 
            onchange="window.gcsMission.updateWaypointField(${idx}, 'speed', this.value)" class="table-input num-input"/> m/s
        </td>
        <td>
          <select onchange="window.gcsMission.updateWaypointField(${idx}, 'action', this.value)" class="table-select">
            <option value="WAYPOINT" ${wp.action.includes('WAYPOINT') ? 'selected' : ''}>WAYPOINT</option>
            <option value="INSPECT" ${wp.action.includes('INSPECT') ? 'selected' : ''}>INSPECT (3s)</option>
            <option value="SURVEY" ${wp.action.includes('SURVEY') ? 'selected' : ''}>SURVEY</option>
            <option value="RTL" ${wp.action.includes('RTL') ? 'selected' : ''}>RTL / LAND</option>
          </select>
        </td>
        <td>
          <button class="btn-icon-danger" onclick="window.gcsMission.removeWaypoint(${idx})" title="Delete WP">✕</button>
        </td>
      </tr>
    `).join('');
  }

  loadPreset(presetName) {
    const c = this.telemetry.config.arena.center;
    if (presetName === 'perimeter') {
      this.waypoints = [
        { id: 1, lat: c[0] - 0.00015, lng: c[1] - 0.00020, alt: 8.0, speed: 3.0, action: 'WAYPOINT 1' },
        { id: 2, lat: c[0] + 0.00015, lng: c[1] - 0.00020, alt: 10.0, speed: 4.0, action: 'WAYPOINT 2' },
        { id: 3, lat: c[0] + 0.00015, lng: c[1] + 0.00020, alt: 10.0, speed: 4.0, action: 'WAYPOINT 3' },
        { id: 4, lat: c[0] - 0.00015, lng: c[1] + 0.00020, alt: 8.0, speed: 3.5, action: 'WAYPOINT 4' },
        { id: 5, lat: c[0], lng: c[1], alt: 3.0, speed: 2.0, action: 'RTL' }
      ];
    } else if (presetName === 'cross_grid') {
      this.waypoints = [
        { id: 1, lat: c[0] - 0.00015, lng: c[1] - 0.00015, alt: 12.0, speed: 3.5, action: 'GRID 1' },
        { id: 2, lat: c[0] + 0.00015, lng: c[1] + 0.00015, alt: 12.0, speed: 3.5, action: 'GRID 2' },
        { id: 3, lat: c[0] - 0.00015, lng: c[1] + 0.00015, alt: 14.0, speed: 4.0, action: 'GRID 3' },
        { id: 4, lat: c[0] + 0.00015, lng: c[1] - 0.00015, alt: 14.0, speed: 4.0, action: 'GRID 4' },
        { id: 5, lat: c[0], lng: c[1], alt: 4.0, speed: 2.0, action: 'RTL' }
      ];
    } else {
      this.waypoints = JSON.parse(JSON.stringify(this.telemetry.config.defaultWaypoints));
    }

    this.syncWaypoints();
    this.logger.log('MISSION', `Loaded mission preset: ${presetName}`, 'INFO');
  }

  handleMissionFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        let loadedWps = [];

        if (Array.isArray(parsed)) {
          loadedWps = parsed;
        } else if (parsed.waypoints && Array.isArray(parsed.waypoints)) {
          loadedWps = parsed.waypoints;
        } else if (parsed.mission && parsed.mission.items) {
          // QGroundControl .plan format
          loadedWps = parsed.mission.items
            .filter(item => item.type === 'SimpleItem' && item.params && item.params[4] && item.params[5])
            .map((item, idx) => ({
              id: idx + 1,
              lat: item.params[4],
              lng: item.params[5],
              alt: item.params[6] || 10,
              speed: 4.0,
              action: `WP ${idx + 1}`
            }));
        }

        if (loadedWps.length > 0) {
          this.waypoints = loadedWps.map((wp, i) => ({
            id: i + 1,
            lat: Number(wp.lat || wp.latitude),
            lng: Number(wp.lng || wp.longitude),
            alt: Number(wp.alt || wp.altitude || 10),
            speed: Number(wp.speed || 3.5),
            action: wp.action || `WP ${i + 1}`
          }));
          this.syncWaypoints();
          this.logger.log('MISSION', `Successfully uploaded mission file: ${file.name} (${this.waypoints.length} waypoints)`, 'SUCCESS');
          alert(`Successfully uploaded mission: ${this.waypoints.length} waypoints loaded.`);
        } else {
          throw new Error('No valid waypoints identified in file.');
        }
      } catch (err) {
        this.logger.log('MISSION', `Mission upload failed: ${err.message}`, 'ERROR');
        alert('Invalid mission file format. Please upload a valid JSON or QGC .plan file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  exportMission() {
    const exportData = {
      format: 'VEGAPilot-Mission-v2',
      createdAt: new Date().toISOString(),
      arena: this.telemetry.config.arena.name,
      waypointsCount: this.waypoints.length,
      waypoints: this.waypoints
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `vegapilot_mission_${Date.now()}.json`);
    dlAnchorElem.click();
    this.logger.log('MISSION', 'Mission plan exported to JSON file.', 'INFO');
  }
}

if (typeof window !== 'undefined') {
  window.MissionManager = MissionManager;
}
