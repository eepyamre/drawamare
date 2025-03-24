# Draw A Mare 2

A real-time collaborative drawing application built with Pixi.js, Socket.IO, Node.js, and TypeScript. Users can draw on a shared canvas, with changes synchronized in near real-time.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-time Collaboration:** Draw and see other users' strokes in near real-time.
- **Multiple Layers per User:** Organize your drawings using multiple layers.
- **Layer Management (Basic):** Add and select layers through a simple user interface.
- **Undo/Redo:** Every user has separate undo/redo stack.
- **Erase Functionality:** Basic eraser tool.
- **Zoom & Pan:** Zoom in and out and pan across the canvas.

**Under Development:**

- Layer Reordering
- Enhanced Drawing Tools
- User Authentication
- Persistence

## Tech Stack

- **Frontend:**
  - TypeScript
  - Pixi.js (for canvas rendering)
  - Socket.IO Client (for real-time communication)
- **Backend:**
  - Node.js
  - TypeScript
  - Socket.IO Server (for real-time communication)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/eepyamre/drawamarejs
    cd drawamarejs
    ```

2.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

### Running the Application

1.  Start the backend server:

    ```bash
    cd server
    npm run dev # or yarn dev
    ```

    This will start the server on `http://localhost:3000`.

2.  Start the frontend development server:

    ```bash
    cd client
    npm run dev # or yarn dev
    ```

    This will start the frontend development server. It will likely be served on `http://localhost:8080` but check the terminal output for the exact URL.

3.  Open your browser and navigate to the frontend URL.

## Project Structure

```sh

drawamare/
├── client/ # Frontend code
│ ├── public/ # Static assets (HTML, CSS, images)
│ ├── src/ # Frontend source code
│ │ ├── utils/ # Utility functions and types
│ │ ├── ui.ts # Layer UI logic
│ │ ├── main.ts # Main application entry point
├── server/ # Backend code
│ ├── src/ # Backend source code
│ │ ├── server.ts # Main server file
└── README.md # This file

```
