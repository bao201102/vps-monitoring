import mongoose, { Schema, Model } from 'mongoose';

export interface IDockerContainer {
  agentId: string;
  name: string;
  containerId: string;
  image: string;
  ports: string;
  status: string;
  health: 'Healthy' | 'Unhealthy' | 'None';
  cpuPercent: number;
  memUsedBytes: number;
  netRxBps: number;
  netTxBps: number;
  logs: string[];
  details: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DockerContainerSchema = new Schema<IDockerContainer>(
  {
    agentId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    containerId: { type: String, default: '' },
    image: { type: String, required: true },
    ports: { type: String, default: '' },
    status: { type: String, default: '' },
    health: { type: String, default: 'None' },
    cpuPercent: { type: Number, default: 0 },
    memUsedBytes: { type: Number, default: 0 },
    netRxBps: { type: Number, default: 0 },
    netTxBps: { type: Number, default: 0 },
    logs: { type: [String], default: [] },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DockerContainerSchema.index({ agentId: 1, name: 1 }, { unique: true });

export const DockerContainer: Model<IDockerContainer> =
  mongoose.models.DockerContainer || mongoose.model<IDockerContainer>('DockerContainer', DockerContainerSchema);
