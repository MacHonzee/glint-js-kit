export default function (_env, state) {
  return {
    cascade: [
      {
        endpoint: "/email/send",
        service: "main",
        dtoIn: {
          to: state.saved.nestedUser?.email || "test@example.com",
          subject: `Level ${state.params.level}`,
          body: `Previous: ${state.params.previousMessage}`,
        },
      },
    ],
  };
}
