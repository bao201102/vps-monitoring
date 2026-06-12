import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IVpsPort {
  agentId: string;
  proto: string;
  ip: string;
  port: number;
  service: string;
  pid?: number | null;
}

export interface IVpsPortDocument extends IVpsPort, Document {}

const VpsPortSchema = new Schema<IVpsPort>(
  {
    agentId: { type: String, required: true, index: true },
    proto: { type: String, required: true },
    ip: { type: String, required: true },
    port: { type: Number, required: true },
    service: { type: String, default: '' },
    pid: { type: Number, default: null },
  },
  { timestamps: true }
);

VpsPortSchema.index({ agentId: 1, proto: 1, ip: 1, port: 1 }, { unique: true });

export const VpsPort: Model<IVpsPort> =
  mongoose.models.VpsPort || mongoose.model<IVpsPort>('VpsPort', VpsPortSchema);
