declare module 'react-native-udp' {
  import { EventEmitter } from 'events';

  export class UdpSocket extends EventEmitter {
    bind(port: number, callback?: () => void): void;
    once(event: 'listening', listener: () => void): this;
    send(
      msg: import('buffer').Buffer | string,
      offset: number | undefined,
      length: number | undefined,
      port: number,
      address: string,
      callback?: (err?: Error) => void,
    ): void;
    close(): void;
  }

  const dgram: {
    createSocket(options: { type: 'udp4' | 'udp6' }): UdpSocket;
  };
  export default dgram;
}
