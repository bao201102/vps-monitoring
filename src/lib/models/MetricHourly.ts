import mongoose, { Schema, Model } from 'mongoose';
import type { IMetric } from './Metric';

/** Hourly averages of Metric, produced by the rollup job. `ts` is the start of the hour. */
export type IMetricHourly = Omit<IMetric, 'netRxBytes' | 'netTxBytes' | 'uptimeSeconds' | 'processCount'> & {
  cpuMax: number;
  samples: number;
};

const n = { type: Number, default: 0 };

const MetricHourlySchema = new Schema<IMetricHourly>(
  {
    agentId: { type: String, required: true },
    ts: { type: Date, required: true },
    samples: n,
    cpuPercent: n,
    cpuMax: n,
    loadAvg1: n,
    loadAvg5: n,
    loadAvg15: n,
    memUsedBytes: n,
    memTotalBytes: n,
    swapUsedBytes: n,
    swapTotalBytes: n,
    diskUsedBytes: n,
    diskTotalBytes: n,
    diskReadBps: n,
    diskWriteBps: n,
    netRxBps: n,
    netTxBps: n,
    dockerCpuPercent: n,
    dockerMemUsedBytes: n,
    dockerNetRxBps: n,
    dockerNetTxBps: n,
    dockerContainerCount: n,
    temperatureC: n,
    temperatures: { type: Map, of: Number, default: undefined },
    gpuUtilPercent: n,
    gpuMemUsedBytes: n,
    gpuMemTotalBytes: n,
    gpuPowerWatts: n,
  },
  // TTL follows ROLLUP_RETENTION_DAYS, see ensureIndexes().
  { timestamps: false, autoIndex: false, collection: 'metrichourlies' }
);

MetricHourlySchema.index({ agentId: 1, ts: 1 }, { unique: true });

export const MetricHourly: Model<IMetricHourly> =
  mongoose.models.MetricHourly || mongoose.model<IMetricHourly>('MetricHourly', MetricHourlySchema);
