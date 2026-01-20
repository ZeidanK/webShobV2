import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ICamera } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

type StreamProcessState = {
  process: ChildProcessWithoutNullStreams;
  outputDir: string;
  lastUsedAt: number;
};

type StreamTokenPayload = {
  scope: 'camera-stream';
  cameraId: string;
  companyId: string;
  iat?: number;
  exp?: number;
};

class RtspStreamService {
  // TEST-ONLY: Track active RTSP-to-HLS pipelines in memory.
  private processes = new Map<string, StreamProcessState>();
  // TEST-ONLY: Resolve streaming base dir once for consistent path handling.
  private baseDir = path.resolve(config.streaming.baseDir);

  constructor() {
    // TEST-ONLY: Ensure base stream directory exists on startup.
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  // TEST-ONLY: Sanitize RTSP URLs before logging to avoid secrets leakage.
  private sanitizeRtspUrl(rtspUrl: string): string {
    try {
      const parsed = new URL(rtspUrl);
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    } catch {
      return 'rtsp://redacted';
    }
  }
  // TEST-ONLY: Run a short FFmpeg probe to validate RTSP connectivity.
  async testRtspConnection(
    rtspUrl: string,
    transport: 'tcp' | 'udp' = 'tcp'
  ): Promise<{ success: boolean; message: string }> {
    const ffmpegCheck = spawnSync(config.streaming.ffmpegPath, ['-version'], { stdio: 'ignore' });
    if (ffmpegCheck.error) {
      if ((ffmpegCheck.error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, message: 'FFmpeg is not installed' };
      }
      return { success: false, message: 'FFmpeg probe failed to start' };
    }

    const probeArgs = [
      '-rtsp_transport',
      transport,
      '-i',
      rtspUrl,
      '-t',
      '1',
      '-f',
      'null',
      '-',
    ];
    const result = spawnSync(config.streaming.ffmpegPath, probeArgs, {
      stdio: 'pipe',
      timeout: 8000,
    });

    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === 'ETIMEDOUT') {
        return { success: false, message: 'RTSP probe timed out' };
      }
      return { success: false, message: 'RTSP probe failed to start' };
    }

    if (result.status === 0) {
      return { success: true, message: 'RTSP connection succeeded' };
    }

    logger.warn({
      action: 'rtsp.probe.failed',
      rtspUrl: this.sanitizeRtspUrl(rtspUrl),
      code: result.status,
      stderr: result.stderr?.toString().slice(0, 300),
    });

