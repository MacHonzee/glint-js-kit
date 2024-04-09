import TestService from "./test-service.js";
import { AuthenticationService, DuplicateKeyError } from "glint-js";

const PERMISSION_SECRET = "testPermissionKey";

class AbstractTestUsers {
  /**
   * @typedef {object} TestUser
   * @property {string} token
   * @property {object} user
   * @private
   */
  _cache = {
    admin: null,
    authority: null,
  };

  /**
   * Login as admin.
   *
   * @returns {Promise<TestUser>}
   */
  async admin() {
    return this.registerRole("admin", ["Admin"]);
  }

  /**
   * Login as authority.
   *
   * @returns {Promise<TestUser>}
   */
  async authority() {
    return this.registerRole("authority", ["Authority"]);
  }

  /**
   * Method to register a role and grant permissions.
   *
   * @param {string} role
   * @param {Array<string>} permissions
   * @returns {Promise<TestUser>}
   */
  async registerRole(role, permissions) {
    if (this._cache[role]) return await this._cache[role];

    this._cache[role] = async () => {
      const user = await this._registerTestUser(role);
      await this.grantPermissions(role, permissions, role === "admin");
      return user;
    };

    return await this._cache[role]();
  }

  /**
   * Method grants permissions for given user.
   *
   * @param {string} user
   * @param {Array<string>} roles
   * @param {boolean} [secretGrant = false]
   * @returns {Promise<void>}
   */
  async grantPermissions(user, roles, secretGrant = false) {
    const dtoIn = {
      user: this._getUserName(user),
    };
    if (secretGrant) dtoIn.secret = PERMISSION_SECRET;

    const useCase = secretGrant ? "permission/secretGrant" : "permission/grant";
    const ucEnv = await TestService.getUcEnv(useCase, dtoIn);

    const PermissionRoute = (await import("glint-js/src/routes/permission-route.js")).default;
    for (const role of roles) {
      ucEnv.dtoIn.role = role;
      const routeMethod = useCase.replace("permission/", "");
      try {
        await PermissionRoute[routeMethod](ucEnv);
      } catch (e) {
        if (!(e instanceof DuplicateKeyError)) {
          throw e;
        }
      }
    }
  }

  /**
   * Method registers user to application.
   *
   * @param {object} userData
   * @returns {Promise<TestUser>}
   */
  async registerUser(userData) {
    const UserRoute = (await import("glint-js/src/routes/user-route.js")).default;
    await AuthenticationService.init();

    const ucEnv = await TestService.getUcEnv("user/register", userData);

    try {
      return await UserRoute.register(ucEnv);
    } catch (e) {
      if (e instanceof UserRoute.ERRORS.RegistrationFailed && e.message.includes("already exists")) {
        const loginDtoIn = {
          username: userData.username,
          password: userData.password,
        };
        const loginUcEnv = await TestService.getUcEnv("user/login", loginDtoIn);
        return await UserRoute.login(loginUcEnv);
      } else {
        throw e;
      }
    }
  }

  /**
   * Method returns refresh token for selected user
   *
   * @param username
   * @param password
   * @returns {Promise<string>}
   */
  async getRefreshToken(username, password) {
    const loginData = {
      username,
      password,
    };
    const loginUcEnv = await TestService.getUcEnv("user/login", loginData);

    const UserRoute = (await import("glint-js/src/routes/user-route.js")).default;
    await UserRoute.login(loginUcEnv);
    return loginUcEnv.response.cookie.mock.calls[0][1];
  }

  /**
   * Method returns user token from cache, otherwise it registers the user.
   *
   * @param {string} user
   * @returns {Promise<TestUser>}
   * @private
   */
  async _registerTestUser(user) {
    const userData = {
      username: this._getUserName(user),
      password: `123${user}Password`,
      confirmPassword: `123${user}Password`,
      firstName: "User",
      lastName: user,
      email: this._getUserName(user),
      language: "en",
    };

    this._cache[user] = await this.registerUser(userData);
    return this._cache[user];
  }

  /**
   * Returns username of given user type.
   *
   * @param {string} user
   * @returns {string}
   * @private
   */
  _getUserName(user) {
    return `${user}@test.com`;
  }
}

export default AbstractTestUsers;
