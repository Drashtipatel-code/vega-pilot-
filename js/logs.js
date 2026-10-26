/**
 * VEGAPilot Ground Control - Flight Logger & Event History
 */

class FlightLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 500;
    this.listeners = [];
    this.filterLevel = 'ALL';
    this.searchQuery = '';

    // Initialize with startup event
    this.log('SYSTEM', 'VEGAPilot Ground Control Station v2.4.0 Initialized', 'INFO');
    this.log('COMMS', 'Telemetry receiver bound to 915MHz interface. Link standby.', 'INFO');
    this.log('NAV', 'Loaded NiDAR Competition Arena geofence (Vadodara Zone A)', 'INFO');
  }

  log(subsystem, message, level = 'INFO') {
    const timestamp = new Date();
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      timestamp: timestamp,
      timeStr: timestamp.toTimeString().split(' ')[0] + '.' + String(timestamp.getMilliseconds()).padStart(3, '0'),
      subsystem: subsystem.toUpperCase(),
      message: message,
      level: level.toUpperCase() // INFO, SUCCESS, WARN, ERROR
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.notify();
    return entry;
  }

  getFilteredLogs() {
    return this.logs.filter(entry => {
      const matchesLevel = this.filterLevel === 'ALL' || entry.level === this.filterLevel;
      const matchesSearch = !this.searchQuery || 
        entry.message.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        entry.subsystem.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }

  setFilter(level) {
    this.filterLevel = level;
    this.notify();
  }

  setSearch(query) {
    this.searchQuery = query;
    this.notify();
  }

  clear() {
    this.logs = [];
    this.log('SYSTEM', 'Flight logs cleared by operator.', 'INFO');
  }

  exportCSV() {
    if (this.logs.length === 0) return;
    const headers = ['Timestamp', 'Level', 'Subsystem', 'Message'];
    const rows = this.logs.map(l => [
      `"${l.timestamp.toISOString()}"`,
      `"${l.level}"`,
      `"${l.subsystem}"`,
      `"${l.message.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vegapilot_flightlog_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.logs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `vegapilot_flightlog_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    dlAnchorElem.click();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getFilteredLogs());
  }

  notify() {
    const filtered = this.getFilteredLogs();
    this.listeners.forEach(cb => cb(filtered));
  }
}

if (typeof window !== 'undefined') {
  window.FlightLogger = FlightLogger;
}
