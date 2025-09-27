import { describe, it, expect, vi, beforeEach, expectTypeOf } from "vitest";
import type { Flow, FlowSubscription, MutableFlow } from "@tsip/types";
import { createFlow, MutableFlowImpl } from "./create-flow";

describe("createFlow", () => {
    it("should create a MutableFlow with the initial value", () => {
        const flow = createFlow(42);
        expect(flow.getSnapshot()).toBe(42);
    });

    it("should create flows with different data types", () => {
        const numberFlow = createFlow(0);
        expect(numberFlow.getSnapshot()).toBe(0);
        expectTypeOf(numberFlow).toEqualTypeOf<MutableFlow<number>>();

        const stringFlow = createFlow("hello");
        expect(stringFlow.getSnapshot()).toBe("hello");
        expectTypeOf(stringFlow).toEqualTypeOf<MutableFlow<string>>();

        const booleanFlow = createFlow(true);
        expect(booleanFlow.getSnapshot()).toBe(true);
        expectTypeOf(booleanFlow).toEqualTypeOf<MutableFlow<boolean>>();

        const objectFlow = createFlow({ count: 0, name: "example" });
        expect(objectFlow.getSnapshot()).toEqual({ count: 0, name: "example" });
        expectTypeOf(objectFlow).toEqualTypeOf<MutableFlow<{ count: number; name: string }>>();
    });

    it("should work with union types", () => {
        const unionFlow = createFlow<string | number>("initial");

        expectTypeOf(unionFlow).toEqualTypeOf<MutableFlow<string | number>>();
        expectTypeOf(unionFlow.getSnapshot()).toEqualTypeOf<string | number>();
        expectTypeOf<typeof unionFlow.emit>().parameter(0).toEqualTypeOf<string | number>();
    });
});

