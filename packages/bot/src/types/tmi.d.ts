declare module "tmi.js" {
  export type ChatUserstate = {
    username?: string;
    "display-name"?: string;
  };

  export type ClientOptions = {
    options?: {
      debug?: boolean;
    };
    identity?: {
      username?: string;
      password?: string;
    };
    channels?: string[];
  };

  export class Client {
    constructor(options: ClientOptions);
    on(
      event: "message",
      callback: (channel: string, tags: ChatUserstate, message: string, self: boolean) => void | Promise<void>
    ): this;
    on(event: "connected", callback: (address: string, port: number) => void): this;
    on(event: "disconnected", callback: (reason: string) => void): this;
    say(channel: string, message: string): Promise<unknown>;
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown>;
  }

  const tmi: {
    Client: typeof Client;
  };
  export default tmi;
}
