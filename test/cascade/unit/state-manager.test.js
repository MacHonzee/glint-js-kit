import { describe, test, expect } from "@jest/globals";
import { createState, resolveDtoIn, saveToState, mergeParams } from "../../../src/cascade/state-manager.js";

describe("State Manager", () => {
  describe("createState", () => {
    test("should create initial state with correct structure", () => {
      const state = createState();
      expect(state).toEqual({
        users: {},
        params: {},
        saved: {},
      });
    });

    test("should create independent state instances", () => {
      const state1 = createState();
      const state2 = createState();
      state1.saved.test = "value1";
      state2.saved.test = "value2";
      expect(state1.saved.test).toBe("value1");
      expect(state2.saved.test).toBe("value2");
    });
  });

  describe("resolveDtoIn", () => {
    test("should return object when dtoIn is an object", () => {
      const dtoIn = { name: "Test", email: "test@example.com" };
      const state = createState();
      expect(resolveDtoIn(dtoIn, state)).toEqual(dtoIn);
    });

    test("should call function when dtoIn is a function", () => {
      const dtoIn = (state) => ({ userId: state.saved.userId });
      const state = createState();
      state.saved.userId = 123;
      expect(resolveDtoIn(dtoIn, state)).toEqual({ userId: 123 });
    });

    test("should return empty object when dtoIn is undefined", () => {
      const state = createState();
      expect(resolveDtoIn(undefined, state)).toEqual({});
    });

    test("should return empty object when dtoIn is null", () => {
      const state = createState();
      expect(resolveDtoIn(null, state)).toEqual({});
    });

    test("should pass state to function", () => {
      const dtoIn = (state) => {
        expect(state).toBeDefined();
        return { test: "value" };
      };
      const state = createState();
      resolveDtoIn(dtoIn, state);
    });
  });

  describe("saveToState", () => {
    test("should save data to state when saveAs is provided", () => {
      const state = createState();
      const data = { id: 1, name: "Test" };
      saveToState(state, "newUser", data);
      expect(state.saved.newUser).toEqual(data);
    });

    test("should not save when saveAs is undefined", () => {
      const state = createState();
      const initialSaved = { ...state.saved };
      saveToState(state, undefined, { id: 1 });
      expect(state.saved).toEqual(initialSaved);
    });

    test("should not save when saveAs is null", () => {
      const state = createState();
      const initialSaved = { ...state.saved };
      saveToState(state, null, { id: 1 });
      expect(state.saved).toEqual(initialSaved);
    });

    test("should overwrite existing saved data", () => {
      const state = createState();
      state.saved.user = { id: 1 };
      saveToState(state, "user", { id: 2, name: "Updated" });
      expect(state.saved.user).toEqual({ id: 2, name: "Updated" });
    });
  });

  describe("mergeParams", () => {
    test("should merge params into state", () => {
      const state = createState();
      const params = { subject: "Hello", body: "World" };
      const result = mergeParams(state, params);
      expect(result.params.subject).toBe("Hello");
      expect(result.params.body).toBe("World");
    });

    test("should preserve existing params", () => {
      const state = createState();
      state.params.existing = "value";
      const params = { new: "newValue" };
      const result = mergeParams(state, params);
      expect(result.params.existing).toBe("value");
      expect(result.params.new).toBe("newValue");
    });

    test("should resolve function params", () => {
      const state = createState();
      state.saved.userId = 123;
      const params = {
        userId: (state) => state.saved.userId,
        static: "value",
      };
      const result = mergeParams(state, params);
      expect(result.params.userId).toBe(123);
      expect(result.params.static).toBe("value");
    });

    test("should return original state when params is undefined", () => {
      const state = createState();
      state.saved.test = "value";
      const result = mergeParams(state, undefined);
      expect(result).toBe(state);
      expect(result.saved.test).toBe("value");
    });

    test("should return original state when params is null", () => {
      const state = createState();
      const result = mergeParams(state, null);
      expect(result).toBe(state);
    });

    test("should create new state object", () => {
      const state = createState();
      const params = { test: "value" };
      const result = mergeParams(state, params);
      expect(result).not.toBe(state);
      expect(result.params.test).toBe("value");
    });

    test("should handle nested function params", () => {
      const state = createState();
      state.saved.user = { name: "John", email: "john@example.com" };
      const params = {
        greeting: (state) => `Hello ${state.saved.user.name}`,
      };
      const result = mergeParams(state, params);
      expect(result.params.greeting).toBe("Hello John");
    });
  });
});
