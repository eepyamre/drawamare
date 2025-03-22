### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user interface and canvas rendering using Pixi.js.
   - Currently focuses on setting up the development environment and basic drawing functionalities.
   - Real-time synchronization via WebSocket (Socket.IO) is planned but **not yet implemented**.

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections and coordinates real-time drawing updates.
   - Tracks each user’s layer data in memory (strokes drawn by each user).
   - Broadcasts drawing actions to all connected clients.
   - **Not yet implemented**.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Each user implicitly has their own drawing space within the Pixi.js Stage on the frontend, managed by a `Container` in `src/main.ts`.
   - Currently, there's a single canvas layer setup using PixiJS, but explicit user layer management is not yet implemented beyond this basic setup.

2. **Basic Undo/Redo**:

   - **Undo**: Implemented on the client-side in `src/main.ts`. It utilizes a `historyStack` to store previous states of the canvas as `RenderTexture`s. When undo is triggered, it reverts to the previous state from the history.
   - **Redo**: Implemented on the client-side in `src/main.ts` using a `redoStack`. It allows re-applying states that were previously undone.
   - **Both undo and redo are client-side only and operate on the local canvas state.** The server does not have undo/redo functionality.

3. **Real-Time Sync**:
   - All users will eventually see drawing updates in near real-time when others draw. Achieved using Socket.IO for broadcasting drawing and undo actions.
   - **Real-time synchronization is planned but not yet implemented.**

---

### **Tech Stack**

| **Component**        | **Frontend**          | **Backend**                      |
| -------------------- | --------------------- | -------------------------------- |
| **Framework**        | Vanilla JavaScript    | Node.js                          |
| **Canvas Library**   | Pixi.js               | N/A (backend handles logic only) |
| **Real-Time Sync**   | Socket.IO Client      | Socket.IO Server                 |
| **Networking**       | WebSocket (Socket.IO) | WebSocket (Socket.IO)            |
| **State Management** | Vanilla JavaScript    | In-memory state                  |
| **Styling**          | CSS                   | N/A                              |

_Note: Frontend styling is currently using plain CSS as seen in `client/public/style.css`, not CSS Modules as previously stated._

---

### **Implementation Steps**

#### **1. Frontend (Client-Side)**

- **Canvas Setup**:

  - Uses Pixi.Stage and Pixi.Graphics to manage the drawing canvas.
  - The `index.html` file sets up the basic HTML structure with a `div` for the PixiJS canvas (`pixi-container`).
  - **Initial setup for PixiJS canvas is implemented in `src/main.ts`. This includes:**
    - Initializing a PixiJS `Application`.
    - Setting up a `Container` to hold drawing elements, positioned in the center of the canvas.
    - Creating a `Graphics` object as a mask and background for the canvas area.
    - Utilizing a `RenderTexture` and `Sprite` to efficiently render and store the drawing.
    - Handling window resize events to adjust the canvas.
    - Implementing zoom functionality using the mouse wheel to scale the stage.

- **Drawing Input**:

  - **Drawing input is implemented in `src/main.ts`:**
    - Listens to `pointerdown`, `pointermove`, and `pointerup` events on the Pixi.Stage to capture drawing actions.
    - On `pointerdown`, initiates drawing a new stroke using `Graphics`. Supports different stroke styles (color, width, cap).
    - On `pointermove`, draws lines based on pointer movement, creating free-hand drawing effect.
    - On `pointerup`, finalizes the stroke by rendering it onto the `RenderTexture` and saving the canvas state to the history stack for undo/redo.
    - Implements a basic eraser functionality toggled by the 'e' key, which changes the blend mode and stroke width.
    - Implements panning functionality using the middle mouse button to move the canvas.

- **Real-Time Updates**:

  - **Real-time update handling is not yet implemented.**

- **Undo/Redo**:
  - **Undo/Redo functionality is implemented in `src/main.ts`:**
    - **Undo**: Triggered by 'Ctrl+Z' or 'Cmd+Z'. Reverts the canvas to the previous state by loading a `RenderTexture` from the `historyStack`.
    - **Redo**: Triggered by 'Ctrl+Shift+Z' or 'Cmd+Shift+Z'. Re-applies a previously undone state from the `redoStack`.
    - Saves canvas states to `historyStack` before each stroke completion and manages `redoStack` appropriately.
    - Limits the `historyStack` to `maxHistoryLength` defined in `src/utils/consts.ts`.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - Uses Socket.IO to handle WebSocket connections.
  - Manages user connections and in-memory storage of user layers (currently just tracking the last action for undo, not full layer history persistence).
  - **Backend server is not yet implemented.**

#### **3. Data Flow**

1. **User Draws**: User draws on the canvas → Frontend captures stroke → Renders stroke locally onto the `RenderTexture`.
2. **Undo/Redo**: User triggers undo/redo → Frontend manipulates `historyStack` and `redoStack` and re-renders the canvas with a state from the history.

_Currently, the data flow is limited to local client-side drawing and undo/redo functionalities._

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers (or strokes) in the database.
  - Load layers from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs**

- **Real-time Synchronization**:

  - **TODO**: Implement WebSocket (Socket.IO) for real-time drawing synchronization. This is a major next step.

- **Undo/Redo Improvement**:

  - **Current Status**: Basic client-side undo/redo is implemented.
  - **TODO**: Implement server-side undo/redo to synchronize undo actions across clients when real-time features are added.

- **Persistence**:

  - **TODO**: Implement database persistence to save drawing sessions. Consider using Redis for fast in-memory data store or a more persistent database like Redis depending on requirements.

- **Scalability**:

  - **TODO**: For increased scalability, especially with more users, implement the backend server and Socket.IO communication.
    - Implement Socket.IO rooms more effectively if needed (currently using user ID as room, which might not be optimal for broadcasting to all).
    - Explore using Redis for distributed state management if scaling across multiple server instances.
    - Consider optimizing Pixi.js rendering for complex canvases (culling is already added via `CullerPlugin` but further optimization may be needed).

- **Security**:

  - **TODO**: Implement user authentication to ensure only authorized users can participate in drawing sessions when backend is implemented. JWT or OAuth could be considered.
  - **TODO**: Consider security implications of broadcasting drawing data and implement necessary measures if sensitive information is involved (though likely not for a basic drawing app).

- **Error Handling**:

  - **TODO**: Implement more robust error handling on the client, especially for edge cases in drawing and state management. Once backend and real-time features are added, extend error handling to the server and socket communication.

- **Usernames and User Interface**:

  - **TODO**: Display usernames of users connected to the canvas (requires backend and user management).
  - **TODO**: Display layers and ability to create new layer for each user. This will allow users to see their own drawings separately from others.
  - **TODO**: Improve the UI/UX with more drawing tools (colors, brush sizes, different brush types, clear canvas button, etc.).

- **Drawing Functionality**:

  - **Current Status**: Basic free-hand drawing on the PixiJS canvas using mouse events is implemented.
  - **TODO**: Expand drawing functionality with more advanced features like shapes, text, image import, etc.
  - **TODO**: Add support for different brush types (e.g., eraser, pencil, etc.) with customizable settings.

- **Testing**:
  - **TODO**: Implement unit and integration tests for the frontend to ensure drawing, state management, and UI functionalities are stable. Once backend is implemented, add tests for backend and real-time communication.
