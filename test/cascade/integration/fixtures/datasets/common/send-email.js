export default function (_env, state) {
  return {
    cascade: [
      {
        endpoint: "/email/send",
        service: "main",
        dtoIn: {
          to: state.saved.mainUser?.email || "test@example.com",
          subject: state.params.subject,
          body: state.params.body,
        },
      },
    ],
  };
}
