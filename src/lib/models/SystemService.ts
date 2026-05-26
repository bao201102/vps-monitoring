import mongoose, { Schema, Model, Document } from 'mongoose';

export interface ISystemService {
  agentId: string;
  name: string;
  description: string;
  state: string; // Active, Inactive, Failed
  subState: string; // Running, Exited, Dead, Failed
  cpu10m: number | null; // CPU percentage
  cpuPeak: number | null; // Peak CPU
  memory: number | null; // Memory in bytes
  memoryPeak: number | null; // Peak memory in bytes
  updated: string; // Formatting string e.g. "8:24:20 PM"
}

export interface ISystemServiceDocument extends ISystemService, Document {}

const SystemServiceSchema = new Schema<ISystemService>(
  {
    agentId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    state: { type: String, default: 'Inactive' },
    subState: { type: String, default: 'Dead' },
    cpu10m: { type: Number, default: null },
    cpuPeak: { type: Number, default: null },
    memory: { type: Number, default: null },
    memoryPeak: { type: Number, default: null },
    updated: { type: String, default: '' },
  },
  { timestamps: true }
);

SystemServiceSchema.index({ agentId: 1, name: 1 }, { unique: true });

export const SystemService: Model<ISystemService> =
  mongoose.models.SystemService || mongoose.model<ISystemService>('SystemService', SystemServiceSchema);
