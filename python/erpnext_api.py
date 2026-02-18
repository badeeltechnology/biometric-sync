"""
ERPNext API - Communication with ERPNext/HRMS.
"""

import requests
from datetime import datetime


class ERPNextAPI:
    def __init__(self):
        self.url = None
        self.api_key = None
        self.api_secret = None
        self.version = 15

    def configure(self, url, api_key, api_secret, version=15):
        """Configure ERPNext connection settings."""
        self.url = url.rstrip('/')
        self.api_key = api_key
        self.api_secret = api_secret
        self.version = version

    def _get_headers(self):
        """Get request headers with authentication."""
        return {
            'Authorization': f'token {self.api_key}:{self.api_secret}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def _get_checkin_endpoint(self):
        """Get the correct endpoint based on ERPNext version."""
        if self.version >= 14:
            # Version 14+ uses HRMS app
            return '/api/method/hrms.hr.doctype.employee_checkin.employee_checkin.add_log_based_on_employee_field'
        else:
            # Older versions use ERPNext
            return '/api/method/erpnext.hr.doctype.employee_checkin.employee_checkin.add_log_based_on_employee_field'

    def test_connection(self, url, api_key, api_secret, version=15):
        """Test connection to ERPNext."""
        self.configure(url, api_key, api_secret, version)

        try:
            # Test with a simple API call
            response = requests.get(
                f'{self.url}/api/method/frappe.auth.get_logged_user',
                headers=self._get_headers(),
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'user': data.get('message'),
                    'site_name': self.url
                }
            elif response.status_code == 401:
                raise Exception('Invalid API credentials')
            elif response.status_code == 403:
                raise Exception('Access denied - check user permissions')
            else:
                raise Exception(f'Server error: {response.status_code}')

        except requests.exceptions.ConnectionError:
            raise Exception('Could not connect to server')
        except requests.exceptions.Timeout:
            raise Exception('Connection timeout')
        except Exception as e:
            if 'Invalid API credentials' in str(e) or 'Access denied' in str(e):
                raise
            raise Exception(f'Connection failed: {str(e)}')

    def push_checkin(self, employee_field_value, timestamp, device_id=None,
                     log_type=None, latitude=None, longitude=None):
        """
        Push a check-in record to ERPNext.

        Args:
            employee_field_value: The employee ID from biometric device
            timestamp: Check-in timestamp
            device_id: Device identifier
            log_type: 'IN' or 'OUT' (optional)
            latitude: Location latitude (optional)
            longitude: Location longitude (optional)

        Returns:
            dict with success status and response data
        """
        if not self.url or not self.api_key:
            raise Exception('ERPNext not configured')

        endpoint = self._get_checkin_endpoint()

        payload = {
            'employee_field_value': str(employee_field_value),
            'timestamp': timestamp if isinstance(timestamp, str) else timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'device_id': device_id or 'biometric-sync'
        }

        if log_type:
            payload['log_type'] = log_type

        if latitude is not None and longitude is not None:
            payload['latitude'] = latitude
            payload['longitude'] = longitude

        try:
            response = requests.post(
                f'{self.url}{endpoint}',
                headers=self._get_headers(),
                json=payload,
                timeout=30
            )

            data = response.json()

            if response.status_code == 200:
                return {
                    'success': True,
                    'message': data.get('message'),
                    'name': data.get('message', {}).get('name') if isinstance(data.get('message'), dict) else None
                }
            else:
                error_message = data.get('exc_type', '') or data.get('message', '') or str(data)

                # Check for allowable exceptions
                allowable_errors = [
                    'No Employee found',
                    'This employee is Inactive',
                    'already checked in',
                    'Duplicate'
                ]

                is_allowable = any(err.lower() in error_message.lower() for err in allowable_errors)

                if is_allowable:
                    return {
                        'success': False,
                        'skipped': True,
                        'message': error_message
                    }

                raise Exception(error_message)

        except requests.exceptions.RequestException as e:
            raise Exception(f'Request failed: {str(e)}')

    def get_shifts(self):
        """Get all shift types from ERPNext."""
        if not self.url or not self.api_key:
            raise Exception('ERPNext not configured')

        try:
            response = requests.get(
                f'{self.url}/api/resource/Shift Type',
                headers=self._get_headers(),
                params={'fields': '["name", "start_time", "end_time"]'},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                return data.get('data', [])
            else:
                raise Exception(f'Failed to get shifts: {response.status_code}')

        except requests.exceptions.RequestException as e:
            raise Exception(f'Request failed: {str(e)}')

    def update_shift_last_sync(self, shift_type, last_sync_timestamp):
        """Update the last sync timestamp for a shift type."""
        if not self.url or not self.api_key:
            raise Exception('ERPNext not configured')

        try:
            response = requests.put(
                f'{self.url}/api/resource/Shift Type/{shift_type}',
                headers=self._get_headers(),
                json={'last_sync_of_checkin': last_sync_timestamp},
                timeout=10
            )

            if response.status_code == 200:
                return {'success': True}
            else:
                raise Exception(f'Failed to update shift: {response.status_code}')

        except requests.exceptions.RequestException as e:
            raise Exception(f'Request failed: {str(e)}')

    def get_employees(self, filters=None):
        """Get employees from ERPNext."""
        if not self.url or not self.api_key:
            raise Exception('ERPNext not configured')

        try:
            params = {
                'fields': '["name", "employee_name", "attendance_device_id", "status"]',
                'filters': filters or '[]'
            }

            response = requests.get(
                f'{self.url}/api/resource/Employee',
                headers=self._get_headers(),
                params=params,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                return data.get('data', [])
            else:
                raise Exception(f'Failed to get employees: {response.status_code}')

        except requests.exceptions.RequestException as e:
            raise Exception(f'Request failed: {str(e)}')
