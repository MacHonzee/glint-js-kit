export default {
  name: "test-defaults",
  services: {
    main: {
      baseUri: process.env.TEST_SERVER_URL || "http://localhost:3000",
    },
  },
  authentication: {
    service: "main",
    defaultAuth: "testUser",
    // No loginEndpoint, tokenPath, userPath - should use defaults
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
