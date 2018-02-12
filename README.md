# Web Run-Time Environment

[![Join the chat at https://gitter.im/wrte/Lobby](https://badges.gitter.im/wrte/Lobby.svg)](https://gitter.im/wrte/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![CircleCI status](https://circleci.com/gh/smokku/wrte.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/smokku/wrte)

WRTE is a microkernel-like environment to run untrusted applications in your browser.

![WRTE boot sequence](https://i.imgur.com/tbC96g1.png)

## Kernel

The kernel provides following services to facilitate apps:

### Processes

Untrusted apps run in iframe-sandbox + webworker jail limited as far as the browser allows.
Kernel provides methods to spawn, manage and kill processes.

### IPC

_Inter-Process Communication_ mechanism allows exchanging messages between processes
and processes and kernel. Messages can be sent in point-2-point manner or over two-way
channels providing context and ordering.

### VFS

_Virtual File-System_ uses two previous facilities to build hierarchical, dynamic and persistent
data access layer. Kernel provides mapping of paths to actual process handlers providing data content.

## Hierarchy

WRTE paths consist of a volume name and path. i.e. `volume:foo/bar`

Volumes are mapped to programmatic handlers processing messages for a given path. Messages like READ, SEEK, INFO, etc.

There is also an `assign` table, mapping parts of a path to another path.
For example `con:` is usually an assign to `internal:console`.

### internal:

There are few handlers provided by the kernel itself, not by externally launched processes.
These are required to bootstrap the system and to give managed access to browser features such as DOM,
not available to worker tasks in processes. These are all available at `internal:` volume.
Be careful not to over-assign `internal:` paths, as it will probably make your system inoperative.

## Shell

TBD (stdin/out/err channels of structured messages passed to subprocesses, power-shell like formatters, readline)

## Windowing

TBD (`internal:...` handler allowing opening a window to DOM, returning `channel` for controlling window content)

## Author

You may reach me at email: Tomasz Sterna <mailto:tomek@xiaoka.com>

## License

[AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)
