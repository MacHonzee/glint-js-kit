export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Test" },
        saveAs: "user1",
      },
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Test 2" },
        saveAs: "user2",
      },
    ],
  };
}
