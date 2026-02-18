#!/usr/bin/env python3
"""
Main entry point for Python backend.
Handles JSON-RPC style communication with Electron.
"""

import sys
import os
import json
import traceback

# Add the script directory to Python path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Initialize services lazily to catch import errors properly
db = None
zk_service = None
erpnext_api = None
sync_engine = None
export_service = None
_init_error = None


def _initialize_services():
    """Initialize all services. Called lazily."""
    global db, zk_service, erpnext_api, sync_engine, export_service, _init_error

    if _init_error:
        raise _init_error

    if db is not None:
        return  # Already initialized

    try:
        from db_manager import DatabaseManager
        from zk_service import ZKService
        from erpnext_api import ERPNextAPI
        from sync_engine import SyncEngine
        from export_service import ExportService

        db = DatabaseManager()
        zk_service = ZKService()
        erpnext_api = ERPNextAPI()
        sync_engine = SyncEngine(db, zk_service, erpnext_api)
        export_service = ExportService(db)
    except ImportError as e:
        _init_error = ImportError(f"Failed to import required module: {e}. Please run: pip install -r requirements.txt")
        raise _init_error
    except Exception as e:
        _init_error = e
        raise


def handle_request(request):
    """Process a JSON-RPC request and return response."""
    method = request.get('method')
    params = request.get('params', {})
    request_id = request.get('id')

    try:
        result = dispatch_method(method, params)
        return {'result': result, 'id': request_id}
    except Exception as e:
        return {
            'error': {
                'code': -1,
                'message': str(e),
                'traceback': traceback.format_exc()
            },
            'id': request_id
        }


def dispatch_method(method, params):
    """Dispatch method to appropriate handler."""
    # Initialize services on first call
    _initialize_services()

    handlers = {
        # Initialization
        'initialize': lambda p: db.initialize(),

        # Device operations
        'get_devices': lambda p: db.get_devices(),
        'add_device': lambda p: db.add_device(p),
        'update_device': lambda p: db.update_device(p),
        'delete_device': lambda p: db.delete_device(p['id']),
        'test_device_connection': lambda p: zk_service.test_connection(p['ip'], p.get('port', 4370)),

        # Shift operations
        'get_shifts': lambda p: db.get_shifts(),
        'add_shift': lambda p: db.add_shift(p),
        'update_shift': lambda p: db.update_shift(p),
        'delete_shift': lambda p: db.delete_shift(p['id']),

        # Sync operations
        'run_sync': lambda p: sync_engine.run_sync(),
        'get_sync_status': lambda p: sync_engine.get_status(),
        'get_sync_history': lambda p: db.get_sync_history(p.get('page', 1), p.get('limit', 20)),
        'get_attendance_logs': lambda p: db.get_attendance_logs(
            page=p.get('page', 1),
            limit=p.get('limit', 20),
            search=p.get('search'),
            status=p.get('status'),
            device_id=p.get('deviceId'),
            date_from=p.get('dateFrom'),
            date_to=p.get('dateTo')
        ),

        # ERPNext operations
        'test_erpnext_connection': lambda p: erpnext_api.test_connection(
            p['url'], p['apiKey'], p['apiSecret'], p.get('version', 15)
        ),

        # Export operations
        'export_to_excel': lambda p: export_service.export_to_excel(p),
        'export_to_pdf': lambda p: export_service.export_to_pdf(p),

        # Config operations
        'save_config': lambda p: db.save_config(p['key'], p['value']),
        'get_config': lambda p: db.get_config(p['key']),
    }

    handler = handlers.get(method)
    if handler is None:
        raise ValueError(f'Unknown method: {method}')

    return handler(params)


def main():
    """Main loop for processing stdin commands."""
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError as e:
            error_response = {
                'error': {
                    'code': -32700,
                    'message': f'Parse error: {str(e)}'
                },
                'id': None
            }
            print(json.dumps(error_response), flush=True)
        except Exception as e:
            error_response = {
                'error': {
                    'code': -32603,
                    'message': f'Internal error: {str(e)}'
                },
                'id': None
            }
            print(json.dumps(error_response), flush=True)


if __name__ == '__main__':
    main()
