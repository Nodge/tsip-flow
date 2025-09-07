import { describe, it, expect, vi, beforeEach, expectTypeOf } from "vitest";
import type { AsyncFlow, FlowSubscription, MutableAsyncFlow, AsyncFlowState } from "@tsip/types";
import { createAsyncFlow, MutableAsyncFlowImpl } from "./create-async-flow";

describe("createAsyncFlow", () => {
    it("should create a MutableAsyncFlow with pending initial state", () => {
        const flow = createAsyncFlow<string>({ status: "pending" });
        expect(flow.getSnapshot()).toEqual({ status: "pending" });
    });

    it("should create a MutableAsyncFlow with success initial state", () => {
        const flow = createAsyncFlow<number>({ status: "success", data: 42 });
        expect(flow.getSnapshot()).toEqual({ status: "success", data: 42 });
    });

    it("should create a MutableAsyncFlow with error initial state", () => {
        const error = new Error("Test error");
        const flow = createAsyncFlow<string>({ status: "error", error });
        expect(flow.getSnapshot()).toEqual({ status: "error", error });
    });

    it("should create flows with different data types", () => {
        const numberFlow: MutableAsyncFlow<number> = createAsyncFlow({ status: "pending" });
        expect(numberFlow.getSnapshot()).toEqual({ status: "pending" });
        expectTypeOf(numberFlow).toEqualTypeOf<MutableAsyncFlow<number>>();

        const stringFlow: MutableAsyncFlow<string> = createAsyncFlow({ status: "success", data: "hello" });
        expect(stringFlow.getSnapshot()).toEqual({ status: "success", data: "hello" });
        expectTypeOf(stringFlow).toEqualTypeOf<MutableAsyncFlow<string>>();

        const booleanFlow: MutableAsyncFlow<boolean> = createAsyncFlow({ status: "success", data: true });
        expect(booleanFlow.getSnapshot()).toEqual({ status: "success", data: true });
        expectTypeOf(booleanFlow).toEqualTypeOf<MutableAsyncFlow<boolean>>();

        const objectFlow: MutableAsyncFlow<{ count: number; name: string }> = createAsyncFlow({
            status: "success",
            data: { count: 0, name: "example" },
        });
        expect(objectFlow.getSnapshot()).toEqual({ status: "success", data: { count: 0, name: "example" } });
        expectTypeOf(objectFlow).toEqualTypeOf<MutableAsyncFlow<{ count: number; name: string }>>();
    });

    it("should work with union types", () => {
        const unionFlow: MutableAsyncFlow<string | number> = createAsyncFlow<string | number>({
            status: "success",
            data: "initial",
        });

        expectTypeOf(unionFlow).toEqualTypeOf<MutableAsyncFlow<string | number>>();
        expectTypeOf(unionFlow.getSnapshot()).toEqualTypeOf<AsyncFlowState<string | number>>();
        expectTypeOf<typeof unionFlow.emit>().parameter(0).toEqualTypeOf<AsyncFlowState<string | number>>();
    });
});

