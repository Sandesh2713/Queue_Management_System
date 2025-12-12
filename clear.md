# How to Clear Database Data

Since the application uses a local SQLite database, clearing it is straightforward. You can either delete the entire database file for a full reset or use SQL commands to clear specific data.

## Option 1: Full Reset (Recommended)
This deletes all data (Users, Companies, Tokens, History) and resets the application to a fresh state.

1.  **Stop the Backend Server** (Ctrl + C in the terminal running `npm start` for backend).
2.  **Delete the Database File**:
    Navigate to `backend/data/` and delete `queue.db`.
    ```bash
    rm backend/data/queue.db
    ```
    *(On Windows Command Prompt: `del backend\data\queue.db`)*
3.  **Restart the Server**:
    ```bash
    cd backend
    npm start
    ```
    The server will automatically recreate the database and tables on startup.

## Option 2: Clear Specific Data (Advanced)
If you want to keep Users but delete Queue Data, you can run these SQL commands using a tool like `sqlite3` or any SQLite viewer.

**Clear All Queue Activity (Tokens & History):**
```sql
DELETE FROM tokens;
DELETE FROM token_history;
DELETE FROM queue_events;
DELETE FROM notifications;
UPDATE offices SET available_today = daily_capacity; -- Reset availability
```

**Clear All Companies (Offices):**
```sql
DELETE FROM offices;
```
