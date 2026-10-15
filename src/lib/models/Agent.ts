import mongoose, { Schema, Model } from 'mongoose';

export interface IDiskMount {
  mount: string;
  device: string;
  fsType: string;
  usedBytes: number;
  totalBytes: number;
}

export interface IAgent {
  agentId: string;
  token: string;
  /** Issued by "rotate token"; accepted until the agent switches to it. */
  nextToken?: string | null;
  hostname: string;
  os: string;
  osVersion: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  publicIp?: string;
  privateIp?: string;
  tags: string[];
  label?: string;
  lastSeenAt?: Date;
  userId: string;
  registeredAt: Date;
  agentVersion?: string;
  /** Whether the agent accepts remote commands (ALLOW_REMOTE_COMMANDS=1 on the VPS). */
  remoteCommands: boolean;
  disks: IDiskMount[];
  /** Hashes of the last ports/domains payload, to skip rewriting unchanged lists. */
  portsHash?: string;
  domainsHash?: string;

  // Alert settings overrides (Beszel-style)
  alertsUseGlobal: boolean;
  alertCpuEnabled: boolean;
  alertCpuPercent: number;
  alertRamEnabled: boolean;
  alertRamPercent: number;
  alertDiskEnabled: boolean;
  alertDiskPercent: number;
  alertTempEnabled: boolean;
  alertTempLimit: number;
  alertOfflineEnabled: boolean;

  latest?: any;

  createdAt: Date;
  updatedAt: Date;
}

const DiskMountSchema = new Schema<IDiskMount>(
  {
    mount: String,
    device: String,
    fsType: String,
    usedBytes: Number,
    totalBytes: Number,
  },
  { _id: false }
);

const AgentSchema = new Schema<IAgent>(
  {
    userId: { type: Schema.Types.ObjectId as any, ref: 'User', required: true, index: true },
    agentId: { type: String, required: true, unique: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    nextToken: { type: String, default: null },
    hostname: { type: String, default: 'unknown' },
    os: { type: String, default: 'unknown' },
    osVersion: { type: String, default: '' },
    kernel: { type: String, default: '' },
    arch: { type: String, default: '' },
    cpuModel: { type: String, default: '' },
    cpuCores: { type: Number, default: 0 },
    totalMemoryBytes: { type: Number, default: 0 },
    totalDiskBytes: { type: Number, default: 0 },
    publicIp: { type: String },
    privateIp: { type: String },
    tags: { type: [String], default: [] },
    label: { type: String },
    lastSeenAt: { type: Date, index: true },
    registeredAt: { type: Date, default: () => new Date() },
    agentVersion: { type: String },
    remoteCommands: { type: Boolean, default: false },
    disks: { type: [DiskMountSchema], default: [] },
    portsHash: { type: String },
    domainsHash: { type: String },

    // Per-VPS Alert override configurations
    alertsUseGlobal: { type: Boolean, default: true },
    alertCpuEnabled: { type: Boolean, default: true },
    alertCpuPercent: { type: Number, default: 85 },
    alertRamEnabled: { type: Boolean, default: true },
    alertRamPercent: { type: Number, default: 85 },
    alertDiskEnabled: { type: Boolean, default: true },
    alertDiskPercent: { type: Number, default: 90 },
    alertTempEnabled: { type: Boolean, default: false },
    alertTempLimit: { type: Number, default: 80 },
    alertOfflineEnabled: { type: Boolean, default: true },

    latest: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Agent: Model<IAgent> =
  mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
