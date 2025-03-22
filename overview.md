### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user interface and canvas rendering using Pixi.js.
   - Implements drawing functionalities, user interaction, and real-time synchronization via WebSocket (Socket.IO).
   - Manages local canvas state, history for undo/redo (**currently needs to be separated per user/layer**), and user layers.

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections using Socket.IO and coordinates real-time drawing updates.
   - Tracks user connections and broadcasts drawing actions and canvas redraw events to all connected clients.
   - Currently uses in-memory state for user connections and **needs to implement saving and sending initial canvas state to new users**.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Each user has their own drawing layer, dynamically created and managed on the frontend using Pixi.js `Container` and `RenderTexture`.
   - Layers are differentiated by user ID, allowing for individual drawing spaces within the shared canvas.
   - Users are assigned layers upon receiving drawing commands from the server.

2. **Undo/Redo**:

   - **Undo**: Implemented on the client-side in `src/main.ts`. It utilizes a `historyStack` to store previous states of the canvas as `RenderTexture`s. When undo is triggered, it reverts to the previous state from the history and broadcasts the updated canvas state to other clients. **Needs to be modified to manage history per user/layer.**
   - **Redo**: Implemented on the client-side in `src/main.ts` using a `redoStack`. It allows re-applying states that were previously undone and broadcasts the updated canvas state to other clients. **Needs to be modified to manage redo per user/layer.**
   - Undo and redo actions are now synchronized across clients. When a user performs undo/redo, all other clients' canvases are updated to reflect the same state. **Synchronization needs to be reviewed when history is separated per user/layer.**

3. **Real-Time Sync**:

   - Real-time drawing updates are implemented.
   - When a user draws, their strokes are immediately visible to all other connected users in near real-time.
   - Uses Socket.IO for broadcasting drawing commands and canvas redraws.

4. **Initial Canvas State for New Users**:
   - **Currently Missing**: When a new user connects, they start with a blank canvas.
   - **To Implement**: New users should receive the current state of the drawing canvas upon connection so they can see what has already been drawn.

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
  - Initial setup for PixiJS canvas is implemented in `src/main.ts`. This includes:
    - Initializing a PixiJS `Application`.
    - Setting up a `Container` to hold drawing elements, positioned in the center of the canvas.
    - Creating a `Graphics` object as a mask and background for the canvas area.
    - Utilizing a `RenderTexture` and `Sprite` to efficiently render and store the drawing on a main layer.
    - Handling window resize events to adjust the canvas.
    - Implementing zoom functionality using the mouse wheel to scale the stage.

- **Drawing Input**:

  - **Drawing input is implemented in `src/main.ts`:**
  - Drawing input is implemented in `src/main.ts`:
    - Listens to `pointerdown`, `pointermove`, and `pointerup` events on the Pixi.Stage to capture drawing actions.
    - On `pointerdown`, initiates drawing a new stroke using `Graphics`. Supports different stroke styles (color, width, cap), and eraser mode.
    - On `pointermove`, draws lines based on pointer movement, creating free-hand drawing effect.
    - On `pointerup`, finalizes the stroke by rendering it onto the user's `RenderTexture`, saves the canvas state to the history stack for undo/redo, and emits drawing commands to the server via Socket.IO to broadcast to other clients.
    - Implements a basic eraser functionality toggled by the 'e' key, which changes the blend mode and stroke width.
    - Implements panning functionality using the middle mouse button to move the canvas.

- **Real-Time Updates**:

  - Real-time update handling is now implemented in `src/main.ts`:
    - Connects to the Socket.IO server upon initialization.
    - Listens for `drawCommand` events from the server.
    - Upon receiving a `drawCommand`, it identifies the user and their layer. If a layer doesn't exist for the user, it dynamically creates one.
    - Renders the received drawing commands (initLine, line, endLine) on the corresponding user's layer, ensuring all clients display the same strokes.
    - Listens for `redraw` events from the server.
    - Upon receiving a `redraw` event, it updates the local canvas by reconstructing the `RenderTexture` from the received base64 encoded PNG data, ensuring canvas state synchronization after undo/redo actions from any client.

- **Undo/Redo**:
  - Undo/Redo functionality is implemented in `src/main.ts` and now synchronized across clients:
    - **Undo**: Triggered by 'Ctrl+Z' or 'Cmd+Z'. Reverts the local canvas to the previous state by loading a `RenderTexture` from the `historyStack`. Then, it serializes the current `RenderTexture` to a base64 encoded PNG and emits a `redraw` event to the server via Socket.IO to broadcast the updated full canvas state to other clients.
    - **Redo**: Triggered by 'Ctrl+Shift+Z' or 'Cmd+Shift+Z'. Re-applies a previously undone state from the `redoStack`. Then, it serializes the current `RenderTexture` to a base64 encoded PNG and emits a `redraw` event to the server via Socket.IO to broadcast the updated full canvas state to other clients.
    - Saves canvas states to `historyStack` before each stroke completion and manages `redoStack` appropriately.
    - Limits the `historyStack` to `maxHistoryLength` defined in `src/utils/consts.ts`.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - Uses Socket.IO to handle WebSocket connections in `server/src/server.ts`.
  - Manages user connections and in-memory storage of user connections.
  - **Broadcasts `drawCommand` events**: When the server receives a `drawCommand` from a user, it broadcasts this command to all other connected clients, ensuring real-time drawing synchronization.
  - **Broadcasts `redraw` events**: When the server receives a `redraw` event (containing base64 encoded PNG of the canvas) from a user (typically after undo/redo), it broadcasts this event to all other connected clients, ensuring canvas state synchronization after undo/redo actions.

