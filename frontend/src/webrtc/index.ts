import type { IceServerConfig } from '../types/index.js';

const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onNegotiationNeeded?: () => void;
  onIceRestart?: (offer: RTCSessionDescriptionInit) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks = {};
  private iceServers: IceServerConfig[] = DEFAULT_ICE_SERVERS;
  private queuedCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    this.setupDeviceChangeListener();
  }

  private handleDeviceChange = async () => {
    console.log('[WebRTC] Device change detected. Attempting to reacquire media...');
    try {
      const stream = await this.getLocalMedia(true);
      
      if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
        const senders = this.peerConnection.getSenders();
        stream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch((e) => console.warn('[WebRTC] replaceTrack failed on device change:', e));
          }
        });
      }
    } catch (err) {
      console.error('[WebRTC] Failed to reacquire media on device change:', err);
    }
  };

  private setupDeviceChangeListener() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
    }
  }

  setCallbacks(callbacks: WebRTCCallbacks): void {
    this.callbacks = callbacks;
  }

  setIceServers(servers: IceServerConfig[]): void {
    this.iceServers = servers.length > 0 ? servers : DEFAULT_ICE_SERVERS;
  }

  private localStreamPromise: Promise<MediaStream> | null = null;

  async getLocalMedia(forceReacquire = false): Promise<MediaStream> {
    if (forceReacquire) {
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }
      this.localStreamPromise = null;
    }

    // If stream already exists and all tracks are active, return it directly
    if (this.localStream && this.localStream.getTracks().length > 0 && this.localStream.getTracks().every((t) => t.readyState === 'live')) {
      return this.localStream;
    }

    if (this.localStreamPromise) {
      return this.localStreamPromise;
    }

    console.log('[WebRTC] Requesting local media stream...');
    this.localStreamPromise = navigator.mediaDevices.getUserMedia({
      video: {
        // Use ideal (not exact) constraints — Safari will degrade gracefully
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user',
        frameRate: { ideal: 24, max: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        // autoGainControl omitted — not reliably supported on iOS Safari 14 and below
        // and can cause the entire getUserMedia call to fail
        sampleRate: 48000,
      },
    }).then((stream) => {
      this.localStream = stream;
      this.localStreamPromise = null;
      return stream;
    }).catch((err) => {
      this.localStreamPromise = null;
      // On error, strip the advanced constraints and retry with minimal config
      // This handles cases where the device doesn't support all requested constraints
      if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
          this.localStream = stream;
          return stream;
        });
      }
      throw err;
    });

    return this.localStreamPromise;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  createPeerConnection(): RTCPeerConnection {
    this.cleanupPeerConnection(true); // Keep early candidates for this match session

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    // Phase 3: Expose for automated WebRTC certification
    if (typeof window !== 'undefined') {
      (window as any).__kaboom_pc = this.peerConnection;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      this.callbacks.onRemoteStream?.(this.remoteStream);
    };

    let hasNonHostCandidate = false;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (event.candidate.type !== 'host') {
          hasNonHostCandidate = true;
        }
        this.callbacks.onIceCandidate?.(event.candidate.toJSON());
      } else {
        // ICE gathering complete
        if (!hasNonHostCandidate) {
          console.warn('[WebRTC] ICE gathering complete but only host candidates found. Fast-failing connection.');
          this.callbacks.onConnectionStateChange?.('failed' as RTCPeerConnectionState);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        this.callbacks.onConnectionStateChange?.(state);
      }
    };

    // Phase 4 (KS-003): Listen to ICE connection state for faster dead peer detection
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        const iceState = this.peerConnection.iceConnectionState;
        console.log(`[WebRTC] ICE Connection State: ${iceState}`);
        this.callbacks.onIceConnectionStateChange?.(iceState);
      }
    };

    this.peerConnection.onnegotiationneeded = () => {
      this.callbacks.onNegotiationNeeded?.();
    };

    return this.peerConnection;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) this.createPeerConnection();

    if (options?.iceRestart) {
      console.log('[WebRTC] ICE Restart requested. Clearing stale queued ICE candidates.');
      this.queuedCandidates = [];
    }

    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      ...options,
    });

    await this.peerConnection!.setLocalDescription(offer);
    return offer;
  }



  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) this.createPeerConnection();

    // E1: Explicit Rollback for perfect negotiation (polite peer accepting offer while in have-local-offer)
    if (this.peerConnection!.signalingState !== 'stable') {
      console.log('[WebRTC] Signaling state not stable (glare). Explicitly rolling back local description.');
      await Promise.all([
        this.peerConnection!.setLocalDescription({ type: 'rollback' }),
        this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer))
      ]);
    } else {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
    }

    await this.flushIceCandidates();

    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushIceCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('[WebRTC] Peer connection or remote description is null. Queueing ICE candidate.');
      this.queuedCandidates.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  private async flushIceCandidates(): Promise<void> {
    if (!this.peerConnection) return;
    console.log(`[WebRTC] Flushing ${this.queuedCandidates.length} queued ICE candidates.`);
    for (const candidate of this.queuedCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('[WebRTC] Failed to add flushed ICE candidate:', error);
      }
    }
    this.queuedCandidates = [];
  }

  toggleMute(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  toggleCamera(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  getStats(): Promise<RTCStatsReport> | null {
    return this.peerConnection?.getStats() ?? null;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState ?? null;
  }

  async verifyMediaFlow(): Promise<boolean> {
    const stats = await this.getStats();
    if (!stats) return false;
    let bytesReceived = 0;
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        bytesReceived += report.bytesReceived || 0;
      }
    });
    return bytesReceived > 0;
  }


  resetConnection(): void {
    this.cleanupPeerConnection(false); // Clean candidates on hard reset
  }

  private cleanupPeerConnection(keepCandidates = false): void {
    if (!keepCandidates) {
      this.queuedCandidates = [];
    }
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onnegotiationneeded = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
  }

  cleanup(): void {
    this.cleanupPeerConnection();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
    }
  }
}

export const webrtcManager = new WebRTCManager();
