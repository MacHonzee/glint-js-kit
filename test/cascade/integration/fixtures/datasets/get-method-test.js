export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "GET Test User" },
        saveAs: "getTestUser",
      },
      {
        endpoint: `/user/${1}`,
        service: "main",
        method: "GET",
        dtoIn: {},
      },
    ],
  };
}
