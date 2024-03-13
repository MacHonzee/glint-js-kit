import { expect } from "@jest/globals";
import { mongoose } from "glint-js";

/**
 * This callback type is called `requestCallback` and is displayed as a global symbol.
 *
 * @callback assertErrorCallback
 * @param {object} response
 * @param {Error} error
 */
class AssertionService {
  /**
   * Asserts whether given call to server raises an error and checks the error
   *
   * @param {Function} call
   * @param {assertErrorCallback} assertThrow
   * @returns {Promise<void>}
   */
  async assertCallThrows(call, assertThrow) {
    let response;
    try {
      response = await call();
      console.log("=>(assertion-service.js:23) response", response);
    } catch (e) {
      console.log("=>(assertion-service.js:24) e", e);

      assertThrow(e.response, e);
      return;
    }

    if (response.error) {
      assertThrow(response.response, response.error);
      return;
    }

    throw new Error("Should have raised error but did not.");
  }

  /**
   * Asserts that the string matches jwt format
   *
   * @param {string} token
   */
  assertToken(token) {
    expect(token).toMatch(/^[\w-]*\.[\w-]*\.[\w-]*$/);
  }

  /**
   * Checks that the object contains standard MongoDB attributes
   *
   * @param {object} dataObject
   */
  assertBaseData(dataObject) {
    expect(dataObject).toBeDefined();

    // check version
    expect(typeof dataObject.__v).toBe("number");
    expect(dataObject.__v).toBeGreaterThanOrEqual(0);

    // both string and ObjectId is valid
    if (typeof dataObject._id === "string") {
      expect(dataObject._id).toMatch(/^[a-f0-9]{24}$/);
    } else {
      expect(dataObject._id).toBeInstanceOf(mongoose.Types.ObjectId);
    }

    // check timestamps
    expect(dataObject.createdAt).toBeInstanceOf(Date);
    expect(dataObject.updatedAt).toBeInstanceOf(Date);
  }

  /**
   * Checks whether the returned user matches the expected user
   *
   * @param {object} responseUser
   * @param {object} expectedUser
   */
  assertUser(responseUser, expectedUser) {
    this.assertBaseData(responseUser);

    const data = {
      username: expectedUser.username,
      firstName: expectedUser.firstName,
      lastName: expectedUser.lastName,
      email: expectedUser.email,
      language: expectedUser.language,
      authStrategy: "local",
    };

    expect(responseUser).toMatchObject(data);
    expect(responseUser.hash).not.toBeDefined();
    expect(responseUser.salt).not.toBeDefined();
  }

  async assertThrows(assertedFunction, expectedError) {
    let hasThrown = false;
    try {
      await assertedFunction();
    } catch (e) {
      hasThrown = true;

      expect(e.message).toBe(expectedError.message);
      expect(e.code).toBe(expectedError.code);
      expect(e.status).toBe(expectedError.status);
      expect(e.params).toEqual(expectedError.params);
    }

    if (!hasThrown) throw new Error("Should have raised error but did not.");
  }
}

export default new AssertionService();
