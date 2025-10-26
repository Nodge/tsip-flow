import { describe, it, expect, vi, expectTypeOf } from "vitest";
import type { Flow, FlowSubscription, MutableFlow } from "@tsip/types";
import { validateMutableFlowImplementation } from "@tsip/types/tests";
import { createFlow } from "./create-flow";

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

    it("should return a FlowSubscription type from flow.subscribe()", () => {
        const flow = createFlow(0);
        const listener = vi.fn();
        const subscription = flow.subscribe(listener);

        expectTypeOf(subscription).toEqualTypeOf<FlowSubscription>();
    });

    it("should enforce correct parameter types in flow.emit()", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const stringFlow = createFlow("initial");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const numberFlow = createFlow(0);

        expectTypeOf<Parameters<typeof stringFlow.emit>[0]>().toEqualTypeOf<string>();
        expectTypeOf<Parameters<typeof numberFlow.emit>[0]>().toEqualTypeOf<number>();
    });

    it("should call listeners with no parameters", () => {
        const flow = createFlow(0);

        const listener = vi.fn();
        flow.subscribe(listener);

        flow.emit(42);

        expect(listener).toHaveBeenCalledWith();
    });

    it("should not throw if there are no subscriptions", () => {
        const flow = createFlow(0);

        expect(() => {
            flow.emit(42);
        }).not.toThrow();

        expect(flow.getSnapshot()).toBe(42);
    });

    it("should return a Flow interface from flow.asFlow()", () => {
        const flow = createFlow(0);
        const readOnlyFlow = flow.asFlow();

        expectTypeOf(readOnlyFlow).toEqualTypeOf<Flow<number>>();
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

    describe("MutableFlow interface", () => {
        validateMutableFlowImplementation({
            testRunner: { describe, it },
            createFlow: () => {
                const flow = createFlow({ value: 0 });
                let i = 0;
                return {
                    flow,
                    nextValue() {
                        return { value: ++i };
                    },
                };
            },
        });
    });
});
