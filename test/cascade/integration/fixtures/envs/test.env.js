export default {
  name: "test",
  services: {
    main: {
      baseUri: process.env.TEST_SERVER_URL || "http://localhost:3000",
      defaultAuth: "testUser",
    },
  },
  authentication: {
    service: "main",
    loginEndpoint: "/auth/login",
    tokenPath: "token",
    userPath: "user",
    defaultAuth: "testUser",
    users: {
      testUser: {
        usernameEnvKey: "TEST_USERNAME",
        passwordEnvKey: "TEST_PASSWORD",
      },
    },
  },
  config: {
    timeout: 5000,
  },
};
