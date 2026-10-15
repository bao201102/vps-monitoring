import mongoose, { Schema, Model } from 'mongoose';

export const COMMAND_KINDS = ['service', 'container', 'agent'] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

export const COMMAND_ACTIONS: Record<CommandKind, readonly string[]> = {
  service: ['start', 'stop', 'restart'],
  container: ['start', 'stop', 'restart'],
  agent: ['update'],
};

/** Unit / container names the agent will accept (mirrors the check in agent.sh). */
export const COMMAND_TARGET_RE = /^[A-Za-z0-9@._:-]{1,128}$/;

export interface IAgentCommand {
  agentId: string;
  kind: CommandKind;
  action: string;
  /** Service unit or container name; empty for agent-level commands. */
  target: string;
  status: 'pending' | 'sent' | 'done' | 'failed' | 'expired';
  output?: string;
  requestedBy?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AgentCommandSchema = new Schema<IAgentCommand>(
  {
    agentId: { type: String, required: true, index: true },
    kind: { type: String, enum: COMMAND_KINDS, default: 'service' },
    action: { type: String, required: true },
    target: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'sent', 'done', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    output: { type: String, default: '' },
    requestedBy: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Command history is kept for 30 days.
AgentCommandSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AgentCommand: Model<IAgentCommand> =
  mongoose.models.AgentCommand || mongoose.model<IAgentCommand>('AgentCommand', AgentCommandSchema);
