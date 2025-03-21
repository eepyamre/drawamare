### **Architecture Overview**

#### **Core Components**

1. **Frontend** (TypeScript + Pixi.js):

   - Handles user input (drawing, undo/redo buttons).
   - Renders the composite canvas using Pixi.js for each user.
   - Real-time synchronization via WebSocket (Socket.IO).

2. **Backend** (Node.js + TypeScript):

   - Manages WebSocket connections and coordinates real-time drawing updates.
   - Tracks each user’s layer data in memory (strokes drawn by each user).
   - Broadcasts drawing actions to all connected clients.

3. **Database** (Optional for persistence):
   - Not currently implemented. Could be used to store session data (e.g., user layers, history) for persistence across sessions.

---

### **Key Features**

1. **User Layers**:

   - Each user implicitly has their own layer managed by Pixi.js on the frontend. The backend tracks strokes associated with each user ID.
   - Layers are merged into a single Pixi.js Stage for display in each client.

2. **Basic Undo/Redo**:

   - **Undo**: Implemented on both client and server. Client-side undo removes the last drawn line from the user's Pixi.js layer and sends an 'undo' event to the server. The server then broadcasts a 'strokeRemoved' event, causing other clients to also remove the last stroke of the user who initiated the undo.
   - **Redo**: Implemented on the client-side only, and it's not a true "redo" from a history stack in the traditional sense. When "redo" is clicked, the client re-emits the last undone stroke as a _new_ 'drawStroke' event to the server. This will redraw the stroke, but it's essentially sending a new draw command, not restoring from a proper undo history. **The server does not have a 'redo' functionality or history.**

3. **Real-Time Sync**:
   - All users see drawing updates in near real-time when others draw. Achieved using Socket.IO for broadcasting drawing and undo actions.

---

### **Tech Stack**

| **Component**        | **Frontend**          | **Backend**                      |
| -------------------- | --------------------- | -------------------------------- |
| **Framework**        | Vanilla JavaScript    | Node.js                          |
| **Canvas Library**   | Pixi.js               | N/A (backend handles logic only) |
| **Real-Time Sync**   | Socket.IO Client      | Socket.IO Server                 |
| **Networking**       | WebSocket (Socket.IO) | WebSocket (Socket.IO)            |
| **State Management** | Vanilla JavaScript    | In-memory state                  |
| **Styling**          | CSS Modules           | N/A                              |

---

### **Implementation Steps**

#### **1. Frontend (Client-Side)**

- **Canvas Setup**:

  - Uses Pixi.Stage and Pixi.Graphics to manage the drawing canvas and user layers.
  - Each user gets a Pixi.Graphics layer.

- **Drawing Input**:

  - Listens to `mousedown`, `mousemove`, and `mouseup` events on the Pixi.Stage to capture drawing actions.
  - Creates Pixi.Graphics objects for strokes and adds them to the user's layer.
  - On `mouseup`, emits a 'drawStroke' event via Socket.IO with stroke data.

- **Real-Time Updates**:

  - Listens for 'newStroke' events from the server. When received, creates a new Pixi.Graphics on the appropriate user's layer.
  - Listens for 'strokeRemoved' events from the server. When received, removes the last Pixi.Graphics from the specified user's layer.

- **Undo/Redo**:
  - **Undo**: Removes the last drawn Pixi.Graphics from the user's layer and emits an 'undo' event to the server.
  - **Redo**: Re-emits the last undone stroke as a new 'drawStroke' event. **Note**: This is not a true redo from history, but rather re-drawing the last undone stroke. The `undoHistory` ref is reset after each draw, and it's only used to temporarily store the last undone line for immediate re-draw upon "redo" button click.

#### **2. Backend (Server-Side)**

- **WebSocket Server**:

  - Uses Socket.IO to handle WebSocket connections.
  - Manages user connections and in-memory storage of user layers (currently just tracking the last action for undo, not full layer history persistence).

- **Event Handling**:
  - **'connection'**: Assigns a user ID, joins a room (currently user ID as room, which might not be necessary for broadcast to all).
  - **'drawStroke'**: Receives stroke data, stores it in memory (in a very basic way, not persistent layer data), and broadcasts 'newStroke' event to all other connected clients.
  - **'undo'**: Receives 'undo' event, and broadcasts 'strokeRemoved' event to all other clients. The server itself does not maintain a detailed undo history or per-user stroke lists beyond the last action needed for 'strokeRemoved'.
  - **'disconnect'**: Cleans up user-related data from in-memory storage.

#### **3. Data Flow**

1. **User Draws**: User draws on the canvas → Frontend captures stroke → Emits 'drawStroke' to backend.
2. **Backend Broadcasts Draw**: Backend receives 'drawStroke' → Broadcasts 'newStroke' to all clients (except sender).
3. **Clients Update Canvas**: Clients receive 'newStroke' → Update their Pixi.Stage by drawing the new stroke on the correct user's layer.
4. **User Undoes**: User clicks "Undo" → Frontend removes last stroke locally, emits 'undo' to backend.
5. **Backend Broadcasts Undo**: Backend receives 'undo' → Broadcasts 'strokeRemoved' to all clients (except sender).
6. **Clients Update Canvas (Undo)**: Clients receive 'strokeRemoved' → Remove the last stroke from the specified user's layer.
7. **User Redoes**: User clicks "Redo" → Frontend re-emits the last undone stroke as 'drawStroke' to backend (effectively re-drawing, not true redo).

---

### **Database (Optional)**

- **For Persistence**: Currently no database is used. To add persistence:
  - Implement a database (e.g., Redis, PostgreSQL, MongoDB, or even a simple JSON file for basic persistence).
  - Store user layers (or strokes) in the database.
  - Load layers from the database on server start and when new users connect if session persistence is required.

---

### **Key Considerations and TODOs**

- **Undo/Redo Improvement**:

  - **TODO**: Decide if server should maintain a full history of strokes per user for more advanced features like session saving and replay.

- **Persistence**:

  - **TODO**: Implement database persistence to save drawing sessions. Consider using Redis for fast in-memory data store or a more persistent database like Redis depending on requirements.

- **Scalability**:

  - **TODO**: For increased scalability, especially with more users:
    - Implement Socket.IO rooms more effectively if needed (currently using user ID as room, which might not be optimal for broadcasting to all).
    - Explore using Redis for distributed state management if scaling across multiple server instances.
    - Consider optimizing Pixi.js rendering for complex canvases.

- **Security**:

  - **TODO**: Implement user authentication to ensure only authorized users can participate in drawing sessions. JWT or OAuth could be considered.
  - **TODO**: Consider security implications of broadcasting drawing data and implement necessary measures if sensitive information is involved (though likely not for a basic drawing app).

- **Error Handling**:

  - **TODO**: Implement more robust error handling on both the client and server (e.g., handling socket connection errors, unexpected data formats, etc.).

- **Usernames and User Interface**:

  - **TODO**: Display usernames of users connected to the canvas.
  - **TODO**: Display layers andd ability to create new layer for each user. This will allow users to see their own drawings separately from others.
  - **TODO**: Improve the UI/UX with more drawing tools (colors, brush sizes, eraser, clear canvas, etc.).

- **Testing**:
  - **TODO**: Implement unit and integration tests for both frontend and backend to ensure functionality and stability.
