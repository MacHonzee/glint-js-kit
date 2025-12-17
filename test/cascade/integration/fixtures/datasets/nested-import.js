export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Nested Import User" },
        saveAs: "nestedUser",
      },
      {
        import: "./nested-level1.js",
        params: {
          level: 1,
          message: (state) => `User ${state.saved.nestedUser.name} created`,
        },
      },
    ],
  };
}
