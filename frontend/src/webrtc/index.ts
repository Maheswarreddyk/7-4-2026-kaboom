import type { IceServerConfig } from '../types/index.js';

const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
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

  private setupDeviceChangeListener() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
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
      });
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
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }).then((stream) => {
      this.localStream = stream;
      this.localStreamPromise = null;
      console.log('[WebRTC] Local media stream acquired successfully.');
      return stream;
    }).catch((err) => {
      this.localStreamPromise = null;
      console.error('[WebRTC] Failed to acquire local media stream:', err);
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

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        this.callbacks.onConnectionStateChange?.(state);

        // Phase 2: High-End WebRTC Resiliency (ICE Restart)
        if (state === 'failed') {
          console.warn('[WebRTC] Connection failed. Triggering ICE Restart...');
          this.triggerIceRestart();
        }
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

  async triggerIceRestart(): Promise<void> {
    if (!this.peerConnection) return;
    try {
      console.log('[WebRTC] Generating ICE Restart Offer...');
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      this.callbacks.onIceRestart?.(offer);
    } catch (e) {
      console.error('[WebRTC] ICE Restart failed:', e);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) this.createPeerConnection();

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
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
  }
}

export const webrtcManager = new WebRTCManager();
