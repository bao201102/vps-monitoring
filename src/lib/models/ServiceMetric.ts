import mongoose, { Schema, Model } from 'mongoose';

export interface IServiceMetric {
  agentId: string;
  serviceName: string;
  ts: Date;
  cpuPercent: number | null;
  memBytes: number | null;
}

const ServiceMetricSchema = new Schema<IServiceMetric>(
  {
    agentId: { type: String, required: true },
    serviceName: { type: String, required: true },
    ts: { type: Date, required: true },
    cpuPercent: { type: Number, default: null },
    memBytes: { type: Number, default: null },
  },
  { timestamps: false }
);

ServiceMetricSchema.index({ agentId: 1, serviceName: 1, ts: -1 });

// TTL: auto-delete records older than 30 days
ServiceMetricSchema.index({ ts: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const ServiceMetric: Model<IServiceMetric> =
  mongoose.models.ServiceMetric ||
  mongoose.model<IServiceMetric>('ServiceMetric', ServiceMetricSchema);
