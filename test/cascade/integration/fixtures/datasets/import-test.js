export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Main User" },
        saveAs: "mainUser",
      },
      {
        import: "./common/send-email.js",
        params: {
          subject: "Welcome!",
          body: (state) => `Hello ${state.saved.mainUser.name}!`,
        },
      },
    ],
  };
}
