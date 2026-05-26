import mongoose, { Schema, Model } from 'mongoose';

export interface IDockerContainer {
  agentId: string;
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
  logs: string[];
  details: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DockerContainerSchema = new Schema<IDockerContainer>(
  {
    agentId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    ports: { type: String, default: '' },
    status: { type: String, default: '' },
    health: { type: String, default: 'None' },
    cpuWeight: { type: Number, default: 0 },
    memWeight: { type: Number, default: 0 },
    netWeight: { type: Number, default: 0 },
    defaultCpu: { type: Number, default: 0 },
    defaultMem: { type: Number, default: 0 },
    defaultNet: { type: Number, default: 0 },
    color: { type: String, default: '#71717a' },
    logs: { type: [String], default: [] },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DockerContainerSchema.index({ agentId: 1, name: 1 }, { unique: true });

export const DockerContainer: Model<IDockerContainer> =
  mongoose.models.DockerContainer || mongoose.model<IDockerContainer>('DockerContainer', DockerContainerSchema);
