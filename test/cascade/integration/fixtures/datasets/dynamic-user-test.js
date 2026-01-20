export default function () {
  return {
    cascade: [
      // Step 1: Register a new user
      {
        endpoint: "/user/register",
        service: "main",
        dtoIn: {
          username: "newuser@example.com",
          password: "SecurePass123!",
          name: "New User",
        },
        registerAs: "newUser",
        saveAs: "registeredUser",
        expect: {
          status: 200,
          "data.id": { $any: Number },
          "data.username": "newuser@example.com",
        },
      },
      // Step 2: Call protected endpoint as the new user
      {
        endpoint: "/protected/resource",
        service: "main",
        method: "GET",
        auth: "newUser",
        expect: {
          status: 200,
          "data.message": "Protected resource accessed successfully",
        },
      },
      // Step 3: Get user profile as the new user
      {
        endpoint: "/user/profile",
        service: "main",
        method: "GET",
        auth: "newUser",
        expect: {
          status: 200,
          "data.id": { $any: Number },
        },
      },
    ],
  };
}
