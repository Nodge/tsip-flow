import type { Flow, FlowSubscription, MutableFlow } from "@tsip/types";

/**
 * Internal subscription object that extends the public FlowSubscription interface.
 *
 * This interface is used internally by MutableFlowImpl to store both the public
 * unsubscribe method and the private listener function for each subscription.
 *
 * @internal
 */
export interface Subscription extends FlowSubscription {
    /**
     * The listener function that will be called when the flow's value changes.
     */
    listener: () => void;
}

/**
 * Implementation of a MutableFlow from the TypeScript Interface Proposals.
 *
 * @typeParam Data - The type of data stored in the flow
 */
export class MutableFlowImpl<Data> implements MutableFlow<Data> {
    /**
     * The current value stored in the flow.
     */
    protected value: Data;

    /**
     * Set of listener functions that are called when the value changes.
     */
    protected subscriptions: Set<Subscription>;

    /**
     * Creates a new MutableFlowImpl instance with the given initial value.
     *
     * @param initialValue - The initial value to store in the flow
     */
    public constructor(initialValue: Data) {
        this.value = initialValue;
        this.subscriptions = new Set();
    }

    /**
     * Subscribes to changes in the flow.
     *
     * The listener function will be called synchronously whenever the flow's value changes
     * via the {@link emit} method. The listener receives no parameters and
     * should use {@link getSnapshot} to access the current value.
     *
     * @param listener - A callback function that will be invoked on value changes
     * @returns A subscription object that can be used to unsubscribe from changes
     *
     * @example
     * ```typescript
     * const flow = createFlow(0);
     *
     * const subscription = flow.subscribe(() => {
     *   console.log('New value:', flow.getSnapshot());
     * });
     *
     * flow.emit(1); // Triggers the listener
     * subscription.unsubscribe(); // Stop listening to changes
     * ```
     */
    public subscribe(listener: () => void): FlowSubscription {
        const subscription: Subscription = {
            listener,
            unsubscribe: () => {
                this.subscriptions.delete(subscription);
            },
        };

        this.subscriptions.add(subscription);

        return subscription;
    }

    /**
     * Emits a new value to the flow.
     *
     * This method updates the internal state and triggers all registered listeners
     * to be called synchronously.
     *
     * @param value - The new value
     *
     * @example
     * ```typescript
     * const flow = createFlow(0);
     *
     * flow.subscribe(() => {
     *   console.log('Updated to:', flow.getSnapshot());
     * });
     *
     * flow.emit(42); // Logs: "Updated to: 42"
     * flow.emit(100); // Logs: "Updated to: 100"
     * ```
     */
    public emit(value: Data): void {
        this.value = value;

        const errors: unknown[] = [];

        for (const subscription of this.subscriptions) {
            try {
                subscription.listener();
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "Failed to call flow listeners");
        }
    }

    /**
     * Returns the current value of the flow.
     *
     * This method provides synchronous access to the current value without
     * subscribing to changes. It's safe to call at any time and will always
     * return the most recent value.
     *
     * @returns The current value
     *
     * @example
     * ```typescript
     * const flow = createFlow("initial");
     *
     * console.log(flow.getSnapshot()); // "initial"
     *
     * flow.emit("updated");
     * console.log(flow.getSnapshot()); // "updated"
     * ```
     */
    public getSnapshot(): Data {
        return this.value;
    }

    /**
     * Converts this MutableFlow to a read-only Flow.
     *
     * The returned Flow provides the same reactive capabilities
     * but without the ability to emit new values. This is useful for exposing
     * read-only access to the flow's value while maintaining control over mutations.
     *
     * @returns A read-only Flow
     *
     * @example
     * ```typescript
     * const mutableFlow = createFlow(0);
     * const readOnlyFlow = mutableFlow.asFlow();
     *
     * // Can read and subscribe
     * console.log(readOnlyFlow.getSnapshot()); // 0
     * readOnlyFlow.subscribe(() => console.log('Changed!'));
     *
     * // Cannot emit (method doesn't exist on Flow interface)
     * // readOnlyFlow.emit(1); // TypeScript error
     *
     * // But the original can still emit
     * mutableFlow.emit(1); // Triggers the subscriber
     * ```
     */
    public asFlow(): Flow<Data> {
        return this;
    }
}

/**
 * Creates a new MutableFlow with the specified initial value.
 *
 * @typeParam Data - The type of data that will be stored in the flow
 * @param initialValue - The initial value to store in the flow
 * @returns A new MutableFlow instance initialized with the given value
 *
 * @example
 * ```typescript
 * // Create flows with different data types
 * const numberFlow = createFlow(0);
 * const stringFlow = createFlow("hello");
 * const booleanFlow = createFlow(true);
 * const objectFlow = createFlow({ count: 0, name: "example" });
 *
 * // Use the flow
 * numberFlow.subscribe(() => {
 *   console.log('Number changed to:', numberFlow.getSnapshot());
 * });
 *
 * numberFlow.emit(42); // Logs: "Number changed to: 42"
 * ```
 *
 * @example
 * ```typescript
 * // Creating a counter flow
 * const counter = createFlow(0);
 *
 * const increment = () => {
 *   const current = counter.getSnapshot();
 *   counter.emit(current + 1);
 * };
 *
 * counter.subscribe(() => {
 *   console.log(`Counter: ${counter.getSnapshot()}`);
 * });
 *
 * increment(); // Logs: "Counter: 1"
 * increment(); // Logs: "Counter: 2"
 * ```
 */
export function createFlow<Data>(initialValue: Data): MutableFlow<Data> {
    return new MutableFlowImpl(initialValue);
}
