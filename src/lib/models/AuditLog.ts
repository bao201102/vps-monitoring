import mongoose, { Schema, Model } from 'mongoose';

export interface IAuditLog {
  userId: string;
  username: string;
  action: string;
  target: string;
  meta?: Record<string, unknown>;
  ts: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, default: '' },
    action: { type: String, required: true },
    target: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
    ts: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

AuditLogSchema.index({ ts: -1 });
// Keep one year of audit history.
AuditLogSchema.index({ ts: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'ts_ttl' });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
