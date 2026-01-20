export default function (_env, state, options = {}) {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: {
          name: options.name || "Test User",
          email: options.email || "test@example.com",
        },
        saveAs: "newUser",
        expect: {
          status: 200,
          "data.id": { toBeGreaterThan: 0 },
          "data.name": "Created User",
        },
      },
      {
        endpoint: `/user/${state.saved?.newUser?.id || 1}`,
        service: "main",
        method: "GET",
        dtoIn: {},
        expect: {
          status: 200,
          "data.id": { $any: Number },
          "data.name": { toBeDefined: true },
        },
      },
    ],
  };
}
