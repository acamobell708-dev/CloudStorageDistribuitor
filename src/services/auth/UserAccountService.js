const {
  scrypt: nodeScrypt,
  timingSafeEqual
} = require("node:crypto");
const { promisify } = require("node:util");
const {
  AuthenticationError,
  ValidationError
} = require("../../errors/ApplicationError");
const {
  memberPermissions,
  permissions
} = require("./permissions");

const scrypt = promisify(nodeScrypt);

const predefinedAccounts = Object.freeze([
  {
    displayName: "Wilson",
    id: "wilson",
    passwordHash:
      "e1835dae5b04f2fa7d772d4d0ef7ce336a3e23f66c6bc979824ab4bbded0edeff47488b68141990479900ca2bab5df8aa44c5c9d219e39c7674ebc6e7ded64d4",
    permissions: memberPermissions,
    role: "member",
    salt: "a8f60d8ec378c9e2ba68b1695874acee",
    username: "Wilson"
  },
  {
    displayName: "Adam",
    id: "adam",
    passwordHash:
      "def0ea5a046dce74f749cb6064e1089b870689d5b1e0673f68215cc077735a05b6abefe1b15ae131e1958ca116756a004dd53dd95fb5a632fe13b27a5854c47e",
    permissions: Object.freeze([
      ...memberPermissions,
      permissions.permanentlyDeleteFiles
    ]),
    role: "owner",
    salt: "b9f18f2ea33828e3c1d84ac37d705553",
    username: "Adam"
  },
  {
    displayName: "Andrew",
    id: "andrew",
    passwordHash:
      "c2ce0b628005735b15b65ee3fcc356f5174a80f8675ac5bbeafaf817ed855381453df24a680cce8e52242e5c408d0e07b9fdcb87d6235f1226f89996e0339126",
    permissions: memberPermissions,
    role: "member",
    salt: "6471f3944a93e1b9fabb955701f85788",
    username: "Andrew"
  }
]);

const guestAccount = Object.freeze({
  displayName: "Guest",
  id: "guest",
  permissions: Object.freeze([
    permissions.accessDashboard,
    permissions.accessHome
  ]),
  role: "guest",
  username: "Guest"
});

class UserAccountService {
  constructor(accounts = predefinedAccounts) {
    this.accounts = new Map(
      accounts.map((account) => [
        account.username.toLowerCase(),
        account
      ])
    );
    this.fallbackAccount = accounts[0] || predefinedAccounts[0];
  }

  async authenticate(username, password) {
    const normalizedUsername = String(username || "").trim();
    const suppliedPassword = String(password || "");

    if (
      !normalizedUsername ||
      !suppliedPassword ||
      normalizedUsername.length > 64 ||
      suppliedPassword.length > 256
    ) {
      throw new ValidationError(
        "Enter a valid username and password"
      );
    }

    const account =
      this.accounts.get(normalizedUsername.toLowerCase()) ||
      this.fallbackAccount;
    const suppliedHash = await scrypt(
      suppliedPassword,
      Buffer.from(account.salt, "hex"),
      64
    );
    const expectedHash = Buffer.from(account.passwordHash, "hex");
    const authenticated =
      account.username.toLowerCase() ===
        normalizedUsername.toLowerCase() &&
      expectedHash.length === suppliedHash.length &&
      timingSafeEqual(expectedHash, suppliedHash);

    if (!authenticated) {
      throw new AuthenticationError(
        "The username or password is incorrect",
        {
          code: "INVALID_LOGIN"
        }
      );
    }

    return this.toPublicUser(account);
  }

  createGuest() {
    return this.toPublicUser(guestAccount);
  }

  toPublicUser(account) {
    return {
      displayName: account.displayName,
      id: account.id,
      initial: account.displayName.charAt(0).toUpperCase(),
      permissions: [...account.permissions],
      role: account.role,
      username: account.username
    };
  }
}

module.exports = {
  predefinedAccounts,
  UserAccountService
};
