import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  UID
} from 'agora-rtc-sdk-ng';

// Agora configuration with your provided credentials
const AGORA_APP_ID = '53a4264e93ad45e48cf19b0fb73bc76e';
const AGORA_TOKEN = '007eJxTYPj9aYbKlDurZU4v/hx2aJeZHTP74WtCTHnpYMXENNXEIjnN0DLJIC3J3Dgp2dws9UxWREZDICND5ONTTIwMEAjiczMUlOYWJGcAiTIjBgYA9HAktg==';
const CHANNEL_NAME = 'pumpchumpv2';

export interface AgoraConfig {
  appId: string;
  channel: string;
  token?: string;
  uid?: UID;
}

export interface LocalTracks {
  videoTrack: ICameraVideoTrack | null;
  audioTrack: IMicrophoneAudioTrack | null;
}

export interface RemoteUser {
  uid: UID;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
}

export class AgoraService {
  private client: IAgoraRTCClient;
  private localTracks: LocalTracks = {
    videoTrack: null,
    audioTrack: null
  };
  private remoteUsers: Map<UID, RemoteUser> = new Map();
  private isJoined = false;

  constructor() {
    // Set log level for debugging
    AgoraRTC.setLogLevel(0); // 0 = debug, 1 = info, 2 = warning, 3 = error, 4 = none
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('user-published', async (user, mediaType) => {
      try {
        console.log('User published:', user.uid, mediaType);
        await this.client.subscribe(user, mediaType);
        
        const remoteUser = this.remoteUsers.get(user.uid) || { uid: user.uid };
        
        if (mediaType === 'video') {
          remoteUser.videoTrack = user.videoTrack;
          console.log('Video track received from user:', user.uid);
        } else if (mediaType === 'audio') {
          remoteUser.audioTrack = user.audioTrack;
          user.audioTrack?.play();
          console.log('Audio track received from user:', user.uid);
        }
        
        this.remoteUsers.set(user.uid, remoteUser);
        this.onRemoteUserUpdate?.(Array.from(this.remoteUsers.values()));
      } catch (error) {
        console.error('Error handling user-published:', error);
      }
    });

    this.client.on('user-unpublished', (user, mediaType) => {
      console.log('User unpublished:', user.uid, mediaType);
      const remoteUser = this.remoteUsers.get(user.uid);
      if (remoteUser) {
        if (mediaType === 'video') {
          remoteUser.videoTrack = undefined;
        } else if (mediaType === 'audio') {
          remoteUser.audioTrack = undefined;
        }
        
        if (!remoteUser.videoTrack && !remoteUser.audioTrack) {
          this.remoteUsers.delete(user.uid);
        } else {
          this.remoteUsers.set(user.uid, remoteUser);
        }
        
        this.onRemoteUserUpdate?.(Array.from(this.remoteUsers.values()));
      }
    });

    this.client.on('user-left', (user) => {
      console.log('User left:', user.uid);
      this.remoteUsers.delete(user.uid);
      this.onRemoteUserUpdate?.(Array.from(this.remoteUsers.values()));
    });

    this.client.on('connection-state-change', (curState, revState) => {
      console.log('Connection state changed from', revState, 'to', curState);
    });

    this.client.on('exception', (event) => {
      console.error('Agora exception:', event);
    });
  }

  public onRemoteUserUpdate?: (users: RemoteUser[]) => void;

