### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user interface and canvas rendering using Pixi.js.
   - Implements drawing functionalities, user interaction, and real-time synchronization via WebSocket (Socket.IO).
   - Manages local canvas state, **global history for undo/redo that clears on layer change**, **functional tool buttons in the UI**, and **multiple layers per user (UI structure and basic management implemented, including deletion)**.

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections using Socket.IO and coordinates real-time drawing updates.
   - Tracks user connections and broadcasts drawing actions and canvas redraw events to all connected clients.
   - Implements sending initial canvas state to new users, now sending layer data on connection. Backend now supports layer IDs in events and manages a list of layers, including layer creation and deletion events.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history, layer configurations) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Partially Implemented: Each user can now have multiple drawing layers. The frontend code has a UI structure for layer display and selection and logic to manage multiple layers per user. Basic layer creation, selection, and **deletion** are implemented via UI.
   - Layers are differentiated and organized per user, allowing for individual drawing spaces within the shared canvas, with UI representation for layers.
   - Users are assigned an initial layer upon connection and can create **and delete** additional layers via the UI. Layer selection is implemented in the UI, allowing users to choose the active layer.
   - Layer Ordering and Selection: UI for layer selection is implemented. UI and logic for layer reordering are still TODO.

2. **Undo/Redo**:

   - **Updated Implementation**: Undo and Redo are implemented using a **global history stack**. This stack is **cleared whenever the active layer is changed**, providing undo/redo functionality relevant to the current layer's drawing actions.
   - **Undo**: Client-side implementation in `src/main.ts` utilizes a **global `historyStack`**. When undo is triggered, it reverts to the previous state from this global history, and broadcasts the updated canvas state to other clients. The global history is cleared on active layer change.
   - **Redo**: Client-side implementation in `src/main.ts` utilizes a **global `redoStack`**. When redo is triggered, it re-applies a previously undone state from the global redo stack, and broadcasts the updated canvas state to other clients. The global redo stack is cleared on active layer change.
   - Undo and redo actions are synchronized across clients and are relevant to the currently active layer. The global history stacks are cleared when the active layer is switched.

3. **Real-Time Sync**:

   - Real-time drawing updates are implemented.
   - When a user draws, their strokes are immediately visible to all other connected users in near real-time, now on the selected layer and using the selected tool. Layer identification is now included in the `drawCommand` payload.
   - Uses Socket.IO for broadcasting drawing commands and canvas redraws, **and layer deletion events**.

4. **Initial Canvas State for New Users**:

   - Implemented: When a new user connects, they receive the initial state of all existing layers from the server, ensuring that all users start with the same board configuration, including layers.

5. **Tool Buttons**:
   - **Implemented**: Basic tool buttons (Brush, Eraser, Delete, Zoom In/Out, Download, Undo/Redo, Color Picker) are now functional in the UI.
   - **Tool Selection**: Users can select different drawing tools using the toolbar.
   - **Color Picker**: A functional color picker is integrated for changing stroke color.
   - **`ToolbarUI` Class**: Implemented a `ToolbarUI` class in `ui.ts` to manage tool button interactions and states.

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

  - Drawing input is further enhanced with functional tool buttons via `ToolbarUI` in `src/main.ts`:
    - Listens to `pointerdown`, `pointermove`, and `pointerup` events on the Pixi.Stage to capture drawing actions, now influenced by the selected tool from `ToolbarUI`.
    - On `pointerdown`, initiates drawing a new stroke using `Graphics` on the `activeLayer` based on the **selected tool (brush or eraser)**. Supports different stroke styles (color, width, cap), and eraser mode. `activeLayer` management and selection UI are partially implemented.
    - On `pointermove`, draws lines based on pointer movement, creating free-hand drawing effect on the `activeLayer` using the **selected tool**. Active layer selection is implemented via UI.
    - On `pointerup`, finalizes the stroke by rendering it onto the `activeLayer`'s `RenderTexture`, saving to **global history stack**, and emitting drawing commands to the server via Socket.IO to broadcast to other clients, layer information is now added to the `drawCommand` payload.
    - Layer management structure is implemented in `src/main.ts`:
    - Connects to the Socket.IO server upon initialization.
    - Listens for `drawCommand` events from the server. `drawCommand` payload now includes layer ID.
    - Upon receiving a `drawCommand`, it identifies the user and uses `getOrCreateLayer` based on layer ID.
    - Layer Management: Dynamic user and layer creation is functional. Layer selection UI and **Layer deletion UI and logic are implemented**. Full layer management and layer ordering logic are TODO.
    - Renders the received drawing commands (initLine, line, endLine) on the corresponding user's specified layer.
    - Listens for `redraw` events from the server. `redraw` event payload now includes layer ID.
    - Upon receiving a `redraw` event, it updates the local layer's canvas.
    - Initial Canvas State Handling: Listens for the `'layers'` event and builds layers object based on data from server.
    - Brush stabilization and smooth brush movement are still future considerations.
    - **Toolbar UI Integration**: Implemented `ToolbarUI` class in `ui.ts` to manage tool button interactions. `ToolbarUI` handles tool selection, active states, and color picker input.

