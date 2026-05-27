import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  alertCpuPercent: number;
  alertCpuEnabled: boolean;
  alertRamPercent: number;
  alertRamEnabled: boolean;
  alertDiskPercent: number;
  alertDiskEnabled: boolean;
  alertTempLimit: number;
  alertTempEnabled: boolean;
  alertOfflineEnabled: boolean;
  telegramCooldownSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    telegramBotToken: { type: String, default: '' },
    telegramChatId: { type: String, default: '' },
    telegramTopicId: { type: String, default: '' },
    alertCpuPercent: { type: Number, default: 85 },
    alertCpuEnabled: { type: Boolean, default: true },
    alertRamPercent: { type: Number, default: 85 },
    alertRamEnabled: { type: Boolean, default: true },
    alertDiskPercent: { type: Number, default: 90 },
    alertDiskEnabled: { type: Boolean, default: true },
    alertTempLimit: { type: Number, default: 80 },
    alertTempEnabled: { type: Boolean, default: false },
    alertOfflineEnabled: { type: Boolean, default: true },
    telegramCooldownSeconds: { type: Number, default: 300 },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
