"""
ZK Service - Communication with ZKTeco biometric devices.
"""

from zk import ZK
from datetime import datetime
import socket


class ZKService:
    def __init__(self):
        self.connections = {}

    def test_connection(self, ip, port=4370, timeout=5):
        """Test connection to a ZK device."""
        zk = ZK(ip, port=port, timeout=timeout)
        conn = None

        try:
            conn = zk.connect()
            conn.disable_device()

            # Get device info
            users = conn.get_users()
            firmware = conn.get_firmware_version()
            serial = conn.get_serialnumber()

            conn.enable_device()

            return {
                'success': True,
                'user_count': len(users) if users else 0,
                'firmware': firmware,
                'serial': serial
            }
        except socket.timeout:
            raise Exception('Connection timeout - device not reachable')
        except Exception as e:
            raise Exception(f'Connection failed: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

    def connect(self, ip, port=4370, timeout=10):
        """Connect to a ZK device."""
        key = f'{ip}:{port}'
        if key in self.connections:
            return self.connections[key]

        zk = ZK(ip, port=port, timeout=timeout)
        try:
            conn = zk.connect()
            self.connections[key] = conn
            return conn
        except Exception as e:
            raise Exception(f'Failed to connect to device {ip}:{port}: {str(e)}')

    def disconnect(self, ip, port=4370):
        """Disconnect from a ZK device."""
        key = f'{ip}:{port}'
        if key in self.connections:
            try:
                self.connections[key].disconnect()
            except:
                pass
            del self.connections[key]

    def disconnect_all(self):
        """Disconnect from all devices."""
        for key in list(self.connections.keys()):
            try:
                self.connections[key].disconnect()
            except:
                pass
        self.connections.clear()

    def get_attendance(self, ip, port=4370, clear_after_fetch=False):
        """
        Get attendance records from a ZK device.

        Returns list of attendance records:
        [
            {
                'user_id': '1',
                'timestamp': '2024-01-15 09:30:00',
                'punch_type': 0,  # 0=Check In, 1=Check Out
                'status': 1
            },
            ...
        ]
        """
        zk = ZK(ip, port=port, timeout=30)
        conn = None

        try:
            conn = zk.connect()
            conn.disable_device()

            # Get attendance records
            attendance = conn.get_attendance()

            records = []
            if attendance:
                for record in attendance:
                    records.append({
                        'user_id': str(record.user_id),
                        'timestamp': record.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        'punch_type': record.punch if hasattr(record, 'punch') else 0,
                        'status': record.status if hasattr(record, 'status') else 1
                    })

            # Optionally clear attendance after fetching
            if clear_after_fetch and records:
                conn.clear_attendance()

            conn.enable_device()

            return records

        except socket.timeout:
            raise Exception('Connection timeout while fetching attendance')
        except Exception as e:
            raise Exception(f'Failed to get attendance: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

    def get_users(self, ip, port=4370):
        """Get all users from a ZK device."""
        zk = ZK(ip, port=port, timeout=30)
        conn = None

        try:
            conn = zk.connect()
            conn.disable_device()

            users = conn.get_users()

            result = []
            if users:
                for user in users:
                    result.append({
                        'uid': user.uid,
                        'user_id': user.user_id,
                        'name': user.name,
                        'privilege': user.privilege,
                        'card': user.card if hasattr(user, 'card') else None
                    })

            conn.enable_device()

            return result

        except Exception as e:
            raise Exception(f'Failed to get users: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

    def get_device_info(self, ip, port=4370):
        """Get device information."""
        zk = ZK(ip, port=port, timeout=10)
        conn = None

        try:
            conn = zk.connect()

            info = {
                'firmware': conn.get_firmware_version(),
                'serial': conn.get_serialnumber(),
                'platform': conn.get_platform() if hasattr(conn, 'get_platform') else None,
                'device_name': conn.get_device_name() if hasattr(conn, 'get_device_name') else None,
                'mac': conn.get_mac() if hasattr(conn, 'get_mac') else None
            }

            return info

        except Exception as e:
            raise Exception(f'Failed to get device info: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

    def set_device_time(self, ip, port=4370, new_time=None):
        """Set device time. If new_time is None, sets to current system time."""
        zk = ZK(ip, port=port, timeout=10)
        conn = None

        try:
            conn = zk.connect()
            conn.disable_device()

            if new_time is None:
                new_time = datetime.now()

            conn.set_time(new_time)
            conn.enable_device()

            return {'success': True, 'time_set': new_time.strftime('%Y-%m-%d %H:%M:%S')}

        except Exception as e:
            raise Exception(f'Failed to set device time: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

    def clear_attendance(self, ip, port=4370):
        """Clear all attendance records from device."""
        zk = ZK(ip, port=port, timeout=30)
        conn = None

        try:
            conn = zk.connect()
            conn.disable_device()
            conn.clear_attendance()
            conn.enable_device()

            return {'success': True, 'message': 'Attendance records cleared'}

        except Exception as e:
            raise Exception(f'Failed to clear attendance: {str(e)}')
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass
