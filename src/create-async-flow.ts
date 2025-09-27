import type { AsyncFlow, AsyncFlowState, MutableAsyncFlow } from "@tsip/types";
import { MutableFlowImpl } from "./create-flow";

/**
 * Implementation of a MutableAsyncFlow from the TypeScript Interface Proposals.
 *
 * This class extends the base Flow implementation to handle async operations with three possible states:
 * - `pending`: The async operation is in progress
 * - `success`: The async operation completed successfully with data
 * - `error`: The async operation failed with an error
 *
 * @typeParam Data - The type of data that will be resolved when the async operation succeeds
 */
export class MutableAsyncFlowImpl<Data>
    extends MutableFlowImpl<AsyncFlowState<Data>>
    implements MutableAsyncFlow<Data>
{
    /**
     * Cached promise returned from the asPromise()
     */
    private promise: Promise<Data> | null = null;

    /**
     * Emits a new async flow state, notifying all subscribers and managing the internal promise cache.
     *
     * @param value - The new async flow state to emit. Can be:
     *   - `{ status: "pending" }` - Indicates the async operation is in progress
     *   - `{ status: "success", data: Data }` - Indicates successful completion with data
     *   - `{ status: "error", error: unknown }` - Indicates failure with an error
     *
     * @example
     * Basic state transitions:
     * ```typescript
     * const asyncFlow = createAsyncFlow<string>({ status: "pending" });
     *
     * // Start an async operation
     * asyncFlow.emit({ status: "pending" });
     *
     * // Complete successfully
     * asyncFlow.emit({ status: "success", data: "Hello World" });
     *
     * // Or handle an error
     * asyncFlow.emit({ status: "error", error: new Error("Something went wrong") });
     * ```
     */
    public emit(value: AsyncFlowState<Data>): void {
        switch (value.status) {
            case "pending":
                if (this.value.status !== "pending") {
                    this.promise = null;
                }
                break;
            case "success":
            case "error":
                if (this.value.status !== "pending") {
                    this.promise = null;
                }
                break;
        }

        super.emit(value);
    }

    /**
     * Returns a promise that resolves with the data when the async flow reaches a success state,
     * or rejects with the error when the async flow reaches an error state.
     *
     * If the current state is already resolved (success or error), the promise resolves/rejects immediately.
     * If the current state is pending, the method subscribes to state changes and waits for resolution.
     *
     * @returns A promise that resolves with the data on success, or rejects with the error on failure
     *
     * @example
     * ```typescript
     * const asyncFlow = createAsyncFlow<string>({ status: "pending" });
     *
     * // This will wait for the flow to resolve
     * asyncFlow.asPromise()
     *   .then(data => console.log('Success:', data))
     *   .catch(error => console.error('Error:', error));
     *
     * // Later, emit a success state
     * asyncFlow.emit({ status: "success", data: "Hello World" });
     * ```
     */
    public asPromise(): Promise<Data> {
        this.promise ??= new Promise<Data>((resolve, reject) => {
            const state = this.getSnapshot();

            if (state.status === "success") {
                resolve(state.data);
                return;
            }

            if (state.status === "error") {
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Intentionally preserve the original error to avoid transformations that could break user error handling
                reject(state.error);
                return;
            }

            const subscription = this.subscribe(() => {
                const state = this.getSnapshot();

                // still loading, wait for the next value
                if (state.status === "pending") {
                    return;
                }

                subscription.unsubscribe();

                if (state.status === "error") {
                    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Intentionally preserve the original error to avoid transformations that could break user error handling
                    reject(state.error);
                    return;
                }

                resolve(state.data);
            });
        });

        return this.promise;
    }

    /**
     * Converts this MutableAsyncFlow to a read-only AsyncFlow.
     *
     * The returned AsyncFlow provides the same reactive capabilities
     * but without the ability to emit new values. This is useful for exposing
     * read-only access to the flow's value while maintaining control over mutations.
     *
     * @returns A read-only Flow
     *
     * @example
     * ```typescript
     * const mutableFlow = createAsyncFlow<number>({ status: "pending" });
     * const readOnlyFlow = mutableFlow.asFlow();
     *
     * // This works - reading and subscribing
     * const snapshot = readOnlyFlow.getSnapshot();
     * const unsubscribe = readOnlyFlow.subscribe(callback);
     *
     * // This would cause a TypeScript error - no mutation methods available
     * // readOnlyFlow.emit({ status: "success", data: 42 }); // ❌ Error
     * ```
     */
    public asFlow(): AsyncFlow<Data> {
        return this;
    }
}

/**
 * Creates a new MutableAsyncFlow with the specified initial state.
 *
 * @typeParam Data - The type of data that will be available when the async operation succeeds
 *
 * @param initialValue - The initial state of the async flow. Can be:
 *   - `{ status: "pending" }` - For operations that haven't completed yet
 *   - `{ status: "success", data: Data }` - For operations that completed successfully
 *   - `{ status: "error", error: unknown }` - For operations that failed
 *
 * @returns A new MutableAsyncFlow instance initialized with the given value
 *
 * @example
 * Basic usage with pending state:
 * ```typescript
 * const userFlow = createAsyncFlow<User>({ status: "pending" });
 *
 * // Subscribe to state changes
 * userFlow.subscribe((state) => {
 *   if (state.status === "success") {
 *     console.log("User loaded:", state.data);
 *   } else if (state.status === "error") {
 *     console.error("Failed to load user:", state.error);
 *   }
 * });
 *
 * // Simulate async operation
 * fetchUser()
 *   .then(user => userFlow.emit({ status: "success", data: user }))
 *   .catch(error => userFlow.emit({ status: "error", error }));
 * ```
 *
 * @example
 * Starting with a success state:
 * ```typescript
 * const cachedDataFlow = createAsyncFlow<string>({
 *   status: "success",
 *   data: "cached value"
 * });
 *
 * // Immediately available data
 * const snapshot = cachedDataFlow.getSnapshot();
 * if (snapshot.status === "success") {
 *   console.log(snapshot.data); // "cached value"
 * }
 * ```
 *
 * @example
 * Using with async/await pattern:
 * ```typescript
 * const apiFlow = createAsyncFlow<ApiResponse>({ status: "pending" });
 *
 * async function loadData() {
 *   try {
 *     apiFlow.emit({ status: "pending" });
 *     const response = await fetch('/api/data');
 *     const data = await response.json();
 *     apiFlow.emit({ status: "success", data });
 *   } catch (error) {
 *     apiFlow.emit({ status: "error", error });
 *   }
 * }
 *
 * // Wait for the data to be available
 * const data = await apiFlow.asPromise();
 * ```
 */
export function createAsyncFlow<Data>(initialValue: AsyncFlowState<Data>): MutableAsyncFlow<Data> {
    return new MutableAsyncFlowImpl(initialValue);
}
