import {
  Accessor,
  JSX,
  Setter,
  batch,
  createContext,
  createSignal,
  useContext,
} from "solid-js";
import { RoomContext } from "solid-livekit-components";

import { Room, RoomEvent } from "livekit-client";
import { DenoiseTrackProcessor } from "livekit-rnnoise-processor";
import { Channel } from "stoat.js";

import { useState } from "@revolt/state";
import {
  type ScreenShareFrameRate,
  type ScreenShareResolution,
  Voice as VoiceSettings,
} from "@revolt/state/stores/Voice";
import { VoiceCallCardContext } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { CONFIGURATION } from "@revolt/common";
import { InRoom } from "./components/InRoom";
import { RoomAudioManager } from "./components/RoomAudioManager";
import {
  buildDefaultPublishDefaults,
  buildScreenShareOptions,
} from "./screenShareOptions";

type State =
  | "READY"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

class Voice {
  #settings: VoiceSettings;

  channel: Accessor<Channel | undefined>;
  #setChannel: Setter<Channel | undefined>;

  room: Accessor<Room | undefined>;
  #setRoom: Setter<Room | undefined>;

  state: Accessor<State>;
  #setState: Setter<State>;

  deafen: Accessor<boolean>;
  #setDeafen: Setter<boolean>;

  microphone: Accessor<boolean>;
  #setMicrophone: Setter<boolean>;

  video: Accessor<boolean>;
  #setVideo: Setter<boolean>;

  screenshare: Accessor<boolean>;
  #setScreenshare: Setter<boolean>;

  constructor(voiceSettings: VoiceSettings) {
    this.#settings = voiceSettings;

    const [channel, setChannel] = createSignal<Channel>();
    this.channel = channel;
    this.#setChannel = setChannel;

    const [room, setRoom] = createSignal<Room>();
    this.room = room;
    this.#setRoom = setRoom;

    const [state, setState] = createSignal<State>("READY");
    this.state = state;
    this.#setState = setState;

    const [deafen, setDeafen] = createSignal<boolean>(false);
    this.deafen = deafen;
    this.#setDeafen = setDeafen;

    const [microphone, setMicrophone] = createSignal(false);
    this.microphone = microphone;
    this.#setMicrophone = setMicrophone;

    const [video, setVideo] = createSignal(false);
    this.video = video;
    this.#setVideo = setVideo;

    const [screenshare, setScreenshare] = createSignal(false);
    this.screenshare = screenshare;
    this.#setScreenshare = setScreenshare;
  }

  async connect(channel: Channel, auth?: { url: string; token: string }) {
    this.disconnect();

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        deviceId: this.#settings.preferredAudioInputDevice,
        echoCancellation: this.#settings.echoCancellation,
        noiseSuppression: this.#settings.noiseSupression === "browser",
      },
      audioOutput: {
        deviceId: this.#settings.preferredAudioOutputDevice,
      },
      publishDefaults: buildDefaultPublishDefaults(
        this.#settings.screenShareResolution,
        this.#settings.screenShareFrameRate,
      ),
    });

    batch(() => {
      this.#setRoom(room);
      this.#setChannel(channel);
      this.#setState("CONNECTING");

      this.#setMicrophone(false);
      this.#setDeafen(false);
      this.#setVideo(false);
      this.#setScreenshare(false);
    });

    room.addListener("connected", () => {
      this.#setState("CONNECTED");
      new Audio(`${import.meta.env.BASE_URL}assets/sounds/connect.mp3`).play();
      if (this.speakingPermission)
        room.localParticipant.setMicrophoneEnabled(true).then((track) => {
          this.#setMicrophone(typeof track !== "undefined");
          if (this.#settings.noiseSupression === "enhanced") {
            track?.audioTrack?.setProcessor(
              new DenoiseTrackProcessor({
                workletCDNURL: CONFIGURATION.RNNOISE_WORKLET_CDN_URL,
              }),
            );
          }
        });
    });

    room.addListener("disconnected", () => this.#setState("DISCONNECTED"));

    room.addListener(RoomEvent.ParticipantConnected, () => {
      if (!this.deafen()) {
        new Audio(
          `${import.meta.env.BASE_URL}assets/sounds/connect.mp3`,
        ).play();
      }
    });

    room.addListener(RoomEvent.ParticipantDisconnected, () => {
      if (!this.deafen()) {
        new Audio(
          `${import.meta.env.BASE_URL}assets/sounds/disconnect.mp3`,
        ).play();
      }
    });

    if (!auth) {
      auth = await channel.joinCall("worldwide");
    }

    await room.connect(auth.url, auth.token, {
      autoSubscribe: false,
    });
  }

  disconnect() {
    const room = this.room();
    if (!room) return;

    new Audio(`${import.meta.env.BASE_URL}assets/sounds/disconnect.mp3`).play();

    room.removeAllListeners();
    room.disconnect();

    batch(() => {
      this.#setState("READY");
      this.#setRoom(undefined);
      this.#setChannel(undefined);
    });
  }

  async toggleDeafen() {
    this.#setDeafen((s) => !s);
  }

  async toggleMute() {
    const room = this.room();
    if (!room) throw "invalid state";
    await room.localParticipant.setMicrophoneEnabled(
      !room.localParticipant.isMicrophoneEnabled,
    );

    this.#setMicrophone(room.localParticipant.isMicrophoneEnabled);
  }

  async toggleCamera() {
    const room = this.room();
    if (!room) throw "invalid state";
    await room.localParticipant.setCameraEnabled(
      !room.localParticipant.isCameraEnabled,
    );

    this.#setVideo(room.localParticipant.isCameraEnabled);
  }

  async toggleScreenshare(
    resolution?: ScreenShareResolution,
    frameRate?: ScreenShareFrameRate,
  ) {
    const room = this.room();
    if (!room) throw "invalid state";
    const enabling = !room.localParticipant.isScreenShareEnabled;

    if (enabling) {
      const res = resolution ?? this.#settings.screenShareResolution;
      const fps = frameRate ?? this.#settings.screenShareFrameRate;

      // Persist chosen quality as the new default
      this.#settings.screenShareResolution = res;
      this.#settings.screenShareFrameRate = fps;

      const { captureOptions, publishOptions } = buildScreenShareOptions(
        res,
        fps,
      );
      await room.localParticipant.setScreenShareEnabled(
        true,
        captureOptions,
        publishOptions,
      );
    } else {
      await room.localParticipant.setScreenShareEnabled(false);
    }

    this.#setScreenshare(room.localParticipant.isScreenShareEnabled);
  }

  getConnectedUser(userId: string) {
    return this.room()?.getParticipantByIdentity(userId);
  }

  get listenPermission() {
    return !!this.channel()?.havePermission("Listen");
  }

  get speakingPermission() {
    return !!this.channel()?.havePermission("Speak");
  }
}

const voiceContext = createContext<Voice>(null as unknown as Voice);

/**
 * Mount global voice context and room audio manager
 */
export function VoiceContext(props: { children: JSX.Element }) {
  const state = useState();
  const voice = new Voice(state.voice);

  return (
    <voiceContext.Provider value={voice}>
      <RoomContext.Provider value={voice.room}>
        <VoiceCallCardContext>{props.children}</VoiceCallCardContext>
        <InRoom>
          <RoomAudioManager />
        </InRoom>
      </RoomContext.Provider>
    </voiceContext.Provider>
  );
}

export const useVoice = () => useContext(voiceContext);
