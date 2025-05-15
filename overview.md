
### **TODO**

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