- **Undo/Redo**:

  - **Updated Implementation**: Undo/Redo functionality in `src/main.ts` now uses a **global history stack that clears on layer change**:
    - **Global History Stacks**: A single global `historyStack` and `redoStack` are used for undo/redo operations. These stacks are cleared when the active layer is changed.
    - **Undo**: Triggered by 'Ctrl+Z' or 'Cmd+Z' **or Undo button in the toolbar**. Operates on the **global `historyStack`**. Emitting `redraw` event to the server is layer-specific.
    - **Redo**: Triggered by 'Ctrl+Shift+Z' or 'Cmd+Shift+Z' **or Redo button in the toolbar**. Operates on the **global `redoStack`**. Emitting `redraw` event to the server is layer-specific.
    - **Saving canvas states is currently using global `historyStack`**.
    - Limits the **global** `historyStack` to `maxHistoryLength`.
    - **History Stack Clearing**: The global `historyStack` and `redoStack` are **cleared when the active layer is changed**, ensuring undo/redo context is specific to the selected layer.

- **Layer Management UI**:

  - **Partially Implemented**: UI elements in `index.html` and logic in `src/main.ts` to display, select, **and delete** layers are implemented. Adding new layers via UI is implemented. Reordering layers via UI is still TODO.

- **Toolbar UI**:
  - **Implemented**: `ToolbarUI` class in `ui.ts` is implemented and integrated into `main.ts`.
  - **Functional Tool Buttons**: Brush, Eraser, Delete, Zoom In/Out, Download, Undo, Redo, and Color Picker buttons are functional and interactive.
  - **Active Tool State**: Visual feedback for the active tool button.
  - **Color Selection**: Color picker functionality is integrated.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - WebSocket handling is implemented using Socket.IO in `server.ts`.
  - Manages user connections and in-memory storage of user connections.
  - Broadcasts `drawCommand` events, including layer ID information.
  - Broadcasts `redraw` events, ensuring layer-specific canvas state synchronization, and relaying layer ID information.
  - Sends `layers` event with the state of each user's layers on connect, including layer creation and **deletion** events.

#### **3. Data Flow**

1. **User Draws with Tool**: User selects a layer using UI and a tool from the toolbar and draws on the canvas → Frontend captures stroke with layer ID and tool info → Renders stroke locally onto the `activeLayer`'s `RenderTexture` using the selected tool → Frontend emits `drawCommand` events to the server via Socket.IO, including layer ID and tool context (implicitly within command type). → Server broadcasts `drawCommand` events to all other clients. → Clients receive `drawCommand` events and render the stroke on the respective user's specified layer using the intended tool.
2. **Undo/Redo**: User triggers undo/redo via keyboard shortcut or toolbar button → Frontend manipulates the **global `historyStack` and `redoStack` (global history stack is cleared on layer change)** and re-renders the `activeLayer`'s canvas with a state from history. → Frontend serializes the `activeLayer`'s `RenderTexture` to base64 PNG. → Frontend emits `redraw` event with base64 data and layer ID to the server via Socket.IO. → Clients receive `redraw` event, reconstruct the specified layer's `RenderTexture` from base64 data, and update their local canvas for that specific layer.
3. **New User Connects**: New user connects → Server sends the initial state of all layers via `'layers'` event → Frontend handles the `'layers'` event, builds layer objects and renders layers UI and Toolbar UI.
4. **User Deletes Layer**: User clicks delete button in Layer UI → Frontend calls `onDeleteLayer` handler, removes layer locally, updates UI, and emits `deleteLayer` event to server. → Server receives `deleteLayer` event, removes layer from server-side data, and broadcasts `deleteLayer` event to all clients. → Clients receive `deleteLayer` event and remove the layer locally.
5. **User Selects Tool**: User clicks a tool button in the Toolbar UI → Frontend `ToolbarUI` updates active tool state and makes the selected tool active, ready for drawing input.

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence for the multi-layer system:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers as structured data, including layer order, names (if implemented), visibility, and drawing data (potentially as base64 or command history) in the database.
  - Load user layer configurations and drawing data from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs - Prioritized**

