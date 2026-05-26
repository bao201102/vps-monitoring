import { format } from 'date-fns';

export interface ContainerMeta {
  name: string;
  image: string;
  ports: string;
  status: string;
  health: 'Healthy' | 'Unhealthy' | 'None';
  cpuWeight: number;
  memWeight: number;
  netWeight: number;
  defaultCpu: number;
  defaultMem: number;
  defaultNet: number;
  color: string;
}

export const CONTAINERS_BY_AGENT: Record<string, ContainerMeta[]> = {
  'nub.io.vn': [
    {
      name: 'n8n_app',
      image: 'n8nio/n8n:latest',
      ports: '127.0.0.1:5678',
      status: 'Up 3 weeks',
      health: 'None',
      cpuWeight: 0.90,
      memWeight: 0.61,
      netWeight: 0.95,
      defaultCpu: 0.25,
      defaultMem: 329.1 * 1024 * 1024,
      defaultNet: 0.47 * 1024,
      color: '#ea580c',
    },
    {
      name: 'beszel-agent',
      image: 'henrygd/beszel-agent',
      ports: '',
      status: 'Up 4 hours',
      health: 'None',
      cpuWeight: 0.05,
      memWeight: 0.008,
      netWeight: 0.02,
      defaultCpu: 0.01,
      defaultMem: 4.55 * 1024 * 1024,
      defaultNet: 0.0,
      color: '#8b5cf6',
    },
    {
      name: 'epicgames-freegames-node',
      image: 'ghcr.io/claabs/epicgames-freegames:latest',
      ports: '1234',
      status: 'Up 7 days',
      health: 'None',
      cpuWeight: 0.02,
      memWeight: 0.016,
      netWeight: 0.01,
      defaultCpu: 0.00,
      defaultMem: 8.52 * 1024 * 1024,
      defaultNet: 0.0,
      color: '#3b82f6',
    },
    {
      name: 'dev_tools_app',
      image: 'boris1120/dev-tools:latest',
      ports: '8080',
      status: 'Up 4 days',
      health: 'None',
      cpuWeight: 0.01,
      memWeight: 0.004,
      netWeight: 0.01,
      defaultCpu: 0.00,
      defaultMem: 2.36 * 1024 * 1024,
      defaultNet: 0.0,
      color: '#eab308',
    },
    {
      name: 'browserless',
      image: 'ghcr.io/browserless/chrome:latest',
      ports: '3001',
      status: 'Up 3 weeks',
      health: 'None',
      cpuWeight: 0.02,
      memWeight: 0.362,
      netWeight: 0.01,
      defaultCpu: 0.00,
      defaultMem: 195.2 * 1024 * 1024,
      defaultNet: 0.0,
      color: '#10b981',
    },
  ],
  'root': [
    {
      name: 'mongodb',
      image: 'mongo:latest',
      ports: '27017',
      status: 'Up 20 hours',
      health: 'None',
      cpuWeight: 0.75,
      memWeight: 0.60,
      netWeight: 0.04,
      defaultCpu: 0.51,
      defaultMem: 116.5 * 1024 * 1024,
      defaultNet: 0.10 * 1024,
      color: '#10b981',
    },
    {
      name: 'beszel',
      image: 'henrygd/beszel:latest',
      ports: '8090',
      status: 'Up 4 hours',
      health: 'None',
      cpuWeight: 0.18,
      memWeight: 0.06,
      netWeight: 0.93,
      defaultCpu: 0.12,
      defaultMem: 11.8 * 1024 * 1024,
      defaultNet: 2.30 * 1024,
      color: '#ea580c',
    },
    {
      name: 'beszel-agent',
      image: 'henrygd/beszel-agent',
      ports: '',
      status: 'Up 4 hours',
      health: 'None',
      cpuWeight: 0.04,
      memWeight: 0.02,
      netWeight: 0.00,
      defaultCpu: 0.03,
      defaultMem: 4.64 * 1024 * 1024,
      defaultNet: 0.0,
      color: '#8b5cf6',
    },
    {
      name: 'vps-monitoring-web-1',
      image: 'boris1120/vps-monitoring:latest',
      ports: '3000',
      status: 'Up 26 minutes',
      health: 'None',
      cpuWeight: 0.03,
      memWeight: 0.32,
      netWeight: 0.03,
      defaultCpu: 0.02,
      defaultMem: 64.5 * 1024 * 1024,
      defaultNet: 99.0,
      color: '#3b82f6',
    },
  ],
};

