/**
 * VEGAPilot Ground Control - Interactive Tactical Map & Arena Visualizer
 * Professional DJI Pilot 2 Inspired Ground Station Architecture
 * Powered by Leaflet.js and OpenStreetMap / Esri Satellite
 */

class TacticalMap {
  constructor(config, telemetry, missionManager) {
    this.config = config;
    this.telemetry = telemetry;
    this.mission = missionManager;
    this.map = null;
    this.droneMarker = null;
    this.arenaPolygon = null;
    this.waypointMarkers = [];
    this.missionPathLine = null;
    this.flightTrailLine = null;
    this.trailCoords = [];
    this.currentTileLayer = null;
    this.currentLayerKey = 'satellite'; // 'satellite', 'streets', 'osmHot'
    this.followDrone = true;
    this.isArenaMode = false;
    this.addWaypointMode = false;

    this.initMap();
    this.initArenaGrid();
    this.bindEvents();
  }

  initMap() {
    const mapEl = document.getElementById('map-view');
    if (!mapEl || typeof L === 'undefined') return;

    // Initialize Leaflet map with zoom capped at safe levels to eliminate tile errors
    this.map = L.map('map-view', {
      center: this.config.arena.center,
      zoom: 17,
      minZoom: 13,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true
    });

    // Custom positioned zoom control (bottom-right)
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Add Base Tile Layer (Google Satellite Hybrid by default for ultra-sharp aerial view!)
    this.setTileLayer('satellite');

    // Draw Geofence / Arena Boundary Polygon
    this.drawArenaBoundary();

    // Create Drone Marker with dynamic heading arrow / beam
    this.createDroneMarker();

    // Render initial waypoints and flight path
    this.renderWaypoints(this.telemetry.state.waypoints);

    // Flight trail polyline (neon cyan breadcrumb)
    this.flightTrailLine = L.polyline([], {
      color: '#00e5ff',
      weight: 2.5,
      opacity: 0.7,
      dashArray: '4, 6'
    }).addTo(this.map);

    // Map click for adding waypoints
    this.map.on('click', (e) => {
      if (this.addWaypointMode && this.mission) {
        this.mission.addWaypointAt(e.latlng.lat, e.latlng.lng);
      }
    });

    // Invalidate size on resize
    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize();
    });
  }

  setTileLayer(key) {
    if (!this.map) return;
    const provider = this.config.mapProviders[key];
    if (!provider) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    // Google Satellite supports zoom up to 20; Esri supports up to 17/18
    const maxNative = (key === 'satellite') ? 19 : 17;

    this.currentTileLayer = L.tileLayer(provider.url, {
      maxZoom: 18,
      maxNativeZoom: maxNative,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: provider.attribution
    }).addTo(this.map);

    this.currentLayerKey = key;
  }

  drawArenaBoundary() {
    if (!this.map) return;

    if (this.arenaPolygon) {
      this.map.removeLayer(this.arenaPolygon);
    }

    this.arenaPolygon = L.polygon(this.config.arena.boundary, {
      color: '#00e5ff',
      weight: 2,
      opacity: 0.85,
      dashArray: '8, 8',
      fillColor: '#00e5ff',
      fillOpacity: 0.06
    }).addTo(this.map);

    this.arenaPolygon.bindTooltip('NiDAR Competition Arena Geofence', {
      permanent: false,
      direction: 'top',
      className: 'gcs-tooltip'
    });
  }

  updateArenaCenter(lat, lng, radiusMeters = 40) {
    if (!this.map) return;
    const latDelta = radiusMeters / 110800;
    const lngDelta = radiusMeters / 102800;

    const newBoundary = [
      [lat + latDelta, lng - lngDelta],
      [lat + latDelta, lng + lngDelta],
      [lat - latDelta, lng + lngDelta],
      [lat - latDelta, lng - lngDelta]
    ];

    this.config.arena.center = [lat, lng];
    this.config.arena.boundary = newBoundary;

    if (this.arenaPolygon) {
      this.arenaPolygon.setLatLngs(newBoundary);
    }
    this.map.panTo([lat, lng]);
  }

  createDroneMarker() {
    if (!this.map) return;

    // Custom SVG Drone Icon with directional heading beam & animated pulse
    const droneIcon = L.divIcon({
      className: 'drone-leaflet-icon',
      html: `
        <div class="drone-marker-container" id="drone-marker-rotator">
          <div class="drone-heading-beam"></div>
          <div class="drone-pulse-ring"></div>
          <div class="drone-svg-wrapper">
            <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor">
              <!-- Quadcopter Frame -->
              <circle cx="24" cy="24" r="7.5" fill="#0c1626" stroke="#00e5ff" stroke-width="2.2"/>
              <line x1="11" y1="11" x2="37" y2="37" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="37" y1="11" x2="11" y2="37" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round"/>
              <!-- Rotors -->
              <circle cx="11" cy="11" r="5" stroke="#00ffaa" stroke-width="2" fill="rgba(0,255,170,0.25)"/>
              <circle cx="37" cy="11" r="5" stroke="#00ffaa" stroke-width="2" fill="rgba(0,255,170,0.25)"/>
              <circle cx="11" cy="37" r="5" stroke="#00e5ff" stroke-width="2" fill="rgba(0,229,255,0.25)"/>
              <circle cx="37" cy="37" r="5" stroke="#00e5ff" stroke-width="2" fill="rgba(0,229,255,0.25)"/>
              <!-- Forward Heading Arrow -->
              <polygon points="24,9 28,18 20,18" fill="#ffb020"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    this.droneMarker = L.marker(
      [this.telemetry.state.lat, this.telemetry.state.lng],
      { icon: droneIcon, zIndexOffset: 1000 }
    ).addTo(this.map);
  }

  renderWaypoints(waypoints) {
    if (!this.map) return;

    // Clear existing markers
    this.waypointMarkers.forEach(m => this.map.removeLayer(m));
    this.waypointMarkers = [];

    if (this.missionPathLine) {
      this.map.removeLayer(this.missionPathLine);
    }

    const pathCoords = [];

    waypoints.forEach((wp, idx) => {
      pathCoords.push([wp.lat, wp.lng]);

      const isHome = idx === 0 || wp.isHome;
      const isRTL = idx === waypoints.length - 1;

      let badgeContent = idx + 1;
      let badgeClass = 'wp-badge';

      if (isHome) {
        badgeContent = 'H';
        badgeClass += ' wp-home-badge';
      } else if (isRTL) {
        badgeClass += ' wp-rtl-badge';
      }

      if (idx === this.telemetry.state.currentWaypointIndex) {
        badgeClass += ' active-wp';
      }

      const wpIcon = L.divIcon({
        className: 'wp-leaflet-icon',
        html: `
          <div class="wp-marker-wrapper">
            <div class="${badgeClass}">
              <span>${badgeContent}</span>
            </div>
            <div class="wp-alt-pill">${wp.alt}m</div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 20]
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: wpIcon })
        .addTo(this.map)
        .bindTooltip(`<b>${isHome ? 'HOME POINT' : 'WAYPOINT ' + (idx + 1)}</b><br>${wp.alt}m AGL · ${wp.speed} m/s<br>${wp.action}`, {
          direction: 'top',
          className: 'gcs-tooltip'
        });

      this.waypointMarkers.push(marker);
    });

    // DJI-style bright directional mission path line
    this.missionPathLine = L.polyline(pathCoords, {
      color: '#ffb020',
      weight: 3,
      opacity: 0.9,
      dashArray: '6, 8'
    }).addTo(this.map);
  }

  updateVehicleState(state) {
    if (!this.map || !this.droneMarker) return;

    const newPos = [state.lat, state.lng];
    this.droneMarker.setLatLng(newPos);

    // Rotate marker container to vehicle heading
    const rotator = document.getElementById('drone-marker-rotator');
    if (rotator) {
      rotator.style.transform = `rotate(${state.heading}deg)`;
    }

    // Update trail
    if (state.armed && state.groundSpeed > 0.2) {
      this.trailCoords.push(newPos);
      if (this.trailCoords.length > 200) this.trailCoords.shift();
      if (this.flightTrailLine) {
        this.flightTrailLine.setLatLngs(this.trailCoords);
      }
    }

    // Auto-center if follow mode is active
    if (this.followDrone) {
      this.map.panTo(newPos, { animate: true, duration: 0.3 });
    }

    // Highlight current active waypoint
    this.waypointMarkers.forEach((m, idx) => {
      const el = m.getElement();
      if (el) {
        const badge = el.querySelector('.wp-badge');
        if (badge) {
          if (idx === state.currentWaypointIndex) {
            badge.classList.add('active-wp');
          } else {
            badge.classList.remove('active-wp');
          }
        }
      }
    });

    // Also update 2D Arena Grid Drone position
    this.updateArenaGrid(state);
  }

  fitArena() {
    if (!this.map || !this.arenaPolygon) return;
    this.followDrone = false;
    this.updateFollowButton();
    this.map.fitBounds(this.arenaPolygon.getBounds(), { padding: [40, 40] });
  }

  toggleFollow() {
    this.followDrone = !this.followDrone;
    this.updateFollowButton();
    if (this.followDrone && this.droneMarker) {
      this.map.panTo(this.droneMarker.getLatLng(), { animate: true });
    }
  }

  updateFollowButton() {
    const btn = document.getElementById('fab-follow');
    if (btn) {
      btn.classList.toggle('active', this.followDrone);
    }
  }

  toggleArenaView() {
    this.isArenaMode = !this.isArenaMode;
    const mapView = document.getElementById('map-view');
    const arenaView = document.getElementById('arena-grid-view');
    const toggleBtn = document.getElementById('fab-toggle-radar');

    if (this.isArenaMode) {
      if (mapView) mapView.style.display = 'none';
      if (arenaView) arenaView.style.display = 'flex';
      if (toggleBtn) toggleBtn.classList.add('active');
    } else {
      if (mapView) mapView.style.display = 'block';
      if (arenaView) arenaView.style.display = 'none';
      if (toggleBtn) toggleBtn.classList.remove('active');
      if (this.map) this.map.invalidateSize();
    }
  }

  // 2D Synthetic Arena Grid (Alternative View)
  initArenaGrid() {
    const arenaContainer = document.getElementById('arena-grid-view');
    if (!arenaContainer) return;
    this.updateArenaGrid(this.telemetry.state);
  }

  updateArenaGrid(state) {
    const droneEl = document.getElementById('arena-drone-icon');
    const radarHeading = document.getElementById('arena-radar-heading');
    if (!droneEl) return;

    const b = this.config.arena.boundary;
    const minLat = Math.min(...b.map(p => p[0]));
    const maxLat = Math.max(...b.map(p => p[0]));
    const minLng = Math.min(...b.map(p => p[1]));
    const maxLng = Math.max(...b.map(p => p[1]));

    const latPercent = Math.max(5, Math.min(95, ((state.lat - minLat) / (maxLat - minLat)) * 100));
    const lngPercent = Math.max(5, Math.min(95, ((state.lng - minLng) / (maxLng - minLng)) * 100));

    droneEl.style.top = `${100 - latPercent}%`;
    droneEl.style.left = `${lngPercent}%`;
    droneEl.style.transform = `translate(-50%, -50%) rotate(${state.heading}deg)`;

    if (radarHeading) {
      radarHeading.textContent = `${state.heading}° HDG · ${state.alt}m AGL`;
    }
  }

  bindEvents() {
    const fitBtn = document.getElementById('fab-fit-arena');
    if (fitBtn) fitBtn.addEventListener('click', () => this.fitArena());

    const followBtn = document.getElementById('fab-follow');
    if (followBtn) followBtn.addEventListener('click', () => this.toggleFollow());

    const toggleViewBtn = document.getElementById('fab-toggle-radar');
    if (toggleViewBtn) toggleViewBtn.addEventListener('click', () => this.toggleArenaView());

    const layerBtn = document.getElementById('fab-map-layer');
    if (layerBtn) {
      layerBtn.addEventListener('click', () => {
        // Cycle: Google Satellite Hybrid -> Esri City Streets -> Esri World Imagery
        const cycle = ['satellite', 'streets', 'esriSatellite'];
        const nextIdx = (cycle.indexOf(this.currentLayerKey) + 1) % cycle.length;
        this.setTileLayer(cycle[nextIdx]);

        const label = document.getElementById('map-current-layer-label');
        if (label) {
          if (cycle[nextIdx] === 'satellite') label.textContent = '🛰️ Satellite (Hybrid)';
          else if (cycle[nextIdx] === 'streets') label.textContent = '🗺️ City Streets';
          else label.textContent = '🛰️ Esri Satellite';
        }
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.TacticalMap = TacticalMap;
}
