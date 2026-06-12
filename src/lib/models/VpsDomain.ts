import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IVpsDomain {
  agentId: string;
  domain: string;
  type: string; // nginx, apache, caddy
}

export interface IVpsDomainDocument extends IVpsDomain, Document {}

const VpsDomainSchema = new Schema<IVpsDomain>(
  {
    agentId: { type: String, required: true, index: true },
    domain: { type: String, required: true },
    type: { type: String, required: true },
  },
  { timestamps: true }
);

VpsDomainSchema.index({ agentId: 1, domain: 1 }, { unique: true });

export const VpsDomain: Model<IVpsDomain> =
  mongoose.models.VpsDomain || mongoose.model<IVpsDomain>('VpsDomain', VpsDomainSchema);
