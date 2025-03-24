### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user interface and canvas rendering using Pixi.js.
   - Implements drawing functionalities, user interaction, and real-time synchronization via WebSocket (Socket.IO).
   - Manages local canvas state, per-layer history for undo/redo, and multiple layers per user. Initial structure for multi-layer support is in place.

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections using Socket.IO and coordinates real-time drawing updates.
   - Tracks user connections and broadcasts drawing actions and canvas redraw events to all connected clients.
   - Implements saving and sending initial canvas state to new users. Now sends the current canvas state to new users upon connection. Backend now supports layer IDs in events and manages a list of layers.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history, layer configurations) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Partially Implemented: Each user can now technically have multiple drawing layers through the refactored data structure. The frontend code now has a structure to manage multiple layers per user, but layer management UI and full functionality are still pending.
   - Layers are differentiated and organized per user, allowing for individual drawing spaces within the shared canvas, with the groundwork laid for multi-layer flexibility.
   - Users are assigned an initial layer upon connection. Functionality to create additional layers and select active layers is not yet implemented in the UI.
   - Layer Ordering and Selection: UI and logic for layer reordering and selection are still TODO.

2. **Undo/Redo**:

   - Partially Implemented: Undo and Redo are being transitioned to a per-layer basis. The `Layer` type now includes `historyStack` and `redoStack`. However, the undo/redo logic is still using a global `historyStack` and `redoStack` and needs to be refactored to use the per-layer stacks.
   - Undo: Client-side implementation in `src/main.ts` is partially adapted. The structure is prepared for per-layer history, but the actual logic needs to be updated to utilize the `layer.historyStack`. Broadcasting of updated canvas state to other clients will need to be layer-specific.
   - Redo: Client-side implementation in `src/main.ts` is partially adapted. Similar to undo, the structure is prepared, but logic needs to be refactored for per-layer `redoStack`. Broadcasting needs to be layer-specific.
   - Undo and redo actions are intended to be layer-specific and synchronized, but the implementation is not yet complete. Synchronization mechanism needs to be updated to handle layer-specific redraws once per-layer history is fully implemented.

3. **Real-Time Sync**:

   - Real-time drawing updates are implemented.
   - When a user draws, their strokes are immediately visible to all other connected users in near real-time. Layer identification is now included in the `drawCommand` payload.
   - Uses Socket.IO for broadcasting drawing commands and canvas redraws.

4. **Initial Canvas State for New Users**:
   - When a new user connects, they receive the initial state of the board. This ensures that all users start with the same board configuration.

---

### **Tech Stack**

| **Component**        | **Frontend**          | **Backend**                      |
| -------------------- | --------------------- | -------------------------------- |
| **Framework**        | TypeScript            | Node.js                          |
| **Canvas Library**   | Pixi.js               | N/A (backend handles logic only) |
| **Real-Time Sync**   | Socket.IO Client      | Socket.IO Server                 |
| **Networking**       | WebSocket (Socket.IO) | WebSocket (Socket.IO)            |
| **State Management** | TypeScript            | In-memory state                  |
| **Styling**          | CSS                   | N/A                              |

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
    - Utilizing `RenderTexture`s and `Sprite`s per layer, managed within each user's layer structure. Data structure refactoring is done.
    - Handling window resize events to adjust the canvas.
    - Implementing zoom functionality using the mouse wheel to scale the stage.

- **Drawing Input**:

  - Drawing input needs significant updates in `src/main.ts` to fully handle layer selection and per-layer drawing:
  - Drawing input is partially updated in `src/main.ts`:
    - Listens to `pointerdown`, `pointermove`, and `pointerup` events on the Pixi.Stage to capture drawing actions.
    - On `pointerdown`, initiates drawing a new stroke using `Graphics` on the `activeLayer`. Supports different stroke styles (color, width, cap), and eraser mode. `activeLayer` management and selection UI are still TODO.
    - On `pointermove`, draws lines based on pointer movement, creating free-hand drawing effect on the `activeLayer`. Active layer selection still TODO.
    - On `pointerup`, finalizes the stroke by rendering it onto the `activeLayer`'s `RenderTexture`, saving to per-layer history is TODO, and emitting drawing commands to the server via Socket.IO to broadcast to other clients, layer information is now added to the `drawCommand` payload.
    - Layer management structure is partially implemented in `src/main.ts`:
    - Connects to the Socket.IO server upon initialization.
    - Listens for `drawCommand` events from the server. `drawCommand` payload now includes layer ID.
    - Upon receiving a `drawCommand`, it identifies the user and uses `getOrCreateLayer` based on layer ID.
    - Layer Management: Dynamic user and initial layer creation is still functional. Full layer management and selection logic are TODO.
    - Renders the received drawing commands (initLine, line, endLine) on the corresponding user's specified layer.
    - Listens for `redraw` events from the server. `redraw` event payload now includes layer ID.
    - Upon receiving a `redraw` event, it updates the local layer's canvas.
    - Initial Canvas State Handling: Listens for the `'layers'` event.