describe("MutableAsyncFlowImpl", () => {
    let flow: MutableAsyncFlow<number>;

    beforeEach(() => {
        flow = createAsyncFlow<number>({ status: "pending" });
    });

    describe("getSnapshot", () => {
        it("should return the current state", () => {
            expect(flow.getSnapshot()).toEqual({ status: "pending" });
        });

        it("should return the updated state after emit", () => {
            flow.emit({ status: "success", data: 42 });
            expect(flow.getSnapshot()).toEqual({ status: "success", data: 42 });
        });

        it("should always return the most recent state", () => {
            flow.emit({ status: "success", data: 1 });
            expect(flow.getSnapshot()).toEqual({ status: "success", data: 1 });

            flow.emit({ status: "pending" });
            expect(flow.getSnapshot()).toEqual({ status: "pending" });

            const error = new Error("Test error");
            flow.emit({ status: "error", error });
            expect(flow.getSnapshot()).toEqual({ status: "error", error });
        });
    });

    describe("getDataSnapshot", () => {
        it("should resolve immediately when state is success", async () => {
            flow.emit({ status: "success", data: 42 });

            let result: unknown;
            void flow.getDataSnapshot().then((data) => {
                result = data;
            });

            await Promise.resolve(); // wait microtasks

            expect(result).toBe(42);
        });

        it("should reject immediately when state is error", async () => {
            const error = new Error("Test error");
            flow.emit({ status: "error", error });

            let result: unknown;
            void flow.getDataSnapshot().then(
                () => {
                    result = "resolved";
                },
                (error: unknown) => {
                    result = error;
                },
            );

            await Promise.resolve(); // wait microtasks

            expect(result).toBe(error);
        });

        it("should wait for success state when initially pending", async () => {
            const dataPromise = flow.getDataSnapshot();

            // Emit success after a short delay
            setTimeout(() => {
                flow.emit({ status: "success", data: 123 });
            }, 10);

            const result = await dataPromise;
            expect(result).toBe(123);
        });

        it("should wait for error state when initially pending", async () => {
            const dataPromise = flow.getDataSnapshot();
            const error = new Error("Async error");

            // Emit error after a short delay
            setTimeout(() => {
                flow.emit({ status: "error", error });
            }, 10);

            await expect(dataPromise).rejects.toBe(error);
        });

        it("should handle multiple pending -> success transitions", async () => {
            const promise1 = flow.getDataSnapshot();
            const promise2 = flow.getDataSnapshot();

            flow.emit({ status: "success", data: 456 });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toBe(456);
            expect(result2).toBe(456);
        });

        it("should handle multiple pending -> error transitions", async () => {
            const promise1 = flow.getDataSnapshot();
            const promise2 = flow.getDataSnapshot();
            const error = new Error("Multi error");

            flow.emit({ status: "error", error });

            await expect(Promise.all([promise1, promise2])).rejects.toBe(error);
        });

        it("should dedupe promises with multiple pending -> success transitions", async () => {
            const promise1 = flow.getDataSnapshot();
            const promise2 = flow.getDataSnapshot();

            expect(promise1).toBe(promise2);

            flow.emit({ status: "success", data: 456 });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toBe(456);
            expect(result2).toBe(456);
        });

        it("should return new promise after success transition", async () => {
            const promise1 = flow.getDataSnapshot();
            const promise2 = flow.getDataSnapshot();

            expect(promise1).toBe(promise2);

            flow.emit({ status: "success", data: 456 });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toBe(456);
            expect(result2).toBe(456);

            const promise3 = flow.getDataSnapshot();
            expect(promise1).not.toBe(promise3);
            await expect(promise3).resolves.toBe(456);
        });

        it("should ignore intermediate pending states", async () => {
            const dataPromise = flow.getDataSnapshot();

            setTimeout(() => {
                flow.emit({ status: "pending" }); // Should be ignored
                flow.emit({ status: "pending" }); // Should be ignored
                flow.emit({ status: "success", data: 789 });
            }, 10);

            const result = await dataPromise;
            expect(result).toBe(789);
        });

        it("should work with different data types", async () => {
            const stringFlow = createAsyncFlow<string>({ status: "success", data: "test" });
            const stringResult = await stringFlow.getDataSnapshot();
            expect(stringResult).toBe("test");
            expectTypeOf(stringResult).toEqualTypeOf<string>();

            const objectFlow = createAsyncFlow<{ id: number }>({ status: "success", data: { id: 1 } });
            const objectResult = await objectFlow.getDataSnapshot();
            expect(objectResult).toEqual({ id: 1 });
            expectTypeOf(objectResult).toEqualTypeOf<{ id: number }>();
        });

        it("should preserve error types and values", async () => {
            const customError = { code: 404, message: "Not found" };
            flow.emit({ status: "error", error: customError });

            await expect(flow.getDataSnapshot()).rejects.toBe(customError);
        });
    });

    describe("subscribe", () => {
        it("should return a FlowSubscription object", () => {
            const listener = vi.fn();
            const subscription = flow.subscribe(listener);

            expectTypeOf(subscription).toEqualTypeOf<FlowSubscription>();
            expect(subscription).toHaveProperty("unsubscribe");
            expect(typeof subscription.unsubscribe).toBe("function");
        });

        it("should support multiple subscriptions", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            flow.subscribe(listener1);
            flow.subscribe(listener2);
            flow.subscribe(listener3);

            flow.emit({ status: "success", data: 1 });

            expect(listener1).toBeCalledTimes(1);
            expect(listener2).toBeCalledTimes(1);
            expect(listener3).toBeCalledTimes(1);
        });

        it("should allow the same listener to be subscribed multiple times", () => {
            const listener = vi.fn();

            const sub1 = flow.subscribe(listener);
            const sub2 = flow.subscribe(listener);

            expect(sub1).not.toBe(sub2);

            flow.emit({ status: "success", data: 1 });

            expect(listener).toHaveBeenCalledTimes(2);
        });
    });

    describe("emit", () => {
        it("should update the internal state", () => {
            flow.emit({ status: "success", data: 42 });
            expect(flow.getSnapshot()).toEqual({ status: "success", data: 42 });
        });

        it("should enforce correct parameter types", () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const stringFlow = createAsyncFlow<string>({ status: "pending" });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const numberFlow = createAsyncFlow<number>({ status: "pending" });

            expectTypeOf<typeof stringFlow.emit>().parameter(0).toEqualTypeOf<AsyncFlowState<string>>();
            expectTypeOf<typeof numberFlow.emit>().parameter(0).toEqualTypeOf<AsyncFlowState<number>>();
        });

        it("should call all subscribed listeners synchronously", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            flow.subscribe(listener1);
            flow.subscribe(listener2);
            flow.subscribe(listener3);

            flow.emit({ status: "success", data: 1 });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it("should call listeners with no parameters", () => {
            const listener = vi.fn();
            flow.subscribe(listener);

            flow.emit({ status: "success", data: 42 });

            expect(listener).toHaveBeenCalledWith();
        });

        it("should call listeners in the order they were added", () => {
            const callOrder: number[] = [];

            const listener1 = vi.fn(() => callOrder.push(1));
            const listener2 = vi.fn(() => callOrder.push(2));
            const listener3 = vi.fn(() => callOrder.push(3));

            flow.subscribe(listener1);
            flow.subscribe(listener2);
            flow.subscribe(listener3);

            flow.emit({ status: "success", data: 1 });

            expect(callOrder).toEqual([1, 2, 3]);
        });

        it("should allow listeners to access the new state via getSnapshot", () => {
            let capturedState: AsyncFlowState<number> | undefined;

            flow.subscribe(() => {
                capturedState = flow.getSnapshot();
            });

            flow.emit({ status: "success", data: 42 });
            expect(capturedState).toEqual({ status: "success", data: 42 });
        });

        it("should handle multiple emit calls", () => {
            const listener = vi.fn();
            flow.subscribe(listener);

            const error = new Error("test");

            flow.emit({ status: "pending" });
            flow.emit({ status: "success", data: 2 });
            flow.emit({ status: "error", error });

            expect(listener).toHaveBeenCalledTimes(3);
            expect(flow.getSnapshot()).toEqual({ status: "error", error });
        });

        describe("error handling", () => {
            it("should catch errors from listeners and throw AggregateError", () => {
                const error1 = new Error("Listener 1 error");
                const error2 = new Error("Listener 2 error");

                flow.subscribe(() => {
                    throw error1;
                });
                flow.subscribe(() => {
                    throw error2;
                });

                expect(() => {
                    flow.emit({ status: "success", data: 1 });
                }).toThrow(AggregateError);

                try {
                    flow.emit({ status: "success", data: 1 });
                } catch (aggregateError) {
                    expect(aggregateError).toBeInstanceOf(AggregateError);
                    expect((aggregateError as AggregateError).message).toBe("Failed to call flow listeners");
                    expect((aggregateError as AggregateError).errors).toEqual([error1, error2]);
                }
            });

            it("should still update the state even if listeners throw", () => {
                flow.subscribe(() => {
                    throw new Error("Listener error");
                });

                expect(() => {
                    flow.emit({ status: "success", data: 42 });
                }).toThrow();
                expect(flow.getSnapshot()).toEqual({ status: "success", data: 42 });
            });

            it("should call all listeners even if some throw", () => {
                const listener1 = vi.fn(() => {
                    throw new Error("Error 1");
                });
                const listener2 = vi.fn();
                const listener3 = vi.fn(() => {
                    throw new Error("Error 3");
                });

                flow.subscribe(listener1);
                flow.subscribe(listener2);
                flow.subscribe(listener3);

                expect(() => {
                    flow.emit({ status: "success", data: 1 });
                }).toThrow();

                expect(listener1).toHaveBeenCalledTimes(1);
                expect(listener2).toHaveBeenCalledTimes(1);
                expect(listener3).toHaveBeenCalledTimes(1);
            });

            it("should not throw if no listeners throw", () => {
                const listener1 = vi.fn();
                const listener2 = vi.fn();

                flow.subscribe(listener1);
                flow.subscribe(listener2);

                expect(() => {
                    flow.emit({ status: "success", data: 1 });
                }).not.toThrow();
            });

            it("should handle mixed success and error scenarios", () => {
                const successListener = vi.fn();
                const errorListener = vi.fn(() => {
                    throw new Error("Test error");
                });

                flow.subscribe(successListener);
                flow.subscribe(errorListener);
                flow.subscribe(successListener);

                expect(() => {
                    flow.emit({ status: "success", data: 1 });
                }).toThrow(AggregateError);
                expect(successListener).toHaveBeenCalledTimes(2);
                expect(errorListener).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("unsubscribe", () => {
        it("should stop calling the listener after unsubscribe", () => {
            const listener = vi.fn();
            const subscription = flow.subscribe(listener);

            flow.emit({ status: "success", data: 1 });
            expect(listener).toHaveBeenCalledTimes(1);

            subscription.unsubscribe();

            flow.emit({ status: "success", data: 2 });
            expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it("should handle multiple calls to unsubscribe gracefully", () => {
            const listener = vi.fn();
            flow.subscribe(listener);
            const subscription = flow.subscribe(listener);

            subscription.unsubscribe();
            expect(() => {
                subscription.unsubscribe();
            }).not.toThrow();
            expect(() => {
                subscription.unsubscribe();
            }).not.toThrow();
        });

        it("should only remove the specific subscription", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            flow.subscribe(listener1);
            const sub2 = flow.subscribe(listener2);
            flow.subscribe(listener3);

            sub2.unsubscribe();

            flow.emit({ status: "success", data: 1 });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(0);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it("should handle unsubscribing the same listener subscribed multiple times", () => {
            const listener = vi.fn();

            const sub1 = flow.subscribe(listener);
            const sub2 = flow.subscribe(listener);

            flow.emit({ status: "success", data: 1 });
            expect(listener).toHaveBeenCalledTimes(2);

            sub1.unsubscribe();

            flow.emit({ status: "success", data: 2 });
            expect(listener).toHaveBeenCalledTimes(3); // Called once more (2 + 1)

            sub2.unsubscribe();

            flow.emit({ status: "success", data: 3 });
            expect(listener).toHaveBeenCalledTimes(3); // No more calls
        });
    });

    describe("asFlow", () => {
        it("should return an AsyncFlow interface", () => {
            const readOnlyFlow = flow.asFlow();

            expectTypeOf(readOnlyFlow).toEqualTypeOf<AsyncFlow<number>>();
            expect(readOnlyFlow).toHaveProperty("subscribe");
            expect(readOnlyFlow).toHaveProperty("getSnapshot");
            expect(readOnlyFlow).toHaveProperty("getDataSnapshot");
            expect(typeof readOnlyFlow.subscribe).toBe("function");
            expect(typeof readOnlyFlow.getSnapshot).toBe("function");
            expect(typeof readOnlyFlow.getDataSnapshot).toBe("function");
        });

        it("should provide read-only access to the same data", () => {
            flow.emit({ status: "success", data: 42 });
            const readOnlyFlow = flow.asFlow();

            expect(readOnlyFlow.getSnapshot()).toEqual({ status: "success", data: 42 });
        });

        it("should allow subscriptions through the read-only interface", () => {
            const readOnlyFlow = flow.asFlow();
            const listener = vi.fn();

            const subscription = readOnlyFlow.subscribe(listener);
            flow.emit({ status: "success", data: 1 });

            expect(listener).toHaveBeenCalledTimes(1);

            subscription.unsubscribe();
            flow.emit({ status: "success", data: 2 });

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it("should reflect changes made to the original mutable flow", () => {
            const readOnlyFlow = flow.asFlow();
            const listener = vi.fn();

            readOnlyFlow.subscribe(listener);

            flow.emit({ status: "success", data: 100 });

            expect(readOnlyFlow.getSnapshot()).toEqual({ status: "success", data: 100 });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it("should support getDataSnapshot through the read-only interface", async () => {
            const readOnlyFlow = flow.asFlow();

            flow.emit({ status: "success", data: 999 });
            const result = await readOnlyFlow.getDataSnapshot();

            expect(result).toBe(999);
        });
    });

    describe("integration scenarios", () => {
        it("should handle complex subscription and emission patterns", () => {
            const states: AsyncFlowState<number>[] = [];

            // Subscribe before any emissions
            const sub1 = flow.subscribe(() => {
                states.push(flow.getSnapshot());
            });

            flow.emit({ status: "pending" });
            flow.emit({ status: "success", data: 2 });

            // Subscribe after some emissions
            flow.subscribe(() => {
                const state = flow.getSnapshot();
                if (state.status === "success") {
                    states.push({ status: "success", data: state.data * 10 });
                }
            });

            flow.emit({ status: "success", data: 3 });

            // Unsubscribe first listener
            sub1.unsubscribe();

            flow.emit({ status: "success", data: 4 });

            expect(states).toEqual([
                { status: "pending" },
                { status: "success", data: 2 },
                { status: "success", data: 3 },
                { status: "success", data: 30 },
                { status: "success", data: 40 },
            ]);
        });

        it("should work correctly with object values", () => {
            interface TestObject {
                count: number;
                name: string;
            }

            const objectFlow = new MutableAsyncFlowImpl<TestObject>({ status: "pending" });
            const capturedStates: AsyncFlowState<TestObject>[] = [];

            objectFlow.subscribe(() => {
                const state = objectFlow.getSnapshot();
                capturedStates.push(state);
            });

            objectFlow.emit({ status: "success", data: { count: 1, name: "first" } });
            objectFlow.emit({ status: "success", data: { count: 2, name: "second" } });

            expect(capturedStates).toEqual([
                { status: "success", data: { count: 1, name: "first" } },
                { status: "success", data: { count: 2, name: "second" } },
            ]);
        });

        it("should handle rapid successive emissions", () => {
            const listener = vi.fn();
            flow.subscribe(listener);

            // Emit many values rapidly
            for (let i = 0; i < 100; i++) {
                flow.emit({ status: "success", data: i });
            }

            expect(listener).toHaveBeenCalledTimes(100);
            expect(flow.getSnapshot()).toEqual({ status: "success", data: 99 });
        });

        it("should work with async operation simulation", async () => {
            const userFlow = createAsyncFlow<{ id: number; name: string }>({ status: "pending" });
            const states: string[] = [];

            userFlow.subscribe(() => {
                const state = userFlow.getSnapshot();
                states.push(state.status);
            });

            // Simulate async operation
            const simulateAsyncOperation = async () => {
                userFlow.emit({ status: "pending" });

                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 10));

                userFlow.emit({ status: "success", data: { id: 1, name: "John" } });
            };

            await simulateAsyncOperation();
            const userData = await userFlow.getDataSnapshot();

            expect(states).toEqual(["pending", "success"]);
            expect(userData).toEqual({ id: 1, name: "John" });
        });

        it("should handle error scenarios in async operations", async () => {
            const apiFlow = createAsyncFlow<string>({ status: "pending" });
            const states: string[] = [];

            apiFlow.subscribe(() => {
                const state = apiFlow.getSnapshot();
                states.push(state.status);
            });

            // Simulate failed async operation
            const simulateFailedOperation = async () => {
                apiFlow.emit({ status: "pending" });

                await new Promise((resolve) => setTimeout(resolve, 10));

                apiFlow.emit({ status: "error", error: new Error("Network error") });
            };

            await simulateFailedOperation();

            await expect(apiFlow.getDataSnapshot()).rejects.toThrow("Network error");
            expect(states).toEqual(["pending", "error"]);
        });

        it("should support multiple concurrent getDataSnapshot calls", async () => {
            const promises = [flow.getDataSnapshot(), flow.getDataSnapshot(), flow.getDataSnapshot()];

            setTimeout(() => {
                flow.emit({ status: "success", data: 555 });
            }, 10);

            const results = await Promise.all(promises);
            expect(results).toEqual([555, 555, 555]);
        });

        it("should handle state transitions correctly", () => {
            const transitionFlow = createAsyncFlow<string>({ status: "pending" });
            const stateHistory: string[] = [];

            transitionFlow.subscribe(() => {
                stateHistory.push(transitionFlow.getSnapshot().status);
            });

            // Test pending -> success -> pending -> error flow
            transitionFlow.emit({ status: "success", data: "first" });
            transitionFlow.emit({ status: "pending" });
            transitionFlow.emit({ status: "error", error: new Error("failed") });

            expect(stateHistory).toEqual(["success", "pending", "error"]);
        });
    });
});
