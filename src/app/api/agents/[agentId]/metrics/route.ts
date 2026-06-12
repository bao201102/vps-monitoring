import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Metric } from '@/lib/models/Metric';
import { Agent } from '@/lib/models/Agent';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '1h';

  const now = Date.now();
  let fromMs = now - 60 * 60 * 1000;
  if (range === '6h') fromMs = now - 6 * 60 * 60 * 1000;
  else if (range === '24h') fromMs = now - 24 * 60 * 60 * 1000;
  else if (range === '7d') fromMs = now - 7 * 24 * 60 * 60 * 1000;

  let bucketSizeMs = 1 * 60 * 1000; // 1m
  if (range === '6h') bucketSizeMs = 5 * 60 * 1000; // 5m
  else if (range === '24h') bucketSizeMs = 15 * 60 * 1000; // 15m
  else if (range === '7d') bucketSizeMs = 2 * 60 * 60 * 1000; // 2h

  await connectDB();
  const agentExists = await Agent.findOne({ agentId: params.agentId, userId: session.sub });
  if (!agentExists) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const rows = await Metric.aggregate([
    {
      $match: {
        agentId: params.agentId,
        ts: { $gte: new Date(fromMs) },
      },
    },
    {
      $group: {
        _id: {
          $toDate: {
            $subtract: [
              { $toLong: '$ts' },
              { $mod: [{ $toLong: '$ts' }, bucketSizeMs] },
            ],
          },
        },
        cpuPercent: { $avg: '$cpuPercent' },
        memUsedBytes: { $avg: '$memUsedBytes' },
        memTotalBytes: { $last: '$memTotalBytes' },
        swapUsedBytes: { $avg: '$swapUsedBytes' },
        swapTotalBytes: { $last: '$swapTotalBytes' },
        diskUsedBytes: { $avg: '$diskUsedBytes' },
        diskTotalBytes: { $last: '$diskTotalBytes' },
        diskReadBps: { $avg: '$diskReadBps' },
        diskWriteBps: { $avg: '$diskWriteBps' },
        netRxBps: { $avg: '$netRxBps' },
        netTxBps: { $avg: '$netTxBps' },
        dockerCpuPercent: { $avg: '$dockerCpuPercent' },
        dockerMemUsedBytes: { $avg: '$dockerMemUsedBytes' },
        dockerNetRxBps: { $avg: '$dockerNetRxBps' },
        dockerNetTxBps: { $avg: '$dockerNetTxBps' },
        dockerContainerCount: { $last: '$dockerContainerCount' },
        temperatureC: { $avg: '$temperatureC' },
        temperatures: { $last: '$temperatures' },
        gpuUtilPercent: { $avg: '$gpuUtilPercent' },
        gpuMemUsedBytes: { $avg: '$gpuMemUsedBytes' },
        gpuMemTotalBytes: { $last: '$gpuMemTotalBytes' },
        gpuPowerWatts: { $avg: '$gpuPowerWatts' },
        loadAvg1: { $avg: '$loadAvg1' },
        loadAvg5: { $avg: '$loadAvg5' },
        loadAvg15: { $avg: '$loadAvg15' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const metrics = rows.map((m) => ({
    ts: m._id,
    cpuPercent: m.cpuPercent ?? 0,
    memUsedBytes: m.memUsedBytes ?? 0,
    memTotalBytes: m.memTotalBytes ?? 0,
    swapUsedBytes: m.swapUsedBytes ?? 0,
    swapTotalBytes: m.swapTotalBytes ?? 0,
    diskUsedBytes: m.diskUsedBytes ?? 0,
    diskTotalBytes: m.diskTotalBytes ?? 0,
    diskReadBps: m.diskReadBps ?? 0,
    diskWriteBps: m.diskWriteBps ?? 0,
    netRxBps: m.netRxBps ?? 0,
    netTxBps: m.netTxBps ?? 0,
    dockerCpuPercent: m.dockerCpuPercent ?? 0,
    dockerMemUsedBytes: m.dockerMemUsedBytes ?? 0,
    dockerNetRxBps: m.dockerNetRxBps ?? 0,
    dockerNetTxBps: m.dockerNetTxBps ?? 0,
    dockerContainerCount: m.dockerContainerCount ?? 0,
    temperatureC: m.temperatureC ?? 0,
    temperatures: m.temperatures || {},
    gpuUtilPercent: m.gpuUtilPercent ?? 0,
    gpuMemUsedBytes: m.gpuMemUsedBytes ?? 0,
    gpuMemTotalBytes: m.gpuMemTotalBytes ?? 0,
    gpuPowerWatts: m.gpuPowerWatts ?? 0,
    loadAvg1: m.loadAvg1 ?? 0,
    loadAvg5: m.loadAvg5 ?? 0,
    loadAvg15: m.loadAvg15 ?? 0,
  }));

  return NextResponse.json({ metrics });
}
