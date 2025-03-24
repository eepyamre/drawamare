### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user interface and canvas rendering using Pixi.js.
   - Implements drawing functionalities, user interaction, and real-time synchronization via WebSocket (Socket.IO).
   - Manages local canvas state, **global history for undo/redo that clears on layer change**, and **multiple layers per user (UI structure and basic management implemented)**.

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections using Socket.IO and coordinates real-time drawing updates.
   - Tracks user connections and broadcasts drawing actions and canvas redraw events to all connected clients.
   - Implements sending initial canvas state to new users, now sending layer data on connection. Backend now supports layer IDs in events and manages a list of layers, including layer creation events.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history, layer configurations) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Partially Implemented: Each user can now have multiple drawing layers. The frontend code has a UI structure for layer display and selection and logic to manage multiple layers per user. Basic layer creation and selection are implemented via UI.
   - Layers are differentiated and organized per user, allowing for individual drawing spaces within the shared canvas, with UI representation for layers.
   - Users are assigned an initial layer upon connection and can create additional layers via the UI. Layer selection is implemented in the UI, allowing users to choose the active layer.
   - Layer Ordering and Selection: UI for layer selection is implemented. UI and logic for layer reordering are still TODO.

2. **Undo/Redo**:

   - **Updated Implementation**: Undo and Redo are implemented using a **global history stack**. This stack is **cleared whenever the active layer is changed**, providing undo/redo functionality relevant to the current layer's drawing actions.
   - **Undo**: Client-side implementation in `src/main.ts` utilizes a **global `historyStack`**. When undo is triggered, it reverts to the previous state from this global history, and broadcasts the updated canvas state to other clients. The global history is cleared on active layer change.
   - **Redo**: Client-side implementation in `src/main.ts` utilizes a **global `redoStack`**. When redo is triggered, it re-applies a previously undone state from the global redo stack, and broadcasts the updated canvas state to other clients. The global redo stack is cleared on active layer change.
   - Undo and redo actions are synchronized across clients and are relevant to the currently active layer. The global history stacks are cleared when the active layer is switched.

3. **Real-Time Sync**:

   - Real-time drawing updates are implemented.
   - When a user draws, their strokes are immediately visible to all other connected users in near real-time, now on the selected layer. Layer identification is now included in the `drawCommand` payload.
   - Uses Socket.IO for broadcasting drawing commands and canvas redraws.

4. **Initial Canvas State for New Users**:
   - Implemented: When a new user connects, they receive the initial state of all existing layers from the server, ensuring that all users start with the same board configuration, including layers.

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

  - Drawing input is partially updated in `src/main.ts` to handle layer selection and per-layer drawing:
    - Listens to `pointerdown`, `pointermove`, and `pointerup` events on the Pixi.Stage to capture drawing actions.
    - On `pointerdown`, initiates drawing a new stroke using `Graphics` on the `activeLayer`. Supports different stroke styles (color, width, cap), and eraser mode. `activeLayer` management and selection UI are partially implemented.
    - On `pointermove`, draws lines based on pointer movement, creating free-hand drawing effect on the `activeLayer`. Active layer selection is implemented via UI.
    - On `pointerup`, finalizes the stroke by rendering it onto the `activeLayer`'s `RenderTexture`, saving to **global history stack**, and emitting drawing commands to the server via Socket.IO to broadcast to other clients, layer information is now added to the `drawCommand` payload.
    - Layer management structure is implemented in `src/main.ts`:
    - Connects to the Socket.IO server upon initialization.
    - Listens for `drawCommand` events from the server. `drawCommand` payload now includes layer ID.
    - Upon receiving a `drawCommand`, it identifies the user and uses `getOrCreateLayer` based on layer ID.
    - Layer Management: Dynamic user and layer creation is functional. Layer selection UI is implemented. Full layer management and layer ordering logic are TODO.
    - Renders the received drawing commands (initLine, line, endLine) on the corresponding user's specified layer.
    - Listens for `redraw` events from the server. `redraw` event payload now includes layer ID.
    - Upon receiving a `redraw` event, it updates the local layer's canvas.
    - Initial Canvas State Handling: Listens for the `'layers'` event and builds layers object based on data from server.
    - Brush stabilization and smooth brush movement are still future considerations.