    return { success: false, message: 'RTSP connection failed' };
  }

  // TEST-ONLY: Build and validate per-camera HLS output folder.
  private ensureOutputDir(cameraId: string): string {
    const safeCameraId = path.basename(cameraId);
    const outputDir = path.join(this.baseDir, safeCameraId);
    fs.mkdirSync(outputDir, { recursive: true });
    return outputDir;
  }

  // TEST-ONLY: Start or reuse an FFmpeg pipeline for a direct-rtsp camera.
  async ensureStream(camera: ICamera): Promise<string> {
    if (camera.streamConfig?.type !== 'direct-rtsp') {
      throw new AppError('STREAM_TYPE_INVALID', 'Camera is not configured for direct-rtsp streaming', 400);
    }
    const rtspUrl = camera.streamConfig?.rtspUrl;
    if (!rtspUrl) {
      throw new AppError('RTSP_CONFIG_INVALID', 'RTSP URL is required for direct-rtsp streaming', 400);
    }

    const cameraId = camera._id.toString();
    const existing = this.processes.get(cameraId);
    if (existing && existing.process.exitCode === null) {
      existing.lastUsedAt = Date.now();
      return existing.outputDir;
    }

    // TEST-ONLY: Enforce a max process limit to protect backend resources.
    if (this.processes.size >= config.streaming.maxProcesses) {
      const sorted = [...this.processes.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
      const [oldestId, oldestState] = sorted[0] || [];
      if (oldestId && oldestState) {
        oldestState.process.kill('SIGTERM');
        this.processes.delete(oldestId);
        logger.warn({
          action: 'rtsp.stream.evict',
          cameraId: oldestId,
          reason: 'max_processes',
        });
      }
    }

    const outputDir = this.ensureOutputDir(cameraId);
    const playlistPath = path.join(outputDir, 'index.m3u8');
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    // TEST-ONLY: Fail fast if FFmpeg is not installed on the host.
    const ffmpegCheck = spawnSync(config.streaming.ffmpegPath, ['-version'], { stdio: 'ignore' });
    if (ffmpegCheck.error) {
      if ((ffmpegCheck.error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError('FFMPEG_NOT_INSTALLED', 'FFmpeg is required for direct-rtsp streaming', 500);
      }
      throw ffmpegCheck.error;
    }

    const baseArgs = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-an',
    ];
    const codecArgs = config.streaming.transcodeEnabled
      ? [
          // TEST-ONLY: Transcode for compatibility when direct copy fails.
          '-c:v', 'libx264',
          '-preset', config.streaming.transcodePreset,
          '-tune', 'zerolatency',
          '-pix_fmt', 'yuv420p',
        ]
      : [
          // TEST-ONLY: Prefer stream copy for low CPU usage.
          '-c:v', 'copy',
        ];
    const hlsArgs = [
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_filename', segmentPattern,
      playlistPath,
    ];

    // TEST-ONLY: Spawn FFmpeg without a shell to avoid injection risk.
    const ffmpegArgs = [...baseArgs, ...codecArgs, ...hlsArgs];

    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(config.streaming.ffmpegPath, ffmpegArgs, { stdio: 'pipe' });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        throw new AppError('FFMPEG_NOT_INSTALLED', 'FFmpeg is required for direct-rtsp streaming', 500);
      }
      throw err;
    }

    proc.on('exit', (code, signal) => {
      // TEST-ONLY: Clean up process cache when FFmpeg exits.
      this.processes.delete(cameraId);
      logger.warn({
        action: 'rtsp.stream.exit',
        cameraId,
        code,
        signal,
      });
    });

    proc.stderr.on('data', (data) => {
      // TEST-ONLY: Log FFmpeg stderr for troubleshooting without exposing RTSP credentials.
      logger.debug({
        action: 'rtsp.stream.stderr',
        cameraId,
        message: data.toString().slice(0, 500),
        rtspUrl: this.sanitizeRtspUrl(rtspUrl),
      });
    });

    this.processes.set(cameraId, {
      process: proc,
      outputDir,
      lastUsedAt: Date.now(),
    });

    return outputDir;
  }

  // TEST-ONLY: Build a short-lived token for browser access to HLS assets.
  createStreamToken(cameraId: string, companyId: string): string {
    const payload: StreamTokenPayload = {
      scope: 'camera-stream',
      cameraId,
      companyId,
    };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.streaming.tokenTtlSeconds });
  }

  // TEST-ONLY: Validate stream tokens for HLS asset requests.
  verifyStreamToken(token: string): StreamTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as StreamTokenPayload;
      if (decoded.scope !== 'camera-stream') {
        throw new AppError('STREAM_TOKEN_INVALID', 'Invalid stream token scope', 401);
      }
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('STREAM_TOKEN_EXPIRED', 'Stream token expired', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('STREAM_TOKEN_INVALID', 'Invalid stream token', 401);
      }
      throw error;
    }
  }

  // TEST-ONLY: Resolve the HLS asset path while preventing traversal.
  resolveStreamFilePath(cameraId: string, filename: string): string {
    const safeCameraId = path.basename(cameraId);
    const safeFilename = path.basename(filename);
    if (!/^[a-zA-Z0-9._-]+$/.test(safeFilename)) {
      throw new AppError('STREAM_FILE_INVALID', 'Invalid stream file name', 400);
    }
    const ext = path.extname(safeFilename);
    if (!['.m3u8', '.ts'].includes(ext)) {
      throw new AppError('STREAM_FILE_INVALID', 'Invalid stream file type', 400);
    }
    return path.join(this.baseDir, safeCameraId, safeFilename);
  }

  // TEST-ONLY: Remove idle FFmpeg pipelines to limit resource usage.
  cleanupIdleStreams(): void {
    const now = Date.now();
    for (const [cameraId, state] of this.processes.entries()) {
      if (now - state.lastUsedAt > config.streaming.idleTimeoutMs) {
        state.process.kill('SIGTERM');
        this.processes.delete(cameraId);
        logger.info({
          action: 'rtsp.stream.cleanup',
          cameraId,
        });
      }
    }
  }
}

export const rtspStreamService = new RtspStreamService();
