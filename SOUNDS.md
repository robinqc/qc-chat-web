# Adding New Sounds

This project plays sound effects for various events (voice room connect/disconnect, incoming messages, etc.). All sound files live in the Vite public directory and are played at runtime using the browser's `Audio` API.

## Sound file location

All `.mp3` files go in:

```
packages/client/public/assets/sounds/
```

Vite serves everything under `public/` as static assets. At runtime, files are accessible via `${import.meta.env.BASE_URL}assets/sounds/<filename>.mp3`, which resolves the correct base path regardless of deployment configuration.

## Current sounds

| File             | Event                                     | Location                                                    |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `connect.mp3`    | User joins a voice room (local + remote)  | `packages/client/components/rtc/state.tsx`                  |
| `disconnect.mp3` | User leaves a voice room (local + remote) | `packages/client/components/rtc/state.tsx`                  |
| `message.mp3`    | Incoming message in a non-focused channel | `packages/client/components/client/NotificationsWorker.tsx` |

## How to add a new sound

1. **Add the file** -- Drop your `.mp3` into `packages/client/public/assets/sounds/`.

2. **Play it** -- In the appropriate handler, create and play an `Audio` object:

   ```ts
   new Audio(`${import.meta.env.BASE_URL}assets/sounds/your-sound.mp3`).play();
   ```

3. **Respect user preferences** -- Depending on context, you may want to gate playback:
   - **Voice room sounds**: Check `this.deafen()` before playing (see `state.tsx` for the pattern with `RoomEvent.ParticipantConnected`).
   - **Message sounds**: The `NotificationsWorker` already filters out own messages, muted channels, blocked users, and respects per-channel/server notification settings before the sound line is reached. If you add a new message-related sound, place it after those checks.

4. **Update this table** -- Add an entry to the table above so future contributors know which sounds exist and where they're triggered.

## Guidelines

- Use `.mp3` format for broad browser compatibility.
- Keep files small (under ~50 KB) to avoid blocking or latency.
- Each `new Audio(...)` call creates a fresh instance, so rapid-fire events will overlap sounds rather than cutting off previous ones. If you need debouncing, implement it yourself.
- `import.meta.env.BASE_URL` is provided by Vite and always ends with `/`, so do not add a leading slash to the path after it.
