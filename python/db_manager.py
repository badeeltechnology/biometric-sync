"""
Database Manager - SQLite operations for local data storage.
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path


class DatabaseManager:
    def __init__(self, db_path=None):
        if db_path is None:
            # Use app data directory
            app_data = Path.home() / '.biometric-sync'
            app_data.mkdir(exist_ok=True)
            db_path = app_data / 'database.sqlite'

        self.db_path = str(db_path)
        self.conn = None

    def get_connection(self):
        """Get database connection."""
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
        return self.conn

    def initialize(self):
        """Initialize database schema."""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Create tables
        cursor.executescript('''
            -- Devices table
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ip TEXT NOT NULL,
                port INTEGER DEFAULT 4370,
                punch_direction TEXT,
                latitude REAL,
                longitude REAL,
                enabled INTEGER DEFAULT 1,
                status TEXT DEFAULT 'offline',
                last_sync DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Attendance logs (local cache)
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id INTEGER,
                user_id TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                punch_type INTEGER DEFAULT 0,
                synced INTEGER DEFAULT 0,
                synced_at DATETIME,
                erpnext_response TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id),
                UNIQUE(device_id, user_id, timestamp)
            );

            -- Sync history
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id INTEGER,
                started_at DATETIME NOT NULL,
                completed_at DATETIME,
                records_fetched INTEGER DEFAULT 0,
                records_synced INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                status TEXT DEFAULT 'running',
                error_message TEXT,
                FOREIGN KEY (device_id) REFERENCES devices(id)
            );

            -- Configuration
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            -- Shifts
            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                erpnext_shift_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Device-Shift mapping
            CREATE TABLE IF NOT EXISTS device_shifts (
                device_id INTEGER,
                shift_id INTEGER,
                PRIMARY KEY (device_id, shift_id),
                FOREIGN KEY (device_id) REFERENCES devices(id),
                FOREIGN KEY (shift_id) REFERENCES shifts(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_attendance_device ON attendance_logs(device_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance_logs(synced);
            CREATE INDEX IF NOT EXISTS idx_sync_history_device ON sync_history(device_id);
        ''')

        conn.commit()
        return {'status': 'initialized'}

    def _row_to_dict(self, row):
        """Convert sqlite3.Row to dictionary."""
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows):
        """Convert list of sqlite3.Row to list of dictionaries."""
        return [self._row_to_dict(row) for row in rows]

    # Device operations
    def get_devices(self):
        """Get all devices."""
        cursor = self.get_connection().cursor()
        cursor.execute('SELECT * FROM devices ORDER BY created_at DESC')
        return self._rows_to_list(cursor.fetchall())

    def add_device(self, data):
        """Add a new device."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO devices (name, ip, port, punch_direction, latitude, longitude, enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'],
            data['ip'],
            data.get('port', 4370),
            data.get('punch_direction'),
            data.get('latitude'),
            data.get('longitude'),
            1 if data.get('enabled', True) else 0
        ))
        conn.commit()
        return {'id': cursor.lastrowid}

    def update_device(self, data):
        """Update an existing device."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET name = ?, ip = ?, port = ?, punch_direction = ?,
                latitude = ?, longitude = ?, enabled = ?
            WHERE id = ?
        ''', (
            data['name'],
            data['ip'],
            data.get('port', 4370),
            data.get('punch_direction'),
            data.get('latitude'),
            data.get('longitude'),
            1 if data.get('enabled', True) else 0,
            data['id']
        ))
        conn.commit()
        return {'updated': cursor.rowcount}

    def delete_device(self, device_id):
        """Delete a device."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM devices WHERE id = ?', (device_id,))
        conn.commit()
        return {'deleted': cursor.rowcount}

    def update_device_status(self, device_id, status, last_sync=None):
        """Update device status and last sync time."""
        conn = self.get_connection()
        cursor = conn.cursor()
        if last_sync:
            cursor.execute(
                'UPDATE devices SET status = ?, last_sync = ? WHERE id = ?',
                (status, last_sync, device_id)
            )
        else:
            cursor.execute(
                'UPDATE devices SET status = ? WHERE id = ?',
                (status, device_id)
            )
        conn.commit()

    # Shift operations
    def get_shifts(self):
        """Get all shifts with device mappings."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM shifts ORDER BY created_at DESC')
        shifts = self._rows_to_list(cursor.fetchall())

        # Get device mappings for each shift
        for shift in shifts:
            cursor.execute(
                'SELECT device_id FROM device_shifts WHERE shift_id = ?',
                (shift['id'],)
            )
            shift['device_ids'] = [row['device_id'] for row in cursor.fetchall()]

        return shifts

    def add_shift(self, data):
        """Add a new shift."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO shifts (name, start_time, end_time, erpnext_shift_type)
            VALUES (?, ?, ?, ?)
        ''', (
            data['name'],
            data.get('start_time'),
            data.get('end_time'),
            data.get('erpnext_shift_type')
        ))
        shift_id = cursor.lastrowid

        # Add device mappings
        device_ids = data.get('device_ids', [])
        for device_id in device_ids:
            cursor.execute(
                'INSERT OR IGNORE INTO device_shifts (device_id, shift_id) VALUES (?, ?)',
                (device_id, shift_id)
            )

        conn.commit()
        return {'id': shift_id}

    def update_shift(self, data):
        """Update an existing shift."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE shifts
            SET name = ?, start_time = ?, end_time = ?, erpnext_shift_type = ?
            WHERE id = ?
        ''', (
            data['name'],
            data.get('start_time'),
            data.get('end_time'),
            data.get('erpnext_shift_type'),
            data['id']
        ))

        # Update device mappings
        cursor.execute('DELETE FROM device_shifts WHERE shift_id = ?', (data['id'],))
        device_ids = data.get('device_ids', [])
        for device_id in device_ids:
            cursor.execute(
                'INSERT INTO device_shifts (device_id, shift_id) VALUES (?, ?)',
                (device_id, data['id'])
            )

        conn.commit()
        return {'updated': cursor.rowcount}

    def delete_shift(self, shift_id):
        """Delete a shift."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM device_shifts WHERE shift_id = ?', (shift_id,))
        cursor.execute('DELETE FROM shifts WHERE id = ?', (shift_id,))
        conn.commit()
        return {'deleted': cursor.rowcount}

    # Attendance log operations
    def add_attendance_log(self, device_id, user_id, timestamp, punch_type=0):
        """Add an attendance log entry."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO attendance_logs (device_id, user_id, timestamp, punch_type)
                VALUES (?, ?, ?, ?)
            ''', (device_id, user_id, timestamp, punch_type))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None  # Duplicate entry

    def update_attendance_synced(self, log_id, response=None):
        """Mark attendance log as synced."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE attendance_logs
            SET synced = 1, synced_at = ?, erpnext_response = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), json.dumps(response) if response else None, log_id))
        conn.commit()

    def get_attendance_logs(self, page=1, limit=20, search=None, status=None,
                            device_id=None, date_from=None, date_to=None):
        """Get attendance logs with filters."""
        conn = self.get_connection()
        cursor = conn.cursor()

        query = 'SELECT * FROM attendance_logs WHERE 1=1'
        params = []

        if search:
            query += ' AND user_id LIKE ?'
            params.append(f'%{search}%')

        if status == 'synced':
            query += ' AND synced = 1'
        elif status == 'pending':
            query += ' AND synced = 0'

        if device_id:
            query += ' AND device_id = ?'
            params.append(device_id)

        if date_from:
            query += ' AND DATE(timestamp) >= ?'
            params.append(date_from)

        if date_to:
            query += ' AND DATE(timestamp) <= ?'
            params.append(date_to)

        # Get total count
        count_query = query.replace('SELECT *', 'SELECT COUNT(*)')
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Add pagination
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, (page - 1) * limit])

        cursor.execute(query, params)
        logs = self._rows_to_list(cursor.fetchall())

        return {'logs': logs, 'total': total}

    def get_unsynced_logs(self, device_id=None):
        """Get unsynced attendance logs."""
        conn = self.get_connection()
        cursor = conn.cursor()

        if device_id:
            cursor.execute(
                'SELECT * FROM attendance_logs WHERE synced = 0 AND device_id = ? ORDER BY timestamp',
                (device_id,)
            )
        else:
            cursor.execute(
                'SELECT * FROM attendance_logs WHERE synced = 0 ORDER BY timestamp'
            )

        return self._rows_to_list(cursor.fetchall())

    # Sync history operations
    def create_sync_history(self, device_id):
        """Create a new sync history entry."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sync_history (device_id, started_at)
            VALUES (?, ?)
        ''', (device_id, datetime.now().isoformat()))
        conn.commit()
        return cursor.lastrowid

    def update_sync_history(self, history_id, records_fetched=0, records_synced=0,
                            records_failed=0, status='success', error_message=None):
        """Update sync history entry."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE sync_history
            SET completed_at = ?, records_fetched = ?, records_synced = ?,
                records_failed = ?, status = ?, error_message = ?
            WHERE id = ?
        ''', (
            datetime.now().isoformat(),
            records_fetched,
            records_synced,
            records_failed,
            status,
            error_message,
            history_id
        ))
        conn.commit()

    def get_sync_history(self, page=1, limit=20):
        """Get sync history."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM sync_history
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, (page - 1) * limit))
        return self._rows_to_list(cursor.fetchall())

    # Config operations
    def save_config(self, key, value):
        """Save configuration value."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO config (key, value)
            VALUES (?, ?)
        ''', (key, json.dumps(value) if not isinstance(value, str) else value))
        conn.commit()
        return {'saved': True}

    def get_config(self, key):
        """Get configuration value."""
        cursor = self.get_connection().cursor()
        cursor.execute('SELECT value FROM config WHERE key = ?', (key,))
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row['value'])
            except (json.JSONDecodeError, TypeError):
                return row['value']
        return None

    def get_today_synced_count(self):
        """Get count of records synced today."""
        cursor = self.get_connection().cursor()
        cursor.execute('''
            SELECT COUNT(*) FROM attendance_logs
            WHERE synced = 1 AND DATE(synced_at) = DATE('now')
        ''')
        return cursor.fetchone()[0]

    def get_pending_count(self):
        """Get count of pending (unsynced) records."""
        cursor = self.get_connection().cursor()
        cursor.execute('SELECT COUNT(*) FROM attendance_logs WHERE synced = 0')
        return cursor.fetchone()[0]
