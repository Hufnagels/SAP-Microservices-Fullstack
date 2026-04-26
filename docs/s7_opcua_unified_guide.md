# S7-1500 OPC-UA Integration: Complete Guide

**From TIA Portal configuration to production microservices deployment** - Everything you need to connect Python applications to Siemens S7-1500 PLCs using the industry-standard OPC-UA protocol.

---

## Table of Contents

### Quick Start
- [30-Second Overview](#30-second-overview)
- [Architecture Diagram](#architecture-diagram)

### Getting Started
1. [Prerequisites](#1-prerequisites)
2. [Decision Guide: OPC-UA vs Native S7](#2-decision-guide-opcua-vs-native-s7)

### PLC Configuration
3. [TIA Portal Setup](#3-tia-portal-setup)
   - [Enable OPC-UA Server](#31-enable-opcua-server)
   - [Configure Security](#32-configure-security)
   - [Create and Expose Data Blocks](#33-create-and-expose-data-blocks)
   - [Find Node IDs with UaExpert](#34-find-node-ids-with-uaexpert)

### Understanding OPC-UA
4. [Core Concepts](#4-core-concepts)
   - [Node Identifiers](#41-node-identifiers)
   - [Namespaces](#42-namespaces)
   - [Data Types](#43-data-types)
   - [Browsing vs Direct Access](#44-browsing-vs-direct-access)

### Python Implementation
5. [Standalone Application](#5-standalone-application)
   - [Installation](#51-installation)
   - [Basic Connection](#52-basic-connection)
   - [Reading and Writing](#53-reading-and-writing)
   - [Subscriptions](#54-subscriptions)

6. [Microservices Deployment](#6-microservices-deployment)
   - [Service Configuration](#61-service-configuration)
   - [Environment Variables](#62-environment-variables)
   - [Build and Start](#63-build-and-start)
   - [API Endpoints](#64-api-endpoints)
   - [Frontend Dashboard](#65-frontend-dashboard)

### Advanced Topics
7. [Performance Optimization](#7-performance-optimization)
8. [Security Configuration](#8-security-configuration)
9. [Error Handling](#9-error-handling)
10. [Production Deployment](#10-production-deployment)

### Reference
11. [Troubleshooting](#11-troubleshooting)
12. [Node ID Reference](#12-node-id-reference)
13. [API Reference](#13-api-reference)

---

## 30-Second Overview

```bash
# 1. Enable OPC-UA server in TIA Portal (Device Config → OPC UA)
# 2. Set endpoint: opc.tcp://192.168.0.1:4840

# 3. Install Python library
pip install asyncua

# 4. Test connection
python -c "
import asyncio
from asyncua import Client
async def test():
    client = Client('opc.tcp://192.168.0.1:4840')
    await client.connect()
    print('Connected!')
    await client.disconnect()
asyncio.run(test())
"

# 5. For microservices: Configure .env and start
docker compose up -d opcua-service
```

---

## Architecture Diagram

### Standalone Deployment
```
┌─────────────────────────┐
│  S7-1500 PLC            │
│  OPC-UA Server :4840    │
│  DataBlocksGlobal       │
└──────────┬──────────────┘
           │ OPC-UA
           ▼
┌─────────────────────────┐
│  Python Application     │
│  asyncua Client         │
│  FastAPI (optional)     │
└─────────────────────────┘
```

### Microservices Deployment
```
┌──────────────────────────────────┐        OPC-UA (TCP 4840)
│  Siemens S7-1500 PLC             │ ◄────────────────────────────┐
│  TIA Portal OPC-UA Server        │                              │
│  Exposes Data Block variables    │                              │
└──────────────────────────────────┘                              │
                                                                  │
┌──────────────────────────────────┐                              │
│  Docker App Stack                │                              │
│  ┌────────────────────────────┐  │                              │
│  │ opcua-service  (port 8000) │──┼──────────────────────────────┘
│  │   OPCUAPoller (500ms poll) │  │
│  │   asyncua client           │  │
│  └─────────┬──────────────────┘  │
│            │ REST API            │
│  ┌─────────▼──────────────────┐  │
│  │ s7-status-ui (port 5179)   │  │
│  │   React + MUI dashboard    │  │
│  │   Auto-refresh 1.5s        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
           ▲
           │ Traefik :80 → /opcua/*
           │ JWT Authentication
```

---

## 1. Prerequisites

| Item | Details |
|------|---------|
| **TIA Portal** | V16 or newer (OPC-UA available from V14) |
| **S7-1500 CPU** | Firmware ≥ V2.0 - all modern CPUs include OPC-UA |
| **License** | CPU 1511-1 PN and higher: included<br>CPU 1507S/1508S: separate license required |
| **Network** | Direct access to PLC on TCP port **4840** |
| **Python** | 3.8+ (for standalone) |
| **Docker** | Running (for microservices) |
| **UaExpert** | Optional - free OPC-UA browser for node discovery |

---

## 2. Decision Guide: OPC-UA vs Native S7

### Comparison Matrix

| Criterion | OPC-UA (asyncua) | Native S7 (python-snap7) | Winner |
|-----------|------------------|--------------------------|---------|
| **Latency** | 20-50ms | 8-12ms | Snap7 |
| **Security** | TLS, certificates, auth | None (requires PUT/GET) | **OPC-UA** |
| **Optimized DBs** | ✅ Supported | ❌ Not supported | **OPC-UA** |
| **Setup complexity** | High (server config) | Low (enable PUT/GET) | Snap7 |
| **PLC security impact** | Minimal (granular) | High (full access) | **OPC-UA** |
| **Subscriptions** | ✅ Native events | ❌ Polling only | **OPC-UA** |
| **Discovery** | ✅ Browse nodes | ❌ Manual mapping | **OPC-UA** |
| **Vendor neutrality** | ✅ IEC 62541 standard | Siemens proprietary | **OPC-UA** |
| **IT/OT integration** | Excellent | Poor | **OPC-UA** |
| **Professional image** | Modern, standard | Workaround/backdoor | **OPC-UA** |

### Choose OPC-UA When:

✅ **Security matters** - Customer IT requirements, compliance  
✅ **Standards required** - Industry 4.0, vendor-neutral  
✅ **SCADA/MES integration** - Need standard protocol  
✅ **Optimized blocks** - Want best PLC performance  
✅ **Event-driven** - Subscriptions more efficient than polling  
✅ **Long-term** - Future-proof, maintainable  
✅ **Professional** - Shows modern practices to customers

### Choose Native S7 When:

✅ **Ultra-low latency** - <10ms critical  
✅ **Quick prototype** - Fast development, isolated test  
✅ **Legacy** - Existing snap7 systems  
✅ **Simple** - No PLC-side server configuration

---

## 3. TIA Portal Setup

### 3.1 Enable OPC-UA Server

1. **Open TIA Portal** → Select your CPU
2. **Device Configuration** → Double-click CPU
3. **Properties** panel → **General → OPC UA → Server**
4. ☑ **"Activate OPC UA server"**
5. Set **Port**: `4840` (OPC-UA standard)
6. Set **Session timeout**: `10000` ms (default is fine)
7. **Compile** → Download to PLC

**Important:** OPC-UA runs on CPU's **first Ethernet interface** (typically X1). Verify IP matches your `OPCUA_ENDPOINT`.

**Verify in PLC diagnostics:**
- Online → Diagnostics → General
- OPC UA Server status should show **"Running"**

---

### 3.2 Configure Security

Choose your security level based on environment:

#### Option A: Anonymous Access (Development/Testing)

**In TIA Portal:**
1. **Properties → OPC UA → Server → Security**
2. Security policies: Enable **"None"** (no encryption)
3. Access control: ☑ **"Allow anonymous access"**
4. Compile and download

**In your application (.env):**
```bash
OPCUA_USERNAME=
OPCUA_PASSWORD=
OPCUA_SECURITY_MODE=None
```

**Use when:** Trusted LAN, development, testing

---

#### Option B: Username + Password (Recommended Production)

**In TIA Portal:**
1. **Properties → OPC UA → Server → Security**
2. Security policies: Enable **"Basic256Sha256"** (or Basic256)
3. Access control: ☐ Disable anonymous access
4. **Properties → OPC UA → Server → Users**:
   - Add user: `opcua_client`
   - Strong password
   - Role: **"Authenticated user"** (read) or **"Operator"** (read+write)
5. Compile and download

**In your application (.env):**
```bash
OPCUA_USERNAME=opcua_client
OPCUA_PASSWORD=YourStrongPassword123
OPCUA_SECURITY_MODE=Basic256Sha256
```

**Certificate Exchange:**
`Basic256Sha256` requires client certificates. The `asyncua` library auto-generates self-signed certificates. After first connection attempt:
1. TIA Portal → CPU Properties → OPC UA → Trusted clients
2. Find the client certificate (appears after failed handshake)
3. Click and press **"Add to trusted"**

**Use when:** Production, untrusted networks, compliance required

---

#### Option C: Certificate-Based (Maximum Security)

For certificate-based authentication without passwords:

**Generate certificates:**
```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout client_key.pem \
  -out client_cert.pem \
  -days 365 -nodes \
  -subj "/C=HU/ST=Budapest/O=MyCompany/CN=OPC-UA-Client"
```

**In TIA Portal:**
1. Import client certificate to Trusted clients
2. Assign permissions (Read, Write, Admin)
3. Configure endpoint for SignAndEncrypt

**In your application:**
```python
from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256

client = Client("opc.tcp://192.168.0.1:4840")
await client.set_security(
    SecurityPolicyBasic256Sha256,
    certificate="client_cert.pem",
    private_key="client_key.pem",
    mode=ua.MessageSecurityMode.SignAndEncrypt
)
```

---

### 3.3 Create and Expose Data Blocks

OPC-UA can only read **Global Data Blocks** marked as accessible.

#### Create a Global DB

1. **Project tree** → Right-click **"Program blocks"**
2. **Add new block** → **Data block** (Global DB)
3. Name: `DB_Process`
4. Add variables:

| Name | Data Type | Initial Value | Description |
|------|-----------|---------------|-------------|
| Temperature | Real | 0.0 | Process temperature |
| Pressure | Real | 0.0 | Process pressure |
| FlowRate | Real | 0.0 | Flow rate |
| Setpoint | Real | 100.0 | Temperature setpoint |
| Running | Bool | False | Machine running status |
| Alarm | Bool | False | Alarm active |
| BatchCount | DInt | 0 | Production counter |

#### Make DB OPC-UA Accessible

1. **Right-click DB** → **Properties**
2. **Attributes** tab:
   - ☐ **"Optimized block access"** - Uncheck for absolute addressing
     - ✅ For OPC-UA symbolic access: **can be checked** (recommended)
   - ☑ **"Accessible from HMI/OPC UA"** ← **Critical!**
   - ☑ **"Writable from HMI/OPC UA"** (if writing needed)

**Per-variable control:**
1. Open DB in editor
2. Click variable → Properties
3. Same checkboxes for fine-grained control

#### Compile and Download

```
Menu: Project → Compile → Hardware and Software (only changes)
Menu: Online → Download to device
```

---

### 3.4 Find Node IDs with UaExpert

**Node ID format:**
```
ns=<namespace>;s=<symbolic_path>
```

**For Siemens S7-1500:**
```
ns=3;s="DataBlocksGlobal"."DB_Process"."Temperature"
```

#### Using UaExpert

1. **Download UaExpert** (free from unified-automation.com)
2. **Add Server**: `opc.tcp://<PLC_IP>:4840`
3. **Connect** (use credentials if configured)
4. **Browse Address Space**:
   ```
   Root → Objects → DeviceSet → <CPU_name> → DataBlocksGlobal → DB_Process
   ```
5. **Right-click variable** → **"Copy Node ID"**

**Namespace index:**
- `ns=0`: OPC-UA standard
- `ns=1`: PLCopen types
- `ns=2`: Siemens types
- **`ns=3`**: Your PLC program data ← Most important
- `ns=4`: Device/hardware structure

#### Alternative: Programmatic Discovery

```python
async def discover_nodes(client: Client):
    """Discover all global data blocks."""
    root = client.get_node('ns=3;s=DataBlocksGlobal')
    dbs = await root.get_children()
    
    for db in dbs:
        db_name = await db.read_browse_name()
        print(f"\nData Block: {db_name.Name}")
        
        vars = await db.get_children()
        for var in vars:
            var_name = await var.read_browse_name()
            node_id = var.nodeid.to_string()
            try:
                value = await var.read_value()
                print(f"  {var_name.Name}: {value} ({node_id})")
            except:
                print(f"  {var_name.Name}: <unreadable>")
```

---

## 4. Core Concepts

### 4.1 Node Identifiers

**Four formats supported:**

```python
# Numeric (standard OPC-UA nodes)
"ns=0;i=2259"  # ServerState

# String (Siemens uses this)
'ns=3;s="DB_Process"."Temperature"'

# GUID
"ns=2;g=09087e75-8e5e-499b-954f-f2a9603db28a"

# Opaque (ByteString)
"ns=2;b=UVdFUlRZ"
```

**Siemens naming conventions:**

```python
# Simple variable
'ns=3;s="DB_Process"."Temperature"'

# Via DataBlocksGlobal (sometimes required)
'ns=3;s="DataBlocksGlobal"."DB_Process"."Temperature"'

# Nested struct
'ns=3;s="DB_Process"."Motor"."Speed"'

# Array element
'ns=3;s="DB_Counters"."Values"[5]'

# Instance DB
'ns=3;s="DataBlocksInstance"."FB_Motor_DB"."Speed"'
```

**Critical syntax rules:**
- Use **double quotes** around each segment
- Separate with **period** (.)
- Array indices in **square brackets** [n]

---

### 4.2 Namespaces

Namespaces organize nodes hierarchically:

```python
# Get namespace array
namespaces = await client.get_namespace_array()
print(namespaces)
# Output: ['http://opcfoundation.org/UA/', ..., 'Siemens/S7-1500/...']

# Find Siemens namespace index
siemens_ns = next(
    i for i, ns in enumerate(namespaces) 
    if 'Siemens' in ns or 'SIMATIC' in ns
)
print(f"Siemens namespace: ns={siemens_ns}")  # Usually ns=3
```

---

### 4.3 Data Types

**Automatic type conversion:**

| OPC-UA Type | Python Type | S7 Type | Range/Notes |
|-------------|-------------|---------|-------------|
| Boolean | `bool` | BOOL | True/False |
| SByte | `int` | SINT | -128 to 127 |
| Int16 | `int` | INT | -32768 to 32767 |
| Int32 | `int` | DINT | -2147483648 to 2147483647 |
| Float | `float` | REAL | IEEE 754 single precision |
| Double | `float` | LREAL | IEEE 754 double precision |
| String | `str` | STRING | UTF-8 text |
| DateTime | `datetime` | DTL | Date and time |

**Reading with type hints:**

```python
from asyncua import ua

# Automatic conversion
temp = await node.read_value()  # Returns Python float

# Explicit type validation
value = await node.read_value()
if not isinstance(value, float):
    value = float(value)  # Force conversion
```

**Writing with type specification:**

```python
# Explicit variant type for safety
dv = ua.DataValue(ua.Variant(75.5, ua.VariantType.Float))
await node.write_value(75.5)
```

---

### 4.4 Browsing vs Direct Access

**Browsing (discovery):**
```python
# Explore unknown PLC structure
parent = client.get_node('ns=3;s=DataBlocksGlobal')
children = await parent.get_children()

for child in children:
    name = await child.read_browse_name()
    print(name.Name)
```

**Direct access (production):**
```python
# Known node IDs for performance
nodes = {
    'temp': client.get_node('ns=3;s="DB_Process"."Temperature"'),
    'pressure': client.get_node('ns=3;s="DB_Process"."Pressure"')
}

# Batch read
temps, press = await asyncio.gather(
    nodes['temp'].read_value(),
    nodes['pressure'].read_value()
)
```

---

## 5. Standalone Application

### 5.1 Installation

```bash
# Create project
mkdir s7-opcua-app
cd s7-opcua-app

# Virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install asyncua==1.1.5 fastapi==0.115.0 uvicorn[standard]==0.30.6

# For security (certificates)
pip install asyncua[crypto]
```

---

### 5.2 Basic Connection

**Simple example:**

```python
import asyncio
from asyncua import Client

async def main():
    client = Client(url="opc.tcp://192.168.0.1:4840")
    
    try:
        await client.connect()
        print("Connected to OPC-UA server")
        
        # Read server state
        state_node = client.get_node("i=2259")
        state = await state_node.read_value()
        print(f"Server state: {state}")
        
    finally:
        await client.disconnect()

asyncio.run(main())
```

**Production connection with auto-reconnect:**

```python
import asyncio
import logging
from asyncua import Client
from typing import Optional

logger = logging.getLogger(__name__)

class RobustOPCUAClient:
    """Production client with auto-reconnection."""
    
    def __init__(self, endpoint: str, username: str = None, 
                 password: str = None):
        self.endpoint = endpoint
        self.username = username
        self.password = password
        self.client: Optional[Client] = None
        self._connected = False
        
    async def connect(self) -> bool:
        """Connect with retry logic."""
        for attempt in range(3):
            try:
                self.client = Client(url=self.endpoint, timeout=10)
                self.client.session_timeout = 120000  # 2 minutes
                
                if self.username and self.password:
                    self.client.set_user(self.username)
                    self.client.set_password(self.password)
                
                await self.client.connect()
                
                # Verify
                state = await self.client.get_node("i=2259").read_value()
                logger.info(f"Connected! Server state: {state}")
                
                self._connected = True
                return True
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                await asyncio.sleep(2 ** attempt)
                
        return False
        
    async def disconnect(self):
        """Graceful disconnect."""
        if self.client:
            try:
                await self.client.disconnect()
            finally:
                self._connected = False
                
    async def ensure_connected(self) -> bool:
        """Verify and restore connection."""
        if self._connected and self.client:
            try:
                await self.client.get_node("i=2259").read_value()
                return True
            except:
                self._connected = False
                
        return await self.connect()
```

---

### 5.3 Reading and Writing

**Read single value:**

```python
async def read_temperature(client: Client) -> float:
    node = client.get_node('ns=3;s="DB_Process"."Temperature"')
    value = await node.read_value()
    return float(value)
```

**Batch read (efficient):**

```python
async def read_process_data(client: Client) -> dict:
    """Read multiple values in single network call."""
    nodes = [
        client.get_node('ns=3;s="DB_Process"."Temperature"'),
        client.get_node('ns=3;s="DB_Process"."Pressure"'),
        client.get_node('ns=3;s="DB_Process"."FlowRate"'),
        client.get_node('ns=3;s="DB_Status"."Running"'),
    ]
    
    # Concurrent reads
    values = await asyncio.gather(*[n.read_value() for n in nodes])
    
    return {
        'temperature': float(values[0]),
        'pressure': float(values[1]),
        'flow_rate': float(values[2]),
        'running': bool(values[3])
    }
```

**Write values:**

```python
async def write_setpoint(client: Client, value: float):
    node = client.get_node('ns=3;s="DB_Process"."Setpoint"')
    await node.write_value(value)
    print(f"Wrote {value} to setpoint")

# Atomic multi-write
async def write_recipe(client: Client, recipe: dict):
    """Write multiple values atomically."""
    writes = [
        client.get_node('ns=3;s="DB_Recipe"."Temp"').write_value(recipe['temp']),
        client.get_node('ns=3;s="DB_Recipe"."Pressure"').write_value(recipe['press']),
        client.get_node('ns=3;s="DB_Recipe"."Enable"').write_value(True),
    ]
    
    results = await asyncio.gather(*writes, return_exceptions=True)
    
    # Check failures
    for result in results:
        if isinstance(result, Exception):
            raise result
```

---

### 5.4 Subscriptions

**Subscriptions = OPC-UA's killer feature.** Server pushes changes instead of client polling. 10-100x more efficient.

**Basic subscription:**

```python
from asyncua.common.subscription import SubHandler

class DataChangeHandler(SubHandler):
    """Handle subscription notifications."""
    
    def __init__(self, callback=None):
        super().__init__()
        self.callback = callback
        self.count = 0
        
    def datachange_notification(self, node, val, data):
        """Called when subscribed data changes."""
        self.count += 1
        node_id = node.nodeid.to_string()
        timestamp = data.monitored_item.Value.SourceTimestamp
        
        print(f"Change #{self.count}: {node_id} = {val} @ {timestamp}")
        
        if self.callback:
            self.callback(node_id, val, timestamp)

async def create_subscription(client: Client, node_ids: list):
    """Create subscription for change notifications."""
    handler = DataChangeHandler()
    
    # Create subscription (1000ms publish interval)
    sub = await client.create_subscription(1000, handler)
    
    # Subscribe to nodes
    nodes = [client.get_node(nid) for nid in node_ids]
    await sub.subscribe_data_change(nodes)
    
    print(f"Monitoring {len(nodes)} nodes for changes")
    
    # CRITICAL: Keep subscription reference alive!
    return sub
```

**Subscription with deadband filter:**

```python
from asyncua import ua

async def create_filtered_subscription(client: Client):
    """Only notify if value changes by ±0.5."""
    handler = DataChangeHandler()
    sub = await client.create_subscription(1000, handler)
    
    temp_node = client.get_node('ns=3;s="DB_Process"."Temperature"')
    
    # Deadband filter
    params = ua.MonitoringParameters()
    params.SamplingInterval = 500  # Check every 500ms
    
    filter_params = ua.DataChangeFilter()
    filter_params.DeadbandType = ua.DeadbandType.Absolute
    filter_params.DeadbandValue = 0.5  # ±0.5 threshold
    params.Filter = filter_params
    
    await sub.subscribe_data_change([temp_node])
    return sub
```

**Hybrid: Polling + Subscriptions:**

```python
class HybridMonitor:
    """Subscriptions for changes + periodic polling for verification."""
    
    def __init__(self, client: Client, node_ids: list):
        self.client = client
        self.node_ids = node_ids
        self.latest_values = {}
        self._running = False
        
    async def start(self):
        self._running = True
        
        # Create subscription
        handler = DataChangeHandler(callback=self._on_change)
        self.sub = await self.client.create_subscription(1000, handler)
        
        nodes = [self.client.get_node(nid) for nid in self.node_ids]
        await self.sub.subscribe_data_change(nodes)
        
        # Background polling every 5s for verification
        asyncio.create_task(self._poll_loop())
        
    def _on_change(self, node_id, value, timestamp):
        self.latest_values[node_id] = {'value': value, 'source': 'subscription'}
        
    async def _poll_loop(self):
        while self._running:
            try:
                nodes = [self.client.get_node(nid) for nid in self.node_ids]
                values = await asyncio.gather(*[n.read_value() for n in nodes])
                
                for nid, val in zip(self.node_ids, values):
                    if nid not in self.latest_values:
                        self.latest_values[nid] = {'value': val, 'source': 'poll'}
            except:
                pass
            await asyncio.sleep(5)
```

---

## 6. Microservices Deployment

### 6.1 Service Configuration

**Directory structure:**
```
services/opcua-service/
├── app/
│   ├── main.py          # FastAPI application
│   ├── client.py        # OPCUAPoller class
│   ├── models.py        # Pydantic models
│   └── config.py        # Settings
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

### 6.2 Environment Variables

**Create `.env` in project root:**

```bash
# OPC-UA Connection
OPCUA_ENDPOINT=opc.tcp://192.168.0.100:4840
OPCUA_USERNAME=opcua_client           # Empty for anonymous
OPCUA_PASSWORD=YourStrongPassword     # Empty for anonymous
OPCUA_SECURITY_MODE=None              # None | Basic256 | Basic256Sha256
OPCUA_POLL_INTERVAL_MS=500            # Polling interval

# Service
DEBUG=false
```

**⚠️ Important:** Do NOT add inline comments in `.env` - Docker includes them literally!

---

### 6.3 Build and Start

**Docker Compose:**

```bash
# Build and start service
docker compose up --build -d opcua-service

# View logs
docker compose logs -f opcua-service

# Restart (picks up .env changes, not code changes)
docker compose restart opcua-service

# Rebuild (picks up code changes)
docker compose up --build -d opcua-service
```

**Makefile shortcuts:**

```bash
make up-opcua        # Start service
make logs-opcua      # Follow logs
make restart-opcua   # Restart
```

---

### 6.4 API Endpoints

#### Health Check (No Auth)

```bash
curl http://localhost/opcua/health
```

**Response:**
```json
{
  "status": "healthy",
  "connected": true,
  "uptime_seconds": 142.3,
  "consecutive_errors": 0
}
```

#### Connection Status (JWT Required)

```bash
TOKEN="<paste_jwt_token>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/opcua/status
```

**Response:**
```json
{
  "connected": true,
  "endpoint_url": "opc.tcp://192.168.0.100:4840",
  "security_mode": "None",
  "poll_interval_ms": 500,
  "server_state": "ServerState.Running",
  "namespace_count": 5,
  "last_successful_read": 1742390000.1,
  "total_reads": 284,
  "total_writes": 0,
  "subscription_active": false,
  "uptime_seconds": 142.0
}
```

#### Process Data (JWT Required)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/opcua/process-data
```

**Response:**
```json
{
  "timestamp": 1742390010.4,
  "data": {
    "temperature": 23.5,
    "pressure": 1.013,
    "flow_rate": 4.72,
    "setpoint": 100.0,
    "running": true,
    "alarm": false
  },
  "read_time_ms": 12.3
}
```

#### Browse Nodes (Discovery)

```bash
# Browse Objects root
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost/opcua/browse-nodes?parent_node_id=i=85"

# Browse DataBlocksGlobal
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost/opcua/browse-nodes?parent_node_id=ns=3;s="DataBlocksGlobal"'
```

#### Read Single Node

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost/opcua/read-node?node_id=ns=3;s="DB_Process"."Temperature"'
```

#### Write Value (Operator Role Required)

```bash
curl -X POST http://localhost/opcua/write-value \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "ns=3;s=\"DB_Process\".\"Setpoint\"",
    "value": 120.0,
    "data_type": "Float"
  }'
```

**Supported data_type:** `Boolean`, `Int16`, `Int32`, `Float`, `Double`

---

### 6.5 Frontend Dashboard

**Start development server:**

```bash
make fe-s7
# Opens: http://localhost:5179
```

**Login:** Use auth-service credentials (any role ≥ viewer can read)

**Dashboard cards:**

| Card | Information |
|------|-------------|
| **Connection** | Endpoint, security mode, server state, namespaces, uptime, errors |
| **Process Data** | All monitored values, auto-refresh every 1.5s |
| **Statistics** | Total reads, success/fail counts, avg/min/max read times |

**Auto-refresh:** Uses `Promise.allSettled` - single failed API call doesn't block others

---

## 7. Performance Optimization

### Batch Operations

```python
# BAD: Sequential (3 network trips)
temp = await node1.read_value()
pressure = await node2.read_value()
flow = await node3.read_value()

# GOOD: Concurrent (~1 network trip)
temp, pressure, flow = await asyncio.gather(
    node1.read_value(),
    node2.read_value(),
    node3.read_value()
)
```

### Use Subscriptions Over Polling

```python
# Polling: 10 requests/second
while True:
    value = await node.read_value()
    await asyncio.sleep(0.1)

# Subscription: 1 setup + server pushes changes
sub = await client.create_subscription(100, handler)
await sub.subscribe_data_change([node])
```

**Efficiency gain: 10-100x reduction in network traffic**

### Connection Pooling

```python
from asyncio import Queue

class ConnectionPool:
    def __init__(self, endpoint: str, size: int = 5):
        self.connections = Queue(maxsize=size)
        
    async def initialize(self):
        for _ in range(5):
            client = Client(url=endpoint)
            await client.connect()
            await self.connections.put(client)
            
    async def acquire(self):
        return await self.connections.get()
        
    async def release(self, client):
        await self.connections.put(client)
```

### Benchmarking

```python
import time
import statistics

async def benchmark(client: Client, iterations: int = 100):
    node = client.get_node('ns=3;s="DB_Process"."Temperature"')
    times = []
    
    for _ in range(iterations):
        start = time.perf_counter()
        await node.read_value()
        times.append((time.perf_counter() - start) * 1000)
    
    print(f"Min:  {min(times):.2f}ms")
    print(f"Max:  {max(times):.2f}ms")
    print(f"Mean: {statistics.mean(times):.2f}ms")
```

**Typical results (local network):**
- Single read: 20-35ms
- Batch (10 nodes): 40-60ms (4-6ms per node)
- Subscription: <5ms notification delay

---

## 8. Security Configuration

### Security Modes Summary

| Mode | Env Value | Credentials | Encryption | Use Case |
|------|-----------|-------------|------------|----------|
| Anonymous | `None` | Empty | None | Trusted LAN, dev |
| Username | `None` | Set user/pass | None | Auth without certs |
| Sign | `Basic256` | Set user/pass | Sign only | Legacy PLCs |
| SignAndEncrypt | `Basic256Sha256` | Set user/pass | Full | Production |

### Implementation Examples

**Anonymous:**
```python
client = Client("opc.tcp://192.168.0.1:4840")
await client.connect()
```

**Username/Password:**
```python
client = Client("opc.tcp://192.168.0.1:4840")
client.set_user("opcua_client")
client.set_password("SecurePass123")
await client.connect()
```

**Sign mode:**
```python
from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256

client = Client("opc.tcp://192.168.0.1:4840")
await client.set_security(
    SecurityPolicyBasic256Sha256,
    certificate="client_cert.pem",
    private_key="client_key.pem",
    mode=ua.MessageSecurityMode.Sign
)
await client.connect()
```

**SignAndEncrypt (full security):**
```python
await client.set_security(
    SecurityPolicyBasic256Sha256,
    certificate="client_cert.pem",
    private_key="client_key.pem",
    mode=ua.MessageSecurityMode.SignAndEncrypt
)
```

---

## 9. Error Handling

**Production client with cache fallback:**

```python
from enum import Enum

class Health(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"

class ResilientClient:
    """Production client with graceful degradation."""
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self.client = None
        self.health = Health.DISCONNECTED
        self._cache = {}
        self._cache_max_age = 30.0
        self._errors = 0
        
    async def read_with_fallback(self, node_id: str, default=None):
        """Read with automatic cache fallback."""
        try:
            if not await self._ensure_connected():
                return await self._from_cache(node_id, default)
                
            node = self.client.get_node(node_id)
            value = await node.read_value()
            
            # Update cache
            self._cache[node_id] = {
                'value': value,
                'timestamp': asyncio.get_event_loop().time()
            }
            
            self._errors = 0
            self.health = Health.HEALTHY
            return value, 'live'
            
        except Exception as e:
            self._errors += 1
            return await self._from_cache(node_id, default)
            
    async def _from_cache(self, node_id: str, default):
        """Get from cache or default."""
        if node_id in self._cache:
            cached = self._cache[node_id]
            age = asyncio.get_event_loop().time() - cached['timestamp']
            
            if age < self._cache_max_age:
                self.health = Health.DEGRADED
                return cached['value'], 'cache'
                
        self.health = Health.DISCONNECTED
        return default, 'default'
        
    async def _ensure_connected(self):
        """Connect with exponential backoff."""
        if self.client:
            try:
                await self.client.get_node("i=2259").read_value()
                return True
            except:
                await self._disconnect()
                
        backoff = min(2 ** self._errors, 60)
        await asyncio.sleep(backoff)
        
        try:
            self.client = Client(url=self.endpoint)
            await self.client.connect()
            return True
        except:
            return False
```

---

## 10. Production Deployment

### Docker

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "main.py"]
```

**Build and run:**
```bash
docker build -t opcua-service .
docker run -d -p 8000:8000 --env-file .env opcua-service
```

### Systemd Service

**/etc/systemd/system/opcua-service.service:**
```ini
[Unit]
Description=S7-1500 OPC-UA Service
After=network.target

[Service]
Type=simple
User=opcua
WorkingDirectory=/opt/opcua-service
Environment="PATH=/opt/opcua-service/venv/bin"
ExecStart=/opt/opcua-service/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable opcua-service
sudo systemctl start opcua-service
```

---

## 11. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| `connected: false` | PLC unreachable or OPC-UA not enabled | Verify `OPCUA_ENDPOINT`, enable in TIA Portal |
| `consecutive_errors` growing | Wrong credentials / security mismatch | Check `OPCUA_USERNAME`, `PASSWORD`, `SECURITY_MODE` |
| Certificate errors | Basic256Sha256 - PLC hasn't trusted cert | TIA Portal → Trusted clients → trust certificate |
| All values `null` | Node IDs don't match PLC | Use UaExpert to verify exact node IDs |
| Some values `null` | Variable not accessible | Check "Accessible from HMI/OPC UA" in TIA Portal |
| `Bad_NodeIdUnknown` | Node path typo or wrong namespace | Re-copy from UaExpert, verify `ns=3` |
| Write returns `false` | Insufficient role or not writable | Use operator token, check "Writable" in TIA Portal |
| Port 4840 blocked | Firewall / network issue | Ping PLC, check firewall rules |
| High latency (>100ms) | Network issues or PLC overload | Check network, use batch reads, try subscriptions |

**Useful commands:**
```bash
# Follow logs
docker compose logs -f opcua-service

# Last 50 lines
docker compose logs --tail=50 opcua-service

# Restart with rebuild
docker compose up --build -d opcua-service
```

---

## 12. Node ID Reference

### Standard OPC-UA Nodes

| Description | Node ID |
|-------------|---------|
| Server state | `i=2259` |
| Namespace array | `i=2255` |
| Objects folder | `i=85` |
| Server node | `i=2253` |

### Siemens S7-1500 Patterns

```python
# Basic format
'ns=3;s="<DB_name>"."<Variable>"'

# Via DataBlocksGlobal (sometimes required)
'ns=3;s="DataBlocksGlobal"."<DB_name>"."<Variable>"'

# Examples
'ns=3;s="DB_Process"."Temperature"'
'ns=3;s="DataBlocksGlobal"."DB_Process"."Temperature"'
'ns=3;s="DB_Process"."Motor"."Speed"'         # Struct
'ns=3;s="DB_Counters"."Values"[0]'            # Array
'ns=3;s="DataBlocksInstance"."FB_Motor_DB"."Speed"'  # Instance DB
```

**Find namespace index:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost/opcua/browse-nodes?parent_node_id=i=2255"
```

---

## 13. API Reference

### Standalone Application

```python
# Connection
client = Client("opc.tcp://192.168.0.1:4840")
await client.connect()

# Read
node = client.get_node('ns=3;s="DB_Process"."Temperature"')
value = await node.read_value()

# Write
await node.write_value(75.5)

# Browse
parent = client.get_node('ns=3;s=DataBlocksGlobal')
children = await parent.get_children()

# Subscription
handler = DataChangeHandler()
sub = await client.create_subscription(1000, handler)
await sub.subscribe_data_change([node])

# Disconnect
await client.disconnect()
```

### Microservices API

**Base URL:** `http://localhost/opcua`

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health |
| GET | `/status` | JWT | Connection status |
| GET | `/process-data` | JWT | Latest values |
| GET | `/browse-nodes` | JWT | Browse hierarchy |
| GET | `/read-node` | JWT | Single node read |
| POST | `/write-value` | JWT (operator) | Write value |
| GET | `/statistics` | JWT | Performance metrics |

---

## Conclusion

**OPC-UA is the professional choice** for production S7-1500 integration when:
- ✅ Security and compliance matter
- ✅ Standards-based integration required
- ✅ Long-term maintainability prioritized
- ✅ IT/OT integration needed

The 20-30ms extra latency compared to native S7 is negligible in most processes, while the **security, discoverability, and vendor neutrality** provide significant long-term value.

### Implementation Checklist

- [ ] Enable OPC-UA server in TIA Portal
- [ ] Configure security (anonymous → username → certificates)
- [ ] Create and expose data blocks
- [ ] Discover node IDs with UaExpert
- [ ] Test connection (standalone script)
- [ ] Implement robust connection with auto-reconnect
- [ ] Use batch reads for efficiency
- [ ] Implement subscriptions for change-driven data
- [ ] Add error handling with cache fallback
- [ ] Deploy (Docker/systemd)
- [ ] Monitor performance and adjust intervals

**Built for industrial automation engineers who need secure, standards-based PLC connectivity.**