**Highest Priority:**

**High Priority:**

- **Enhanced UI/UX & Drawing Functionality:**

  - **Priority:** **High - P1**
  - **Goal:** Improve the overall drawing experience and UI/UX.
  - **Frontend TODO:**
    - **Brush Stabilization and Smooth Movement**: Implement brush stabilization techniques to reduce jitter and smooth out freehand strokes.
    - **Implement more Drawing Tools**: Add more drawing tools (shapes, selection tools, fill tools), brush settings (size control, opacity control, pressure sensitivity), UI improvements (better color pickers, toolbars, layer panel enhancements), layer management UI enhancements (rename layers, toggle visibility, layer blend modes, layer opacity control), etc. Start with Brush Size control.

- **Layer Management Refinement:**

  - **Priority:** **High - P2**
  - **Goal:** Further refine layer management and UI, focusing on completing core layer operations and improving user experience.
  - **Frontend TODO (Immediate Focus):**

    - **Layer Ordering**: Implement UI and logic to reorder layers based on their order in the UI (drag and drop, up/down buttons). Implement visual layer ordering in canvas display (adjust z-index of layer containers).
    - **Refine Layer Deletion UX**: Consider adding a confirmation dialog before deleting a layer.

  - **Backend TODO (Next Step after Frontend UI and Core Logic):**
    - **Layer Ordering**: Implement a system to persist and broadcast layer order to all clients, ensuring that the layer display order is consistent across all users.
    - **Robustness & Error Handling:** Add more robust error handling to the layer deletion process, both on the frontend and backend. For example, handle cases where a layer cannot be deleted, or the deletion fails to propagate to all clients.

- **Usernames and User Identification:**

  - **Priority:** **Medium - P3**
  - **Goal:** Display meaningful usernames instead of generic user IDs.
  - **Backend TODO:** Allow users to set usernames upon connection. Store username associated with `socket.id`.
  - **Backend TODO:** Broadcast updated user list (including usernames) to all clients on connection and username changes.
  - **Frontend TODO:** Prompt user for username on connection and send to server.
  - **Frontend TODO:** Display user list UI showing usernames.

- **Basic User List UI:**

  - **Priority:** **Medium - P4**
  - **Goal:** Create a simple UI element to display connected users and their usernames.
  - **Frontend TODO:** Add a `div` in `index.html` for the user list, potentially alongside the layer management UI.
  - **Frontend TODO:** In `socketEventHandler`, listen for user list updates from the server (a new event needs to be defined on the server to send user list updates) and update the UI element dynamically to show connected users.

- **Layer Locking:**

  - **Priority:** **Low - P5**
  - **Goal:** Implement mechanisms to ensure only the "owner" can draw on a layer, or perhaps locking per layer regardless of user.
  - **Frontend/Backend TODO:** Implement UI elements (e.g., a lock icon per layer in the layer management UI) and server-side logic to manage layer ownership and enforce locking. Consider different locking models (user-based, layer-based, etc.).

- **Security:**
  - **Priority:** **Low - P6**
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
  - **TODO:** Implement unit and integration tests, particularly important to ensure the stability and correctness of the new multi-layer and undo/redo system with global stack cleared on layer change, layer management UI, Toolbar UI and tool selection and synchronization logic. Focus on testing core layer operations (add, delete, reorder, select, draw, undo/redo on specific layers) and synchronization across multiple clients.
