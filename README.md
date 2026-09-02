# OBS Studio Connection

Control OBS Studio from [Bitfocus Buttons](https://bitfocus.io/buttons) or [Bitfocus Companion](https://bitfocus.io/companion). Switch scenes, control sources and audio, manage recording and streaming, and send custom WebSocket commands.

> [!IMPORTANT]
> Version 4 of this module requires:
>
> - Bitfocus Buttons 1.8 or newer
> - Companion 5.0 or newer
>
> OBS Studio 32.1 or newer is recommended.

## Quick start

1. In OBS Studio, open **Tools → WebSocket Server Settings**.
2. Enable the WebSocket server, then choose **Show Connect Info**.
3. In Buttons or Companion, add an **OBS Studio** connection.
4. Enter the server address, port, and password shown by OBS. The default port is `4455`.
5. Add an OBS action or feedback to a button.

Use a secure WebSocket (`wss`) only when your OBS WebSocket server or reverse proxy is configured for TLS.

## Documentation

- [Configuration and complete feature reference](companion/HELP.md)
- [Changelog](companion/CHANGELOG.md)
- [Report a bug or request a feature](https://github.com/bitfocus/companion-module-obs-studio/issues)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, pull requests, and the note on AI-assisted work. Coding agents should also read [AGENTS.md](AGENTS.md).

## License

Licensed under the [MIT License](LICENSE).
