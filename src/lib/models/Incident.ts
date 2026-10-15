import mongoose, { Schema, Model } from 'mongoose';

export const INCIDENT_TYPES = [
  'offline',
  'cpu',
  'ram',
  'disk',
  'temp',
  'service',
  'container',
  'domain_down',
  'ssl_expiry',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentSeverity = 'warning' | 'critical';

export interface IIncident {
  userId: string;
  agentId: string;
  type: IncidentType;
  /** Identifies the resource within the type, e.g. `disk:/var`, `service:nginx`. */
  key: string;
  status: 'open' | 'resolved';
  severity: IncidentSeverity;
  title: string;
  detail: string;
  value?: number | null;
  threshold?: number | null;
  startedAt: Date;
  resolvedAt?: Date | null;
  /** Last time a notification was sent for this incident (open or resolve). */
  notifiedAt?: Date | null;
}

const IncidentSchema = new Schema<IIncident>(
  {
    userId: { type: String, required: true },
    agentId: { type: String, required: true },
    type: { type: String, enum: INCIDENT_TYPES, required: true },
    key: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    title: { type: String, default: '' },
    detail: { type: String, default: '' },
    value: { type: Number, default: null },
    threshold: { type: Number, default: null },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

IncidentSchema.index({ agentId: 1, status: 1, type: 1 });
IncidentSchema.index({ userId: 1, startedAt: -1 });
// At most one open incident per (agent, key).
IncidentSchema.index(
  { agentId: 1, key: 1 },
  { unique: true, partialFilterExpression: { status: 'open' }, name: 'one_open_per_key' }
);
// Resolved incidents are kept for 180 days; open ones (resolvedAt = null) never expire.
IncidentSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60, name: 'resolved_ttl' });

export const Incident: Model<IIncident> =
  mongoose.models.Incident || mongoose.model<IIncident>('Incident', IncidentSchema);
