# Flow Implementation Compatible With TypeScript Interface Proposals

A TypeScript implementation of reactive flows based on the TypeScript Interface Proposals. This library provides both synchronous and asynchronous flow primitives for building reactive applications.

## Features

- **TSIP Compliant**: Implements the TypeScript Interface Proposals for flows
- **Synchronous Flows**: Create reactive values that can be subscribed to and updated
- **Asynchronous Flows**: Handle async operations with pending, success, and error states
- **TypeScript First**: Full type safety with comprehensive TypeScript support
- **Lightweight**: Zero dependencies and small bundle size (only 490B minified+gzipped)
- **Framework Agnostic**: Works with any JavaScript framework or vanilla JS

## Installation

```bash
npm install @tsip/flow
# or
yarn add @tsip/flow
# or
pnpm add @tsip/flow
```

## API

### `createFlow<T>(initialValue: T): MutableFlow<T>`

Creates a synchronous flow that can store and emit values of type `T`.

```typescript
import { createFlow } from "@tsip/flow";

const counter = createFlow(0);

// Subscribe to changes
const subscription = counter.subscribe(() => {
    console.log("Counter:", counter.getSnapshot());
});

// Update the value
counter.emit(1); // Logs: "Counter: 1"
counter.emit(2); // Logs: "Counter: 2"

// Unsubscribe
subscription.unsubscribe();
```

### `createAsyncFlow<T>(initialState: AsyncFlowState<T>): MutableAsyncFlow<T>`

Creates an asynchronous flow that can handle pending, success, and error states.

```typescript
import { createAsyncFlow } from "@tsip/flow";

const userFlow = createAsyncFlow<User>({ status: "pending" });

// Subscribe to state changes
userFlow.subscribe(() => {
    const state = userFlow.getSnapshot();
    if (state.status === "success") {
        console.log("User loaded:", state.data);
    } else if (state.status === "error") {
        console.error("Failed to load user:", state.error);
    }
});

// Simulate async operation
fetchUser()
    .then((user) => userFlow.emit({ status: "success", data: user }))
    .catch((error) => userFlow.emit({ status: "error", error }));

// Or wait for the data directly
const user = await userFlow.getDataSnapshot();
```

## License

MIT
