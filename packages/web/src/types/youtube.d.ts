export {};

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    type PlayerState = -1 | 0 | 1 | 2 | 3 | 5;

    interface PlayerOptions {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number | boolean>;
      events?: {
        onReady?: (event: { target: Player }) => void;
        onStateChange?: (event: { data: PlayerState; target: Player }) => void;
        onError?: (event: { data: number; target: Player }) => void;
      };
    }

    class Player {
      constructor(elementId: string | HTMLElement, options: PlayerOptions);
      loadVideoById(videoId: string): void;
      cueVideoById(videoId: string): void;
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      setSize(width: number, height: number): void;
      destroy(): void;
      getPlayerState(): PlayerState;
      mute(): void;
      unMute(): void;
    }
  }
}
