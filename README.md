# Draw A Mare 2

## Quick Start

### Option 1: Run Locally

```sh
# Start the spacetime server
$ spacetime start
```

```sh
# Generate TypeScript bindings and publish the project
$ spacetime generate --lang typescript --out-dir ./client/src/module_bindings --project-path ./server
$ spacetime publish --project-path ./server drawamare

# Start the client
$ cd client
$ npm i
$ npm run dev
```

### Option 2: Run with Docker

```sh
$ docker-compose up --build
```

## Hotkeys

- **Ctrl + Z** — Undo
- **Ctrl + Shift + Z** — Redo
- **E** — Toggle Eraser
- **Delete** — Clear Current Layer
- **+ / Mouse Wheel Up / Ctrl + Space + Vertical Mouse Move Up** — Zoom In
- **– / Mouse Wheel Down / Ctrl + Space + Vertical Mouse Move Down** — Zoom Out
- **Space + Mouse Drag** — Move Canvas