#### **3. Data Flow**

1. **User Draws**: User draws on the canvas → Frontend captures stroke → Renders stroke locally onto the user's `RenderTexture` → Frontend emits `drawCommand` events to the server via Socket.IO. → Server broadcasts `drawCommand` events to all other clients. → Clients receive `drawCommand` events and render the stroke on the respective user's layer.
2. **Undo/Redo**: User triggers undo/redo → Frontend manipulates `historyStack` and `redoStack` and re-renders the local canvas with a state from history. → Frontend serializes the current `RenderTexture` to base64 PNG. → Frontend emits `redraw` event with base64 data to the server via Socket.IO. → Clients receive `redraw` event, reconstruct `RenderTexture` from base64 data, and update their local canvas.

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers (or strokes) in the database.
  - Load layers from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs - Prioritized**

**Top Priority:**

- **Saving Canvas State for New Users:**
  - **Priority:** **High - P1**
  - **Goal:** Ensure new users see the current canvas state upon joining.
  - **Backend TODO:** Implement server-side storage of the combined canvas texture (as base64 PNG in memory initially). Periodically update this stored state or update it whenever the canvas changes significantly (e.g., after `endLine` or `redraw` events).
  - **Backend TODO:** On new user connection, immediately send the stored base64 PNG data to the new client via a new socket event (e.g., `'initialCanvasState'`).
  - **Frontend TODO:** In `socketEventHandler`, listen for the `'initialCanvasState'` event. When received, reconstruct the `RenderTexture` from the base64 PNG data and update the local canvas.

**High Priority:**

- **Separate History Stack per User/Layer:**
  - **Priority:** **High - P2**
  - **Goal:** Each user should have independent undo/redo history for their layer.
  - **Frontend TODO:** Modify `userLayers` map to store `historyStack` and `redoStack` for each user (keyed by `userId`).
  - **Frontend TODO:** Update `saveState`, `undo`, and `redo` functions to operate on the correct user's `historyStack` and `redoStack`. Ensure `redrawCanvas` updates only the relevant user's layer when triggered by local undo/redo.
  - **Frontend TODO:** Review and adjust canvas `redraw` synchronization after undo/redo to ensure it still functions correctly with per-user history.

**Medium Priority:**

- **Usernames and User Identification:**

  - **Priority:** **Medium - P3**
  - **Goal:** Display meaningful usernames instead of generic user IDs.
  - **Backend TODO:** Allow users to set usernames upon connection. Store username associated with `socket.id`.
  - **Backend TODO:** Broadcast updated user list (including usernames) to all clients on connection and username changes.
  - **Frontend TODO:** Prompt user for username on connection and send to server.
  - **Frontend TODO:** Display user list UI showing usernames.
  - **Frontend TODO:** Include username in `drawCommand` and `redraw` payloads for better user context.

- **Basic User List UI:**

  - **Priority:** **Medium - P4**
  - **Goal:** Create a simple UI element to display connected users and their usernames.
  - **Frontend TODO:** Add a `div` in `index.html` for the user list.
  - **Frontend TODO:** In `socketEventHandler`, listen for user list updates from the server and update the UI element.

- **Visual Layer Separation:**
  - **Priority:** **Medium - P5**
  - **Goal:** Provide visual distinction between user layers on the canvas.
  - **Frontend TODO:** Implement color-coding for strokes based on user ID or username.
  - **Frontend TODO (Optional):** Add layer name labels (e.g., username) to each user's layer container.

**Low Priority / Clarification Needed:**

- **Layer Locking (Clarification and Implementation - If Needed):**
  - **Priority:** **Low - P6**
  - **Goal:** Clarify if strict layer locking is required. If so, implement mechanisms to ensure only the "owner" can draw on a layer.
  - **Discussion:** Decide if strict layer locking is necessary or if visual separation and personal drawing space are sufficient for the collaborative drawing experience.
  - **Frontend/Backend TODO (If Strict Locking is Needed):** Implement UI elements and server-side logic to manage layer ownership and enforce locking.

**Ongoing / Future Considerations:**

- **Real-time Synchronization Improvements:**

  - **Priority:** Ongoing
  - **TODO:** Explore more efficient synchronization methods (command history, diffs) than full texture redraws.

- **Persistence:**

  - **Priority:** Future
  - **TODO:** Implement database persistence for saving sessions.

- **Scalability:**

  - **Priority:** Future
  - **TODO:** Optimize backend and frontend for handling more users and complex drawings.

- **Security:**

  - **Priority:** Future
  - **TODO:** Implement user authentication and consider security implications.

- **Error Handling:**

  - **Priority:** Ongoing
  - **TODO:** Implement robust error handling throughout the application.

- **Enhanced UI/UX & Drawing Functionality:**

  - **Priority:** Future
  - **TODO:** Add more drawing tools, brush types, UI improvements, etc.

- **Testing:**
  - **Priority:** Ongoing
  - **TODO:** Implement unit and integration tests.
