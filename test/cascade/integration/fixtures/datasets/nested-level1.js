export default function (_env, state) {
  return {
    cascade: [
      {
        endpoint: "/email/send",
        service: "main",
        dtoIn: {
          to: state.saved.nestedUser?.email || "test@example.com",
          subject: `Level ${state.params.level}`,
          body: state.params.message,
        },
      },
      {
        import: "./nested-level2.js",
        params: {
          level: (state) => state.params.level + 1,
          previousMessage: state.params.message,
        },
      },
    ],
  };
}