- **Undo/Redo**:

  - **Updated Implementation**: Undo/Redo functionality in `src/main.ts` now uses a **global history stack that clears on layer change**:
    - **Global History Stacks**: A single global `historyStack` and `redoStack` are used for undo/redo operations. These stacks are cleared when the active layer is changed.
    - **Undo**: Triggered by 'Ctrl+Z' or 'Cmd+Z'. Operates on the **global `historyStack`**. Emitting `redraw` event to the server is layer-specific.
    - **Redo**: Triggered by 'Ctrl+Shift+Z' or 'Cmd+Shift+Z'. Operates on the **global `redoStack`**. Emitting `redraw` event to the server is layer-specific.
    - **Saving canvas states is currently using global `historyStack`**.
    - Limits the **global** `historyStack` to `maxHistoryLength`.
    - **History Stack Clearing**: The global `historyStack` and `redoStack` are **cleared when the active layer is changed**, ensuring undo/redo context is specific to the selected layer.

- **Layer Management UI**:
  - Partially Implemented: UI elements in `index.html` and logic in `src/main.ts` to display and select layers are implemented. Adding new layers via UI is implemented. Deleting and reordering layers via UI are still TODO.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - WebSocket handling is implemented using Socket.IO in `server.ts`.
  - Manages user connections and in-memory storage of user connections.
  - Broadcasts `drawCommand` events, including layer ID information.
  - Broadcasts `redraw` events, ensuring layer-specific canvas state synchronization, and relaying layer ID information.
  - Sends `layers` event with the state of each user's layers on connect, including layer creation events.

#### **3. Data Flow**

1. **User Draws on Layer**: User selects a layer using UI and draws on the canvas → Frontend captures stroke with layer ID → Renders stroke locally onto the `activeLayer`'s `RenderTexture` → Frontend emits `drawCommand` events to the server via Socket.IO, including layer ID. → Server broadcasts `drawCommand` events to all other clients. → Clients receive `drawCommand` events and render the stroke on the respective user's specified layer.
2. **Undo/Redo on Layer**: User triggers undo/redo → Frontend manipulates the **global `historyStack` and `redoStack` (global history stack is cleared on layer change)** and re-renders the `activeLayer`'s canvas with a state from history. → Frontend serializes the `activeLayer`'s `RenderTexture` to base64 PNG. → Frontend emits `redraw` event with base64 data and layer ID to the server via Socket.IO. → Clients receive `redraw` event, reconstruct the specified layer's `RenderTexture` from base64 data, and update their local canvas for that specific layer.
3. **New User Connects**: New user connects → Server sends the initial state of all layers via `'layers'` event → Frontend handles the `'layers'` event, builds layer objects and renders layers UI.

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence for the multi-layer system:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers as structured data, including layer order, names (if implemented), visibility, and drawing data (potentially as base64 or command history) in the database.
  - Load user layer configurations and drawing data from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs - Prioritized**

**Highest Priority:**

- **Implement Per-Layer History and Multi-Layer Support - Continued Implementation (Focus on Layer Management and Undo/Redo):**

  - **Priority:** **Highest - P1+**
  - **Goal:** Fully refactor the frontend and backend to refine multi-layer support and complete the undo/redo implementation within the context of layer management.
  - **Frontend TODO (Immediate Focus):**

    - **Refactor `saveState`, `undo`, `redo`**: Ensure these functions correctly utilize the **global `historyStack` and `redoStack` which clear on layer change**. Verify correct saving and restoring of canvas state for undo/redo within the current layer context.
    - **Refactor `redrawCanvas`**: Update `redrawCanvas` to ensure it correctly redraws the **active layer** based on the global history stack and `RenderTexture`.
    - **Update `socketEventHandler`**: Ensure `socketEventHandler` continues to correctly handle `drawCommand` and `redraw` events with `layerId` in the context of the updated undo/redo and layer selection logic.
    - **Layer Ordering**: Implement UI and logic to reorder layers based on their order in the UI. Implement visual layer ordering in canvas display.
    - **Implement Layer Deletion in UI and Logic**: Add UI button to delete layer and implement logic to remove layer from `layers` map and update UI and backend.

  - **Backend TODO (Next Step after Frontend UI and Core Logic):**
    - **Layer Ordering**: Implement a system to persist and broadcast layer order.

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
  - **TODO:** Implement unit and integration tests, particularly important to ensure the stability and correctness of the new multi-layer and undo/redo system with global stack cleared on layer change, layer management UI, and synchronization logic. Focus on testing core layer operations (add, delete, reorder, select, draw, undo/redo on specific layers) and synchronization across multiple clients.