describe("MutableFlowImpl", () => {
    let flow: MutableFlow<number>;

    beforeEach(() => {
        flow = createFlow(0);
    });

    describe("getSnapshot", () => {
        it("should return the current value", () => {
            expect(flow.getSnapshot()).toBe(0);
        });

        it("should return the updated value after emit", () => {
            flow.emit(42);
            expect(flow.getSnapshot()).toBe(42);
        });

        it("should always return the most recent value", () => {
            flow.emit(1);
            expect(flow.getSnapshot()).toBe(1);

            flow.emit(2);
            expect(flow.getSnapshot()).toBe(2);

            flow.emit(3);
            expect(flow.getSnapshot()).toBe(3);
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

            flow.emit(1);

            expect(listener1).toBeCalledTimes(1);
            expect(listener2).toBeCalledTimes(1);
            expect(listener3).toBeCalledTimes(1);
        });

        it("should allow the same listener to be subscribed multiple times", () => {
            const listener = vi.fn();

            const sub1 = flow.subscribe(listener);
            const sub2 = flow.subscribe(listener);

            expect(sub1).not.toBe(sub2);

            flow.emit(1);

            expect(listener).toHaveBeenCalledTimes(2);
        });

        it("should not call listeners added during notification stage", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            flow.subscribe(() => {
                listener1();
                flow.subscribe(listener2);
            });

            flow.emit(1);

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(0);
        });

        it("should not listeners removed during notification stage", () => {
            const listener = vi.fn();

            flow.subscribe(() => {
                sub.unsubscribe();
            });
            const sub = flow.subscribe(listener);

            flow.emit(1);

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe("emit", () => {
        it("should update the internal value", () => {
            flow.emit(42);
            expect(flow.getSnapshot()).toBe(42);
        });

        it("should enforce correct parameter types", () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const stringFlow = createFlow("initial");
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const numberFlow = createFlow(0);

            expectTypeOf<typeof stringFlow.emit>().parameter(0).toEqualTypeOf<string>();
            expectTypeOf<typeof numberFlow.emit>().parameter(0).toEqualTypeOf<number>();
        });

        it("should call all subscribed listeners synchronously", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            flow.subscribe(listener1);
            flow.subscribe(listener2);
            flow.subscribe(listener3);

            flow.emit(1);

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it("should call listeners with no parameters", () => {
            const listener = vi.fn();
            flow.subscribe(listener);

            flow.emit(42);

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

            flow.emit(1);

            expect(callOrder).toEqual([1, 2, 3]);
        });

        it("should allow listeners to access the new value via getSnapshot", () => {
            let capturedValue: number | undefined;

            flow.subscribe(() => {
                capturedValue = flow.getSnapshot();
            });

            flow.emit(42);
            expect(capturedValue).toBe(42);
        });

        it("should handle multiple emit calls", () => {
            const listener = vi.fn();
            flow.subscribe(listener);

            flow.emit(1);
            flow.emit(2);
            flow.emit(3);

            expect(listener).toHaveBeenCalledTimes(3);
            expect(flow.getSnapshot()).toBe(3);
        });

        it("should not call listeners if there are no subscriptions", () => {
            expect(() => {
                flow.emit(42);
            }).not.toThrow();
            expect(flow.getSnapshot()).toBe(42);
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
                    flow.emit(1);
                }).toThrow(AggregateError);

                try {
                    flow.emit(1);
                } catch (aggregateError) {
                    expect(aggregateError).toBeInstanceOf(AggregateError);
                    expect((aggregateError as AggregateError).message).toBe("Failed to call flow listeners");
                    expect((aggregateError as AggregateError).errors).toEqual([error1, error2]);
                }
            });

            it("should still update the value even if listeners throw", () => {
                flow.subscribe(() => {
                    throw new Error("Listener error");
                });

                expect(() => {
                    flow.emit(42);
                }).toThrow();
                expect(flow.getSnapshot()).toBe(42);
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
                    flow.emit(1);
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
                    flow.emit(1);
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
                    flow.emit(1);
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

            flow.emit(1);
            expect(listener).toHaveBeenCalledTimes(1);

            subscription.unsubscribe();

            flow.emit(2);
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

            flow.emit(1);

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(0);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it("should handle unsubscribing the same listener subscribed multiple times", () => {
            const listener = vi.fn();

            const sub1 = flow.subscribe(listener);
            const sub2 = flow.subscribe(listener);

            flow.emit(1);
            expect(listener).toHaveBeenCalledTimes(2);

            sub1.unsubscribe();

            flow.emit(2);
            expect(listener).toHaveBeenCalledTimes(3); // Called once more (2 + 1)

            sub2.unsubscribe();

            flow.emit(3);
            expect(listener).toHaveBeenCalledTimes(3); // No more calls
        });
    });

    describe("asFlow", () => {
        it("should return a Flow interface", () => {
            const readOnlyFlow = flow.asFlow();

            expectTypeOf(readOnlyFlow).toEqualTypeOf<Flow<number>>();
            expect(readOnlyFlow).toHaveProperty("subscribe");
            expect(readOnlyFlow).toHaveProperty("getSnapshot");
            expect(typeof readOnlyFlow.subscribe).toBe("function");
            expect(typeof readOnlyFlow.getSnapshot).toBe("function");
        });

        it("should provide read-only access to the same data", () => {
            flow.emit(42);
            const readOnlyFlow = flow.asFlow();

            expect(readOnlyFlow.getSnapshot()).toBe(42);
        });

        it("should allow subscriptions through the read-only interface", () => {
            const readOnlyFlow = flow.asFlow();
            const listener = vi.fn();

            const subscription = readOnlyFlow.subscribe(listener);
            flow.emit(1);

            expect(listener).toHaveBeenCalledTimes(1);

            subscription.unsubscribe();
            flow.emit(2);

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it("should reflect changes made to the original mutable flow", () => {
            const readOnlyFlow = flow.asFlow();
            const listener = vi.fn();

            readOnlyFlow.subscribe(listener);

            flow.emit(100);

            expect(readOnlyFlow.getSnapshot()).toBe(100);
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe("integration scenarios", () => {
        it("should handle complex subscription and emission patterns", () => {
            const values: number[] = [];

            // Subscribe before any emissions
            const sub1 = flow.subscribe(() => {
                values.push(flow.getSnapshot());
            });

            flow.emit(1);
            flow.emit(2);

            // Subscribe after some emissions
            flow.subscribe(() => {
                values.push(flow.getSnapshot() * 10);
            });

            flow.emit(3);

            // Unsubscribe first listener
            sub1.unsubscribe();

            flow.emit(4);

            expect(values).toEqual([1, 2, 3, 30, 40]);
        });

        it("should work correctly with object values", () => {
            interface TestObject {
                count: number;
                name: string;
            }

            const objectFlow = new MutableFlowImpl<TestObject>({ count: 0, name: "initial" });
            const capturedValues: TestObject[] = [];

            objectFlow.subscribe(() => {
                capturedValues.push({ ...objectFlow.getSnapshot() });
            });

            objectFlow.emit({ count: 1, name: "first" });
            objectFlow.emit({ count: 2, name: "second" });

            expect(capturedValues).toEqual([
                { count: 1, name: "first" },
                { count: 2, name: "second" },
            ]);
        });

        it("should work with counter example from documentation", () => {
            const counter = createFlow(0);
            const values: number[] = [];

            const increment = () => {
                const current = counter.getSnapshot();
                counter.emit(current + 1);
            };

            counter.subscribe(() => {
                values.push(counter.getSnapshot());
            });

            increment(); // Should log: "Counter: 1"
            increment(); // Should log: "Counter: 2"

            expect(values).toEqual([1, 2]);
        });
    });
});