export const CONTAINER_MOCK_LOGS: Record<string, string[]> = {
  n8n_app: [
    "Initializing n8n process",
    "Puppeteer node: Container detected via .dockerenv file",
    "n8n ready on ::, port 5678",
    "n8n Task Broker ready on 127.0.0.1, port 5679",
    "Failed to start Python task runner in internal mode, because Python 3 is missing from this system. Launching in JS-only mode.",
    "[license SDK] Skipping renewal on init: license cert is not initialized",
    "Registered runner \"JS Task Runner\" (f3CTYINeq_LasUVIXRxLu)",
    "Version: 2.16.0",
    "Building workflow dependency index...",
    "Finished building workflow dependency index. Processed 0 draft workflows, 0 published workflows.",
    "",
    "Editor is now accessible via:",
    "https://n8n.nub.io.vn",
    "ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default). Please configure web server trust proxy if you are running n8n behind a proxy server."
  ],
  browserless: [
    "2026-05-26T10:00:01.000Z - info: [chrome] Starting Chrome browser...",
    "2026-05-26T10:00:02.120Z - info: [chrome] Chrome version 124.0.6367.78",
    "2026-05-26T10:00:02.122Z - info: [browserless] Listening on port 3001...",
    "2026-05-26T10:00:02.125Z - info: [browserless] Max concurrent sessions: 10",
    "2026-05-26T10:05:00.124Z - info: [session-manager] Session created for connection from 10.0.0.4",
    "2026-05-26T10:05:15.542Z - info: [session-manager] Session closed. Duration: 15.4s"
  ],
  "epicgames-freegames-node": [
    "[2026-05-26 10:00:00] [INFO] Starting Epic Games Free Games Scraper...",
    "[2026-05-26 10:00:02] [INFO] Loading configuration...",
    "[2026-05-26 10:00:03] [INFO] Querying Epic Games Store API...",
    "[2026-05-26 10:00:04] [INFO] Found 2 free games this week:",
    "[2026-05-26 10:00:04] [INFO] - Farming Simulator 22 (Free until June 2)",
    "[2026-05-26 10:00:04] [INFO] - Machinika: Museum (Free until June 2)",
    "[2026-05-26 10:00:05] [INFO] Sending Discord webhook alert... Success.",
    "[2026-05-26 10:00:06] [INFO] Scheduler sleeping for 24 hours."
  ],
  "dev_tools_app": [
    "Starting dev-tools node server...",
    "Environment: production",
    "DB connected successfully.",
    "Express server listening on port 8080.",
    "Ready for requests."
  ],
  "beszel-agent": [
    "2026/05/26 10:00:00 Starting Beszel Agent v0.4.0",
    "2026/05/26 10:00:00 System detected: linux/arm64",
    "2026/05/26 10:00:00 Collecting system metrics...",
    "2026/05/26 10:00:01 Connection established with hub at 127.0.0.1:8090",
    "2026/05/26 10:05:00 Sending metric update... Status: OK"
  ],
  mongodb: [
    "{\"t\":{\"$date\":\"2026-05-26T10:00:00.123+00:00\"},\"s\":\"I\", \"c\":\"CONTROL\",  \"id\":23285,   \"ctx\":\"main\",\"msg\":\"Automatically enabling TLS 1.3 because system supports it\"}",
    "{\"t\":{\"$date\":\"2026-05-26T10:00:00.130+00:00\"},\"s\":\"I\", \"c\":\"NETWORK\",  \"id\":4916004, \"ctx\":\"main\",\"msg\":\"ListenId parameter is not specified, listening on all configured IP addresses\"}",
    "{\"t\":{\"$date\":\"2026-05-26T10:00:00.131+00:00\"},\"s\":\"I\", \"c\":\"NETWORK\",  \"id\":23016,   \"ctx\":\"listener\",\"msg\":\"Waiting for connections\",\"attr\":{\"port\":27017,\"ssl\":\"off\"}}",
    "{\"t\":{\"$date\":\"2026-05-26T10:00:05.452+00:00\"},\"s\":\"I\", \"c\":\"NETWORK\",  \"id\":22943,   \"ctx\":\"conn1\",\"msg\":\"Connection accepted\",\"attr\":{\"remote\":\"127.0.0.1:53124\",\"connectionId\":1,\"connectionCount\":1}}"
  ],
  beszel: [
    "beszel-hub started successfully.",
    "Listening on http://0.0.0.0:8090",
    "PocketBase database file loaded.",
    "2026/05/26 10:00:02 [DB] Auto-migration successfully executed.",
    "2026/05/26 10:05:00 Connected agents: 2",
    "2026/05/26 10:05:01 Received heartbeat from agent 'nub.io.vn'",
    "2026/05/26 10:05:02 Received heartbeat from agent 'root'"
  ],
  "vps-monitoring-web-1": [
    "▲ Next.js 14.2.5",
    "- Local: http://localhost:3000",
    "- Network: http://192.168.1.15:3000",
    "",
    "✓ Ready in 1.4s",
    "Connecting to MongoDB database at mongodb://127.0.0.1:27017/vps-monitoring...",
    "MongoDB Database connected successfully.",
    "SWR client synchronization initialized."
  ]
};