- **Undo/Redo**:

  - Undo/Redo functionality is partially refactored in `src/main.ts` for per-layer structure, but logic is not yet fully implemented:
    - Per-Layer History Stacks: Each `Layer` object now includes `historyStack` and `redoStack`. Logic to use these stacks is TODO.
    - Undo: Triggered by 'Ctrl+Z' or 'Cmd+Z'. Currently using global `historyStack`. Needs to be updated to use `activeLayer.historyStack`. Emitting `redraw` event to the server needs to be layer-specific.
    - Redo: Triggered by 'Ctrl+Shift+Z' or 'Cmd+Shift+Z'. Currently using global `redoStack`. Needs to be updated to use `activeLayer.redoStack`. Emitting `redraw` event to the server needs to be layer-specific.
    - Saving canvas states is currently using global `historyStack`. Needs to be updated to save to `activeLayer.historyStack`.
    - Limits the per-layer `historyStack` to `maxHistoryLength` once per-layer history is fully implemented.

- **Layer Management UI**:
  - Not Implemented: UI elements in `index.html` and logic in `src/main.ts` to manage layers are still completely TODO.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - WebSocket handling is implemented using Socket.IO in `server.ts`.
  - Manages user connections and in-memory storage of user connections.
  - Broadcasts `drawCommand` events, including layer ID information.
  - Broadcasts `redraw` events, ensuring layer-specific canvas state synchronization, and relaying layer ID information.
  - Sends `layers` event with the state of each user's layers.

#### **3. Data Flow**

1. **User Draws on Layer**: User draws on the canvas (layer selection and active layer logic TODO) → Frontend captures stroke (layer ID capture is now included) → Renders stroke locally onto the `activeLayer`'s `RenderTexture` (active layer logic TODO) → Frontend emits `drawCommand` events to the server via Socket.IO, including layer ID. → Server broadcasts `drawCommand` events to all other clients. → Clients receive `drawCommand` events and render the stroke on the respective user's specified layer.
2. **Undo/Redo on Layer**: User triggers undo/redo (per-layer undo/redo logic TODO) → Frontend manipulates the `activeLayer`'s `historyStack` and `redoStack` (active layer and per-layer history logic TODO) and re-renders the `activeLayer`'s canvas with a state from history. → Frontend serializes the `activeLayer`'s `RenderTexture` to base64 PNG. → Frontend emits `redraw` event with base64 data and layer ID to the server via Socket.IO. → Clients receive `redraw` event, reconstruct the specified layer's `RenderTexture` from base64 data, and update their local canvas for that specific layer.
3. **New User Connects**: New user connects → Server sends the initial canvas state → Frontend's handles the `'layers'` event and redraw the borad.

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence for the multi-layer system:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers as structured data, including layer order, names (if implemented), visibility, and drawing data (potentially as base64 or command history) in the database.
  - Load user layer configurations and drawing data from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs - Prioritized**

**Highest Priority:**

- **Implement Per-Layer History and Multi-Layer Support - Continued Implementation:**

  - **Priority:** **Highest - P1+**
  - **Goal:** Fully refactor the frontend and backend to support multiple layers per user and per-layer undo/redo history. Focus on completing the frontend implementation first, then adapt the backend to the new structure.
  - **Frontend TODO (Immediate Focus):**

    - **Implement Layer Management UI**: Create UI in `index.html` and logic in `src/main.ts` to add, delete, reorder, and select the active layer. This is crucial for user interaction with layers.
    - **Update Drawing Input Logic**: Modify `onPointerDown`, `onPointerMove`, `onPointerUp` to draw on the currently active layer. Ensure `activeLayer` is correctly managed and updated by the layer selection UI.
    - **Refactor `saveState`, `undo`, `redo`**: Completely refactor these functions to operate on the `activeLayer`'s `historyStack` and `redoStack`. Remove usage of global `historyStack` and `redoStack`.
    - **Refactor `redrawCanvas`**: Update `redrawCanvas` to redraw a specific layer based on its `RenderTexture`. Ensure it operates on the `activeLayer` or a specified layer ID.
    - **Update `socketEventHandler`**: Modify `socketEventHandler` to handle `drawCommand` and `redraw` events with `layerId` and apply changes to the correct specified layer. Update `getOrCreateLayer` to handle layer IDs and multiple layers per user, and to fetch initial layer list.

  - **Backend TODO (Next Step after Frontend UI and Core Logic):**

    - **Refactor how the frontend layers object is build on connect:** Now that backend send all available layers per connect implement this on frontend.
    - **Update Event Handling**: No changes needed, `layerId` is already handled by server.

