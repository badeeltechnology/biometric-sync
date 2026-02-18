"""
Sync Engine - Orchestrates the sync process between devices and ERPNext.
"""

from datetime import datetime
import traceback


class SyncEngine:
    def __init__(self, db, zk_service, erpnext_api):
        self.db = db
        self.zk_service = zk_service
        self.erpnext_api = erpnext_api
        self.is_running = False
        self.current_progress = 0
        self.last_sync = None
        self.last_error = None

    def get_status(self):
        """Get current sync status."""
        return {
            'is_running': self.is_running,
            'progress': self.current_progress,
            'last_sync': self.last_sync,
            'last_error': self.last_error,
            'today_synced': self.db.get_today_synced_count(),
            'pending_records': self.db.get_pending_count()
        }

    def run_sync(self):
        """Run sync for all enabled devices."""
        if self.is_running:
            return {'status': 'already_running'}

        self.is_running = True
        self.current_progress = 0
        self.last_error = None

        total_fetched = 0
        total_synced = 0
        total_failed = 0
        device_results = []

        try:
            # Get enabled devices
            devices = [d for d in self.db.get_devices() if d.get('enabled', True)]

            if not devices:
                return {
                    'status': 'no_devices',
                    'message': 'No enabled devices found'
                }

            # Get ERPNext config
            config = self.db.get_config('erpnext')
            if not config:
                raise Exception('ERPNext not configured')

            self.erpnext_api.configure(
                config.get('url'),
                config.get('apiKey'),
                config.get('apiSecret'),
                config.get('version', 15)
            )

            # Process each device
            for index, device in enumerate(devices):
                device_result = self._sync_device(device)
                device_results.append(device_result)

                total_fetched += device_result.get('records_fetched', 0)
                total_synced += device_result.get('records_synced', 0)
                total_failed += device_result.get('records_failed', 0)

                # Update progress
                self.current_progress = int(((index + 1) / len(devices)) * 100)

            self.last_sync = datetime.now().isoformat()

            return {
                'status': 'success',
                'devices_processed': len(devices),
                'records_fetched': total_fetched,
                'records_synced': total_synced,
                'records_failed': total_failed,
                'device_results': device_results
            }

        except Exception as e:
            self.last_error = str(e)
            return {
                'status': 'error',
                'message': str(e),
                'traceback': traceback.format_exc()
            }

        finally:
            self.is_running = False
            self.current_progress = 100

    def _sync_device(self, device):
        """Sync a single device."""
        device_id = device['id']
        history_id = self.db.create_sync_history(device_id)

        records_fetched = 0
        records_synced = 0
        records_failed = 0
        error_message = None

        try:
            # Update device status
            self.db.update_device_status(device_id, 'syncing')

            # Fetch attendance from device
            attendance_records = self.zk_service.get_attendance(
                device['ip'],
                device.get('port', 4370)
            )

            records_fetched = len(attendance_records)

            # Store and sync each record
            for record in attendance_records:
                try:
                    # Store in local database
                    log_id = self.db.add_attendance_log(
                        device_id=device_id,
                        user_id=record['user_id'],
                        timestamp=record['timestamp'],
                        punch_type=record.get('punch_type', 0)
                    )

                    if log_id is None:
                        # Duplicate record, skip
                        continue

                    # Determine log type
                    log_type = None
                    punch_direction = device.get('punch_direction')
                    if punch_direction == 'IN':
                        log_type = 'IN'
                    elif punch_direction == 'OUT':
                        log_type = 'OUT'
                    # If AUTO or None, let ERPNext decide

                    # Push to ERPNext
                    result = self.erpnext_api.push_checkin(
                        employee_field_value=record['user_id'],
                        timestamp=record['timestamp'],
                        device_id=device.get('name', str(device_id)),
                        log_type=log_type,
                        latitude=device.get('latitude'),
                        longitude=device.get('longitude')
                    )

                    if result.get('success') or result.get('skipped'):
                        self.db.update_attendance_synced(log_id, result)
                        records_synced += 1
                    else:
                        records_failed += 1

                except Exception as e:
                    records_failed += 1

            # Update device status
            self.db.update_device_status(device_id, 'online', datetime.now().isoformat())

            status = 'success' if records_failed == 0 else 'partial'

        except Exception as e:
            error_message = str(e)
            status = 'failed'
            self.db.update_device_status(device_id, 'offline')

        # Update sync history
        self.db.update_sync_history(
            history_id,
            records_fetched=records_fetched,
            records_synced=records_synced,
            records_failed=records_failed,
            status=status,
            error_message=error_message
        )

        return {
            'device_id': device_id,
            'device_name': device.get('name'),
            'status': status,
            'records_fetched': records_fetched,
            'records_synced': records_synced,
            'records_failed': records_failed,
            'error': error_message
        }

    def sync_pending_records(self):
        """Sync any pending (unsynced) records to ERPNext."""
        if self.is_running:
            return {'status': 'sync_in_progress'}

        self.is_running = True

        try:
            # Get ERPNext config
            config = self.db.get_config('erpnext')
            if not config:
                raise Exception('ERPNext not configured')

            self.erpnext_api.configure(
                config.get('url'),
                config.get('apiKey'),
                config.get('apiSecret'),
                config.get('version', 15)
            )

            # Get unsynced records
            pending_logs = self.db.get_unsynced_logs()
            synced = 0
            failed = 0

            for log in pending_logs:
                try:
                    # Get device info for this log
                    devices = self.db.get_devices()
                    device = next((d for d in devices if d['id'] == log['device_id']), None)

                    log_type = None
                    latitude = None
                    longitude = None

                    if device:
                        punch_direction = device.get('punch_direction')
                        if punch_direction == 'IN':
                            log_type = 'IN'
                        elif punch_direction == 'OUT':
                            log_type = 'OUT'
                        latitude = device.get('latitude')
                        longitude = device.get('longitude')

                    result = self.erpnext_api.push_checkin(
                        employee_field_value=log['user_id'],
                        timestamp=log['timestamp'],
                        device_id=device.get('name') if device else str(log['device_id']),
                        log_type=log_type,
                        latitude=latitude,
                        longitude=longitude
                    )

                    if result.get('success') or result.get('skipped'):
                        self.db.update_attendance_synced(log['id'], result)
                        synced += 1
                    else:
                        failed += 1

                except Exception as e:
                    failed += 1

            return {
                'status': 'success',
                'synced': synced,
                'failed': failed
            }

        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }

        finally:
            self.is_running = False
