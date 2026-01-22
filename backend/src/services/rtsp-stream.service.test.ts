import jwt from 'jsonwebtoken';
import path from 'path';
import { rtspStreamService } from './rtsp-stream.service';
import { AppError } from '../utils/errors';
import { config } from '../config';

describe('RtspStreamService', () => {
  const cameraId = 'camera-123';
  const companyId = 'company-456';

  it('creates and verifies stream tokens', () => {
    // TEST-ONLY: Token payloads should round-trip for authenticated requests.
    const token = rtspStreamService.createStreamToken(cameraId, companyId);
    const payload = rtspStreamService.verifyStreamToken(token);

    expect(payload.cameraId).toBe(cameraId);
    expect(payload.companyId).toBe(companyId);
    expect(payload.scope).toBe('camera-stream');
  });

  it('rejects tokens with invalid scope', () => {
    // TEST-ONLY: Tokens with the wrong scope should be rejected.
    const token = jwt.sign(
      { scope: 'invalid-scope', cameraId, companyId },
      config.jwt.secret,
      { expiresIn: 60 }
    );

    expect(() => rtspStreamService.verifyStreamToken(token)).toThrow(AppError);
    expect(() => rtspStreamService.verifyStreamToken(token)).toThrow('Invalid stream token scope');
  });

  it('rejects expired tokens', () => {
    // TEST-ONLY: Expired tokens should be rejected with a stream token error.
    const token = jwt.sign(
      { scope: 'camera-stream', cameraId, companyId },
      config.jwt.secret,
      { expiresIn: '-1s' }
    );

    expect(() => rtspStreamService.verifyStreamToken(token)).toThrow(AppError);
    try {
      rtspStreamService.verifyStreamToken(token);
    } catch (err) {
      expect((err as AppError).code).toBe('STREAM_TOKEN_EXPIRED');
    }
  });

  it('rejects invalid stream file paths', () => {
    // TEST-ONLY: Invalid filenames should be blocked to prevent traversal.
    expect(() => rtspStreamService.resolveStreamFilePath(cameraId, '../secret')).toThrow(AppError);
    expect(() => rtspStreamService.resolveStreamFilePath(cameraId, 'clip.mp4')).toThrow(AppError);
  });

  it('resolves valid stream file paths', () => {
    // TEST-ONLY: Valid HLS filenames should resolve under the camera directory.
    const resolved = rtspStreamService.resolveStreamFilePath(cameraId, 'index.m3u8');
    expect(resolved).toContain(path.join(cameraId, 'index.m3u8'));
  });
});