export const CONTAINER_MOCK_DETAILS: Record<string, Record<string, any>> = {
  n8n_app: {
    AppArmorProfile: "docker-default",
    Args: ["--", "/docker-entrypoint.sh"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Cmd: null,
      Domainname: "",
      Entrypoint: ["tini", "--", "/docker-entrypoint.sh"],
      ExposedPorts: {
        "5678/tcp": {}
      }
    }
  },
  browserless: {
    AppArmorProfile: "docker-default",
    Args: [],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Cmd: ["/bin/sh", "-c", "node index.js"],
      Domainname: "",
      Env: ["PORT=3001", "MAX_CONCURRENT_SESSIONS=10"],
      ExposedPorts: {
        "3001/tcp": {}
      }
    }
  },
  "epicgames-freegames-node": {
    AppArmorProfile: "docker-default",
    Args: ["node", "app.js"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Cmd: null,
      Domainname: "",
      ExposedPorts: {
        "1234/tcp": {}
      }
    }
  },
  dev_tools_app: {
    AppArmorProfile: "docker-default",
    Args: ["npm", "start"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Cmd: null,
      ExposedPorts: {
        "8080/tcp": {}
      }
    }
  },
  "beszel-agent": {
    AppArmorProfile: "docker-default",
    Args: ["/app/beszel-agent"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Env: ["PORT=45876", "KEY=your-agent-key"]
    }
  },
  mongodb: {
    AppArmorProfile: "docker-default",
    Args: ["mongod"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      ExposedPorts: {
        "27017/tcp": {}
      }
    }
  },
  beszel: {
    AppArmorProfile: "docker-default",
    Args: ["/app/beszel-hub", "serve", "--http=0.0.0.0:8090"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      ExposedPorts: {
        "8090/tcp": {}
      }
    }
  },
  "vps-monitoring-web-1": {
    AppArmorProfile: "docker-default",
    Args: ["npm", "run", "start"],
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      ExposedPorts: {
        "3000/tcp": {}
      }
    }
  }
};

export function getMockContainerId(name: string) {
  if (name === 'n8n_app') return '8ace8279c58f';
  if (name === 'mongodb') return '6b5e128cf34a';
  // simple deterministic string hashing to hex ID
  const hash = name.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  return (hash * 1993).toString(16).padEnd(12, 'a').substring(0, 12);
}

export function getContainersForAgent(
  label: string | undefined,
  hostname: string | undefined,
  latestMetric: any
) {
  const name = (label || hostname || '').toLowerCase();
  const key = name.includes('nub.io.vn') ? 'nub.io.vn' : 'root';
  const metaList = CONTAINERS_BY_AGENT[key] || CONTAINERS_BY_AGENT['root'];

  const updatedTime = latestMetric?.ts
    ? format(new Date(latestMetric.ts), 'h:mm:ss a')
    : format(new Date(), 'h:mm:ss a');

  return metaList.map((c) => {
    const hasMetric =
      latestMetric &&
      (latestMetric.dockerCpuPercent > 0 || latestMetric.dockerMemUsedBytes > 0);

    return {
      name: c.name,
      image: c.image,
      ports: c.ports,
      status: c.status,
      health: c.health,
      cpu: hasMetric ? latestMetric.dockerCpuPercent * c.cpuWeight : c.defaultCpu,
      memory: hasMetric ? latestMetric.dockerMemUsedBytes * c.memWeight : c.defaultMem,
      net: hasMetric
        ? (latestMetric.dockerNetRxBps + latestMetric.dockerNetTxBps) * c.netWeight
        : c.defaultNet,
      updated: updatedTime,
    };
  });
}