  async joinChannel(uid?: UID): Promise<void> {
    // Check if already joined or connecting
    if (this.isJoined || this.client.connectionState !== 'DISCONNECTED') {
      console.log('Already joined or connecting to channel, current state:', this.client.connectionState);
      return;
    }

    try {
      console.log('Joining channel with params:', {
        appId: AGORA_APP_ID,
        channel: CHANNEL_NAME,
        token: AGORA_TOKEN ? 'Token provided' : 'No token',
        uid: uid,
        connectionState: this.client.connectionState
      });
      
      // Convert string UID to number if needed
      let finalUid: UID | null = uid || null;
      if (typeof uid === 'string') {
        // Convert string to a consistent number
        finalUid = parseInt(uid.slice(-6), 16) % 1000000;
      }
      
      console.log('Final UID:', finalUid);
      
      const result = await this.client.join(
        AGORA_APP_ID, 
        CHANNEL_NAME, 
        AGORA_TOKEN, 
        finalUid
      );
      
      console.log('Join result:', result);
      this.isJoined = true;
      console.log('Successfully joined channel:', CHANNEL_NAME);
      
    } catch (error) {
      console.error('Failed to join channel:', error);
      
      // Provide more specific error handling
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('invalid_app_id')) {
          throw new Error('Invalid App ID configuration');
        } else if (errorMessage.includes('invalid_token') || errorMessage.includes('token')) {
          throw new Error('Token authentication failed - token may be expired');
        } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
          throw new Error('Browser permissions denied - please allow camera/microphone access');
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          throw new Error('Network connection failed - please check your internet');
        } else if (errorMessage.includes('channel')) {
          throw new Error('Channel access failed - please try again');
        } else {
          throw new Error(`Connection failed: ${error.message}`);
        }
      }
      
      throw new Error('Unknown connection error occurred');
    }
  }

  async leaveChannel(): Promise<void> {
    if (!this.isJoined) {
      console.log('Not joined to any channel');
      return;
    }

    try {
      console.log('Leaving channel...');
      await this.stopLocalTracks();
      await this.client.leave();
      this.isJoined = false;
      this.remoteUsers.clear();
      this.onRemoteUserUpdate?.(Array.from(this.remoteUsers.values()));
      console.log('Successfully left channel');
    } catch (error) {
      console.error('Failed to leave channel:', error);
      throw error;
    }
  }

  async startLocalVideo(): Promise<ICameraVideoTrack> {
    if (this.localTracks.videoTrack) {
      return this.localTracks.videoTrack;
    }

    try {
      console.log('Starting local video...');
      this.localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "480p_1"
      });
      
      if (this.isJoined) {
        await this.client.publish(this.localTracks.videoTrack);
        console.log('Published video track');
      }
      
      return this.localTracks.videoTrack;
    } catch (error) {
      console.error('Failed to start local video:', error);
      throw error;
    }
  }

  async startLocalAudio(): Promise<IMicrophoneAudioTrack> {
    if (this.localTracks.audioTrack) {
      return this.localTracks.audioTrack;
    }

    try {
      console.log('Starting local audio...');
      this.localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      
      if (this.isJoined) {
        await this.client.publish(this.localTracks.audioTrack);
        console.log('Published audio track');
      }
      
      return this.localTracks.audioTrack;
    } catch (error) {
      console.error('Failed to start local audio:', error);
      throw error;
    }
  }

  async stopLocalVideo(): Promise<void> {
    if (this.localTracks.videoTrack) {
      console.log('Stopping local video...');
      if (this.isJoined) {
        try {
          await this.client.unpublish(this.localTracks.videoTrack);
        } catch (error) {
          console.warn('Failed to unpublish video track:', error);
          // Continue with cleanup even if unpublish fails
        }
      }
      this.localTracks.videoTrack.stop();
      this.localTracks.videoTrack.close();
      this.localTracks.videoTrack = null;
    }
  }

  async stopLocalAudio(): Promise<void> {
    if (this.localTracks.audioTrack) {
      console.log('Stopping local audio...');
      if (this.isJoined) {
        try {
          await this.client.unpublish(this.localTracks.audioTrack);
        } catch (error) {
          console.warn('Failed to unpublish audio track:', error);
          // Continue with cleanup even if unpublish fails
        }
      }
      this.localTracks.audioTrack.stop();
      this.localTracks.audioTrack.close();
      this.localTracks.audioTrack = null;
    }
  }

  async stopLocalTracks(): Promise<void> {
    await Promise.all([
      this.stopLocalVideo(),
      this.stopLocalAudio()
    ]);
  }

  getLocalTracks(): LocalTracks {
    return this.localTracks;
  }

  getRemoteUsers(): RemoteUser[] {
    return Array.from(this.remoteUsers.values());
  }

  isChannelJoined(): boolean {
    return this.isJoined;
  }

  getChannelName(): string {
    return CHANNEL_NAME;
  }
}

export const agoraService = new AgoraService();