# Biometric Sync

Professional desktop application to sync ZKTeco biometric attendance data with ERPNext/HRMS.

![Build](https://github.com/badeeltechnology/biometric-sync/actions/workflows/build.yml/badge.svg)

## Features

- **Real-time Dashboard** - Live sync status, device health monitoring
- **Multi-device Support** - Connect multiple ZKTeco biometric devices
- **ERPNext Integration** - Direct sync with ERPNext v12-16 and HRMS
- **Multi-shift Support** - Configure shifts and map to devices
- **Export Reports** - Generate Excel and PDF attendance reports
- **Offline Resilience** - Local SQLite cache for data safety
- **System Tray** - Background sync with notifications

## Screenshots

| Dashboard | Devices | Settings |
|-----------|---------|----------|
| Real-time sync status | Manage ZKTeco devices | ERPNext configuration |

## Download

Get the latest release from the [Releases](https://github.com/badeeltechnology/biometric-sync/releases) page:

- **Windows**: Download `.exe` installer
- **macOS**: Download `.dmg` file

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/badeeltechnology/biometric-sync.git
cd biometric-sync

# Install Node.js dependencies
npm install

# Set up Python environment
cd python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Run in development mode
npm run electron:dev
```

### Build for Production

```bash
# Build for Windows
npm run electron:build:win

# Build for macOS
npm run electron:build:mac
```

## ERPNext Configuration

1. Create an API user in ERPNext with permissions:
   - **Employee Checkin**: Create
   - **Shift Type**: Write (optional, for shift sync)

2. Generate API Key and Secret:
   - Go to User > API Access
   - Generate keys

3. Enter credentials in the app's Settings page

## Supported Devices

- ZKTeco fingerprint attendance devices
- Devices communicating on port 4370 (ZK protocol)
- Tested models: ZK-F18, ZK-F22, U160, K40, etc.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Electron + React + Tailwind CSS |
| Backend | Python (embedded) |
| Device SDK | pyzk |
| Database | SQLite |
| Reports | openpyxl, reportlab |

## License

MIT License

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