**High Priority:**

- **Usernames and User Identification:**

  - **Priority:** **Medium - P2**
  - **Goal:** Display meaningful usernames instead of generic user IDs.
  - **Backend TODO:** Allow users to set usernames upon connection. Store username associated with `socket.id`.
  - **Backend TODO:** Broadcast updated user list (including usernames) to all clients on connection and username changes.
  - **Frontend TODO:** Prompt user for username on connection and send to server.
  - **Frontend TODO:** Display user list UI showing usernames.

- **Basic User List UI:**

  - **Priority:** **Medium - P3**
  - **Goal:** Create a simple UI element to display connected users and their usernames.
  - **Frontend TODO:** Add a `div` in `index.html` for the user list, potentially alongside the layer management UI.
  - **Frontend TODO:** In `socketEventHandler`, listen for user list updates from the server (a new event needs to be defined on the server to send user list updates) and update the UI element dynamically to show connected users.

- **Visual Layer Separation:**

  - **Priority:** **Medium - P4**
  - **Goal:** Provide visual distinction between user layers on the canvas.
  - **Frontend TODO:** Implement color-coding for strokes based on user ID or username. Consider assigning default colors per user or per layer and allowing customization in the future.
  - **Frontend TODO (Optional):** Add layer name labels (e.g., username or layer name) to each user's layer container, potentially as a visual overlay.

- **Layer Locking:**
  - **Priority:** **Low - P5**
  - **Goal:** Implement mechanisms to ensure only the "owner" can draw on a layer, or perhaps locking per layer regardless of user.
  - **Frontend/Backend TODO:** Implement UI elements (e.g., a lock icon per layer in the layer management UI) and server-side logic to manage layer ownership and enforce locking. Consider different locking models (user-based, layer-based, etc.).

**Low Priority / Clarification Needed:**

- **Enhanced UI/UX & Drawing Functionality:**

  - **Priority:** **Low - P6**
  - **TODO:** Add more drawing tools (brush types, shapes, selection tools, fill tools), brush settings (size control, opacity control, pressure sensitivity), UI improvements (better color pickers, toolbars, layer panel enhancements), layer management UI enhancements (rename layers, toggle visibility, layer blend modes, layer opacity control), etc.

- **Security:**
  - **Priority:** **Low - P7**
  - **TODO:** Implement user authentication and consider security implications, especially if user-specific layers and persistence are implemented.
  - **TODO:** Implement the user roles (admin, editor), and permissions management (admin can manage all layers, editors can only edit their own layers).
  - **TODO:** Implement the ability to revoke access to layers or entire accounts.
  - **TODO:** Implement authentication tokens (JWTs) for secure access control.

**Ongoing / Future Considerations:**

- **Real-time Synchronization Improvements:**

  - **Priority:** Ongoing
  - **TODO:** Explore more efficient synchronization methods (command history diffs, optimized data structures for layer updates) than full texture redraws, especially critical with per-layer updates and potentially many layers.

- **Persistence:**

  - **Priority:** Future
  - **TODO:** Implement database persistence for saving sessions, now needing to persist a more complex data structure for multi-layer data, user layer configurations, and potentially layer history for more robust persistence.

- **Scalability:**

  - **Priority:** Future
  - **TODO:** Optimize backend and frontend for handling more users, more layers per user, and complex drawings. Consider server-side layer state management and efficient data broadcasting strategies.

- **Error Handling:**

  - **Priority:** Ongoing
  - **TODO:** Implement robust error handling throughout the application, particularly crucial with the added complexity of multi-layer management, layer synchronization, and potential user interactions with layer management UI.

- **Testing:**
  - **Priority:** Ongoing
  - **TODO:** Implement unit and integration tests, particularly important to ensure the stability and correctness of the new multi-layer and per-layer history system, layer management UI, and synchronization logic. Focus on testing core layer operations (add, delete, reorder, select, draw, undo/redo on specific layers) and synchronization across multiple clients.
