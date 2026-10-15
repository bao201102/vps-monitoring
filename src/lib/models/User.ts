import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  /** Bumped on password/role change so existing sessions stop working. */
  sessionVersion: number;
  /** Secret used by `curl … /api/install?token=` to enroll new servers. Rotatable. */
  enrollToken?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  webhookUrl?: string;
  alertCpuPercent: number;
  alertCpuEnabled: boolean;
  alertRamPercent: number;
  alertRamEnabled: boolean;
  alertDiskPercent: number;
  alertDiskEnabled: boolean;
  alertTempLimit: number;
  alertTempEnabled: boolean;
  alertOfflineEnabled: boolean;
  alertServiceEnabled: boolean;
  alertContainerEnabled: boolean;
  alertDomainEnabled: boolean;
  alertSslDays: number;
  telegramCooldownSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    sessionVersion: { type: Number, default: 0 },
    enrollToken: { type: String, index: { unique: true, sparse: true } },
    telegramBotToken: { type: String, default: '' },
    telegramChatId: { type: String, default: '' },
    telegramTopicId: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    alertCpuPercent: { type: Number, default: 85 },
    alertCpuEnabled: { type: Boolean, default: true },
    alertRamPercent: { type: Number, default: 85 },
    alertRamEnabled: { type: Boolean, default: true },
    alertDiskPercent: { type: Number, default: 90 },
    alertDiskEnabled: { type: Boolean, default: true },
    alertTempLimit: { type: Number, default: 80 },
    alertTempEnabled: { type: Boolean, default: false },
    alertOfflineEnabled: { type: Boolean, default: true },
    alertServiceEnabled: { type: Boolean, default: true },
    alertContainerEnabled: { type: Boolean, default: true },
    alertDomainEnabled: { type: Boolean, default: true },
    alertSslDays: { type: Number, default: 14 },
    telegramCooldownSeconds: { type: Number, default: 300 },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
