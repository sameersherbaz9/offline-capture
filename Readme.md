# Offline Capture (React Native + TypeScript)

Offline-first field-capture prototype built with Expo, React Native and TypeScript.

## Features
- Capture notes while offline, saved locally (AsyncStorage)
- Sync states per item: pending, syncing, synced, error
- Automatic sync and retry on reconnect (NetInfo)
- Manual Retry button for failed items
- Data survives app restarts

## Run
npm install
npx expo start
Scan the QR code with Expo Go (SDK 57).

## How sync works
Every note is written to local storage first with status "pending". A sync queue
sends pending and error items one by one to a mock API. On success the item
becomes "synced", on failure "error". When connectivity returns, the queue runs
again automatically.

## Demo toggles
- Simulate offline: fakes a lost connection
- Force server error: makes the mock API fail

## Tradeoffs
- Mock API instead of a real backend
- AsyncStorage instead of SQLite (simpler, fine for small data)
- Text notes only (photo capture would be the next step)
- No exponential backoff yet, retries happen on reconnect or manual tap