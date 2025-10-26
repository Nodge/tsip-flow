import { describe, it, expect, vi, expectTypeOf } from "vitest";
import type { AsyncFlow, FlowSubscription, MutableAsyncFlow, AsyncFlowState } from "@tsip/types";
import { validateMutableAsyncFlowImplementation } from "@tsip/types/tests";
import { createAsyncFlow } from "./create-async-flow";

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

    it("should return a FlowSubscription type from flow.subscribe()", () => {
        const flow = createAsyncFlow({ status: "pending" });
        const listener = vi.fn();
        const subscription = flow.subscribe(listener);

        expectTypeOf(subscription).toEqualTypeOf<FlowSubscription>();
    });

    it("should enforce correct parameter types in flow.emit()", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const stringFlow = createAsyncFlow<string>({ status: "pending" });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const numberFlow = createAsyncFlow<number>({ status: "pending" });

        expectTypeOf<Parameters<typeof stringFlow.emit>[0]>().toEqualTypeOf<AsyncFlowState<string>>();
        expectTypeOf<Parameters<typeof numberFlow.emit>[0]>().toEqualTypeOf<AsyncFlowState<number>>();
    });

    it("should call listeners with no parameters", () => {
        const flow = createAsyncFlow<number>({ status: "pending" });

        const listener = vi.fn();
        flow.subscribe(listener);

        flow.emit({ status: "success", data: 42 });

        expect(listener).toHaveBeenCalledWith();
    });

    it("should not throw if there are no subscriptions", () => {
        const flow = createAsyncFlow({ status: "success", data: 0 });

        expect(() => {
            flow.emit({ status: "success", data: 42 });
        }).not.toThrow();

        expect(flow.getSnapshot()).toEqual({ status: "success", data: 42 });
    });

    it("should return a Flow interface from flow.asFlow()", () => {
        const flow = createAsyncFlow({ status: "success", data: 0 });
        const readOnlyFlow = flow.asFlow();

        expectTypeOf(readOnlyFlow).toEqualTypeOf<AsyncFlow<number>>();
    });

    describe("asPromise", () => {
        it("should return new promise for new success transition", async () => {
            const source = createAsyncFlow<number>({ status: "success", data: 1 });
            const promise1 = source.asPromise();
            await expect(promise1).resolves.toBe(1);

            source.emit({ status: "success", data: 2 });
            const promise2 = source.asPromise();
            expect(promise2).not.toBe(promise1);
            await expect(promise2).resolves.toBe(2);
        });

        it("should return new promise for new error transition", async () => {
            const source = createAsyncFlow<number>({ status: "success", data: 1 });
            const promise1 = source.asPromise();
            await expect(promise1).resolves.toBe(1);

            const error = new Error();
            source.emit({ status: "error", error });
            const promise2 = source.asPromise();
            expect(promise2).not.toBe(promise1);
            await expect(promise2).rejects.toBe(error);
        });

        it("should ignore intermediate pending states", async () => {
            const flow = createAsyncFlow<number>({ status: "pending" });
            const dataPromise = flow.asPromise();

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
            const stringResult = await stringFlow.asPromise();
            expect(stringResult).toBe("test");
            expectTypeOf(stringResult).toEqualTypeOf<string>();

            const objectFlow = createAsyncFlow<{ id: number }>({ status: "success", data: { id: 1 } });
            const objectResult = await objectFlow.asPromise();
            expect(objectResult).toEqual({ id: 1 });
            expectTypeOf(objectResult).toEqualTypeOf<{ id: number }>();
        });

        it("should preserve error types and values", async () => {
            const flow = createAsyncFlow<number>({ status: "pending" });
            const customError = { code: 404, message: "Not found" };
            flow.emit({ status: "error", error: customError });

            await expect(flow.asPromise()).rejects.toBe(customError);
        });
    });

    describe("MutableAsyncFlow interface", () => {
        validateMutableAsyncFlowImplementation({
            testRunner: { describe, it },
            createFlow: () => {
                const flow = createAsyncFlow({ status: "success", data: { value: 0 } });
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
