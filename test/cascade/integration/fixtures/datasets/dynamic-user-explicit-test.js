export default function () {
  return {
    cascade: [
      // Step 1: Register a new user with explicit registerAs config
      {
        endpoint: "/user/register",
        service: "main",
        dtoIn: {
          login: "explicit@example.com",
          secret: "ExplicitPass456!",
          name: "Explicit User",
        },
        registerAs: {
          userKey: "explicitUser",
          usernamePath: "login",
          passwordPath: "secret",
        },
        saveAs: "registeredUser",
        expect: {
          status: 200,
        },
      },
      // Step 2: Call protected endpoint as the explicit user
      {
        endpoint: "/protected/resource",
        service: "main",
        method: "GET",
        auth: "explicitUser",
        expect: {
          status: 200,
        },
      },
    ],
  };
}
