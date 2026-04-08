const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const dataPaths = require('./dataPaths');
const { CONFIG_TYPES, CORE_TYPES, STREAM_SECURITY } = require('./enums');

let sqlPromise;

function loadSqlModule() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    });
  }
  return sqlPromise;
}

function hasDatabase() {
  const dbPath = dataPaths.getDatabasePath();
  return fs.existsSync(dbPath);
}

async function fetchProfiles() {
  const dbPath = dataPaths.getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    return {
      profiles: [],
      meta: {
        hasDatabase: false,
        dbPath,
        total: 0
      }
    };
  }

  let db;
  try {
    const SQL = await loadSqlModule();
    const fileBuffer = await fs.promises.readFile(dbPath);
    db = new SQL.Database(new Uint8Array(fileBuffer));
    const query = `
      SELECT p.IndexId, p.Remarks, p.Address, p.Port, p.ConfigType, p.CoreType, p.Subid,
             p.Security, p.Network, p.Flow, p.StreamSecurity, p.Sni, p.AllowInsecure,
             p.MuxEnabled, p.DisplayLog, s.Remarks AS SubRemarks
        FROM ProfileItem p
        LEFT JOIN SubItem s ON p.Subid = s.Id
        ORDER BY COALESCE(s.Sort, 0), p.Remarks
    `;
    const rows = [];
    let stmt;
    try {
      stmt = db.prepare(query);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(mapRow(row));
      }
    } finally {
      if (stmt) {
        stmt.free();
      }
    }

    return {
      profiles: rows,
      meta: {
        hasDatabase: true,
        dbPath,
        total: rows.length
      }
    };
  } catch (error) {
    return {
      profiles: [],
      meta: {
        hasDatabase: false,
        dbPath,
        total: 0,
        error: error.message
      }
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.warn('Failed to close SQLite database', closeError);
      }
    }
  }
}

function mapRow(row) {
  return {
    IndexId: row.IndexId,
    Remarks: row.Remarks,
    Address: row.Address,
    Port: row.Port,
    ConfigType: row.ConfigType,
    ConfigTypeName: CONFIG_TYPES[row.ConfigType] ?? `#${row.ConfigType}`,
    CoreType: row.CoreType,
    CoreTypeName: row.CoreType ? (CORE_TYPES[row.CoreType] ?? `#${row.CoreType}`) : 'Auto',
    Subid: row.Subid,
    SubRemarks: row.SubRemarks ?? 'Local',
    Security: row.Security,
    Network: row.Network,
    Flow: row.Flow,
    StreamSecurity: row.StreamSecurity,
    StreamSecurityLabel: row.StreamSecurity ? (STREAM_SECURITY[row.StreamSecurity] ?? row.StreamSecurity) : 'none',
    Sni: row.Sni,
    AllowInsecure: row.AllowInsecure,
    MuxEnabled: row.MuxEnabled,
    DisplayLog: row.DisplayLog
  };
}

module.exports = {
  fetchProfiles,
  hasDatabase
};
