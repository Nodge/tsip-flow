# @tsip/flow - Reactive Data Flows for TypeScript

A TypeScript implementation of reactive flows based on the [TypeScript Interface Proposals (TSIP)](https://github.com/Nodge/ts-interface-proposals). This library provides both synchronous and asynchronous flow primitives for building reactive applications.

## Features

- **Standards-Based**: Built on the TypeScript Interface Proposals for seamless compatibility with TSIP-compatible libraries
- **Type-Safe**: Full TypeScript support with comprehensive type inference
- **Lightweight**: Zero dependencies and only 490B minified+gzipped
- **Universal**: Works in Node.js, browsers, and any JavaScript environment

## Installation

```bash
npm install @tsip/flow
# or
yarn add @tsip/flow
# or
pnpm add @tsip/flow
```

## Quick Start

```typescript
import { createFlow } from "@tsip/flow";

// Create a reactive counter
const counter = createFlow(0);

// Subscribe to changes
counter.subscribe(() => {
    console.log("Count:", counter.getSnapshot());
});

// Update the value
counter.emit(counter.getSnapshot() + 1); // Logs: "Count: 1"
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

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
