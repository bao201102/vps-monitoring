import mongoose, { Schema, Model } from 'mongoose';

export interface IContainerMetric {
  agentId: string;
  name: string;
  ts: Date;
  cpuPercent: number;
  memUsedBytes: number;
  netRxBps: number;
  netTxBps: number;
}

const ContainerMetricSchema = new Schema<IContainerMetric>(
  {
    agentId: { type: String, required: true },
    name: { type: String, required: true },
    ts: { type: Date, required: true },
    cpuPercent: { type: Number, default: 0 },
    memUsedBytes: { type: Number, default: 0 },
    netRxBps: { type: Number, default: 0 },
    netTxBps: { type: Number, default: 0 },
  },
  // TTL follows METRICS_RETENTION_DAYS, see ensureIndexes().
  { timestamps: false, autoIndex: false }
);

ContainerMetricSchema.index({ agentId: 1, ts: -1 });
ContainerMetricSchema.index({ agentId: 1, name: 1, ts: -1 });

export const ContainerMetric: Model<IContainerMetric> =
  mongoose.models.ContainerMetric ||
  mongoose.model<IContainerMetric>('ContainerMetric', ContainerMetricSchema);
