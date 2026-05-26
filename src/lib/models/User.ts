import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  telegramBotToken?: string;
  telegramChatId?: string;
  alertCpuPercent: number;
  alertRamPercent: number;
  alertDiskPercent: number;
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
    alertCpuPercent: { type: Number, default: 85 },
    alertRamPercent: { type: Number, default: 85 },
    alertDiskPercent: { type: Number, default: 90 },
    telegramCooldownSeconds: { type: Number, default: 300 },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
