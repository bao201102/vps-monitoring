import mongoose, { Schema, Model } from 'mongoose';

export interface IAgentCommand {
  agentId: string;
  action: 'start' | 'stop' | 'restart';
  service: string;
  status: 'pending' | 'sent' | 'done' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const AgentCommandSchema = new Schema<IAgentCommand>(
  {
    agentId: { type: String, required: true, index: true },
    action: { type: String, enum: ['start', 'stop', 'restart'], required: true },
    service: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'done', 'failed'], default: 'pending', index: true },
  },
  { timestamps: true }
);

export const AgentCommand: Model<IAgentCommand> =
  mongoose.models.AgentCommand || mongoose.model<IAgentCommand>('AgentCommand', AgentCommandSchema);
