import mongoose, { Schema, Model } from 'mongoose';

/** Latest HTTP + TLS probe result for a domain discovered on an agent. */
export interface IDomainCheck {
  agentId: string;
  domain: string;
  ok: boolean;
  httpStatus?: number | null;
  responseMs?: number | null;
  error?: string | null;
  sslValidTo?: Date | null;
  sslIssuer?: string | null;
  checkedAt: Date;
}

const DomainCheckSchema = new Schema<IDomainCheck>(
  {
    agentId: { type: String, required: true },
    domain: { type: String, required: true },
    ok: { type: Boolean, default: false },
    httpStatus: { type: Number, default: null },
    responseMs: { type: Number, default: null },
    error: { type: String, default: null },
    sslValidTo: { type: Date, default: null },
    sslIssuer: { type: String, default: null },
    checkedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

DomainCheckSchema.index({ agentId: 1, domain: 1 }, { unique: true });

export const DomainCheck: Model<IDomainCheck> =
  mongoose.models.DomainCheck || mongoose.model<IDomainCheck>('DomainCheck', DomainCheckSchema);
