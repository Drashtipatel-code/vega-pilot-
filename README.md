# VEGAPilot Ground Control Station (GCS)
**NiDAR Competition · Autonomous Drone Mission & Ground Control Dashboard**

A high-performance, crystal-clean web dashboard built for real-time UAV telemetry monitoring, OpenStreetMap tactical tracking, autonomous mission planning, and failsafe safety supervision.

---

## 🚀 Key Features

### 1. Battery & Power Monitoring
- **Real-time State of Charge (SoC)**: Dynamic battery percentage display with color-coded safety levels.
- **Voltage & Current**: Total pack voltage (6S LiPo: 21.0V – 25.2V), per-cell voltage (~4.02V/cell), instantaneous current draw (A), and power consumption (W).
- **Failsafe Warnings**: Audio-visual alert banner upon reaching Low Battery (25%) or Critical Emergency RTL (15%).

### 2. Live Positioning & Tactical OpenStreetMap
- **Real OpenStreetMap Integration**: High-resolution OpenStreetMap layers with Dark Tactical, Standard Streets, and Satellite Imagery modes powered by Leaflet.js.
- **Arena Geofence**: Visualized safety boundary box matching the NiDAR Competition Arena (Vadodara Zone A).
- **Dynamic Drone Marker**: SVG quadcopter icon with real-time heading rotation and directional field-of-view sensor beam.
- **Dual View**: Toggle between the **Real Map** and a **2D Synthetic Arena Grid** radar view at any time.
- **Telemetry HUD**: Latitude, Longitude, Altitude AGL (Above Ground Level), Altitude MSL, Ground Speed (m/s & km/h), Vertical Climb Rate, and 3D DGPS / RTK Fix with Satellites and HDOP.

### 3. Flight Mode & Arming Safeguards
- **Flight Modes**: Instant switching between `AUTO`, `GUIDED`, `LOITER`, `RTL`, `LAND`, and `MANUAL`.
- **Safety Arming Slide**: Slide-to-arm safeguard prevents accidental motor spin-up.
- **Disarm Control**: Single-click safe disarm with operator confirmation.

### 4. Mission Monitoring & Waypoint Planner
- **Progress Tracking**: Active waypoint index (`2 / 5`), distance to next target, estimated time of arrival (ETA), and progress bar.
- **Interactive Waypoint Editor**: Add, remove, and adjust coordinates, altitudes, and speeds directly from the table or by clicking on the map.
- **Upload & Export**: Upload QGroundControl `.plan` or JSON mission files, or export current missions with one click.
- **Presets**: Quick-load predefined flight patterns (Default 5-Point, Perimeter Boundary Scan, Cross Grid).

### 5. Communication & Failsafe Monitoring
- **Link Quality**: Live RSSI signal strength (%), telemetry latency (ms), RF frequency (915 MHz), and MAVLink 2.0 packet counters.
- **Watchdogs**: Continuous monitoring for Telemetry Link Loss, Geofence Breaches, and Battery depletion.
- **Emergency Abort Safeguard**: Choose between controlled `LAND NOW` or immediate `EMERGENCY MOTOR CUT`.
- **Return-to-Home (RTL)**: Dedicated instant trigger with safe transit altitude.

### 6. Event History & Flight Logs
- **Event Audit Trail**: Timestamped logs categorized by `INFO`, `SUCCESS`, `WARN`, and `ERROR`.
- **Search & Filters**: Real-time keyword filter and level tabs.
- **Export for Post-Flight Analysis**: Export logs to `.csv` or `.json` with one click.

---

## 📁 Project Structure

```
drashti_project/
├── index.html            # Main GCS dashboard layout and HUD
├── vercel.json           # Ready-to-deploy Vercel configuration
├── README.md             # Documentation & deployment guide
├── css/
│   └── styles.css        # Aerospace dark tactical glassmorphic design system
└── js/
    ├── config.js         # Arena coordinates, default waypoints, and safety limits
    ├── logs.js           # Flight event logger & CSV/JSON exporter
    ├── telemetry.js      # Vehicle state simulation & telemetry physics engine
    ├── map.js            # Leaflet OpenStreetMap tactical arena visualizer
    ├── mission.js        # Mission planner, waypoint manager, arming & abort controls
    └── app.js            # App coordinator, audio alert synthesizer, and HUD updates
```

---

## 💻 How to Run Locally

### Option 1: Direct Browser
Simply double-click `index.html` to open it in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Server (Recommended)
You can serve it with Python, Node.js, or VS Code Live Server:

```bash
# Using Python
python -m http.server 3000

# Using Node.js (npx serve)
npx serve .
```
Then visit `http://localhost:3000` in your browser.

---

## ☁️ How to Deploy to Vercel

### Method A: Via Vercel CLI (Fastest)
1. Open PowerShell or Terminal in this folder:
   ```bash
   cd "D:\micro tool\drashti_project"
   ```
2. Run:
   ```bash
   npx vercel
   ```
3. Follow the simple prompts (accept default settings). Your site will be live instantly with a free HTTPS URL!

### Method B: Via GitHub & Vercel Web Dashboard
1. Initialize a git repository and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of VEGAPilot GCS"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New Project** → Select your GitHub repository.
4. Framework Preset: **Other** (leave Root Directory as `./`).
5. Click **Deploy**. Vercel will host your Ground Control Station automatically!
