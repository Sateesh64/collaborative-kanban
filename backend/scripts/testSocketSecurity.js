const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:5000";

const HYDERABAD_TENANT =
  "3798de85-1ddc-4710-8241-34bed1338186";

const HYDERABAD_BOARD =
  "02540756-38c0-4e5f-9578-a1abab2919e2";

const BANGALORE_TENANT =
  "ba0194ad-1c62-46df-a82e-f931a9103c14";

const BANGALORE_BOARD =
  "68182e97-6eec-4c97-8d96-db872b72d7e6";

const memberToken = process.env.MEMBER_TOKEN;

if (!memberToken) {
  console.error("MEMBER_TOKEN environment variable is required.");
  process.exit(1);
}

let failures = 0;

function check(label, condition, details = "") {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    failures++;
    console.error(`FAIL: ${label}`, details);
  }
}

function connectSocket(token) {
  return io(SERVER_URL, {
    autoConnect: false,
    reconnection: false,
    timeout: 5000,
    auth: token ? { token } : {},
  });
}

function waitForConnection(socket) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        connected: false,
        message: "Connection timed out",
      });
    }, 7000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve({ connected: true });
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      resolve({
        connected: false,
        message: error.message,
      });
    });

    socket.connect();
  });
}

async function joinBoard(socket, tenantId, boardId) {
  try {
    return await socket
      .timeout(5000)
      .emitWithAck("board:join", {
        tenantId,
        boardId,
      });
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function main() {
  console.log("\nSOCKET.IO SECURITY TESTS\n");

  
  const unauthenticated = connectSocket(null);

  try {
    const result = await waitForConnection(unauthenticated);

    check(
      "Connection without JWT is rejected",
      !result.connected &&
        result.message === "Authentication token is required",
      result.message
    );
  } finally {
    unauthenticated.disconnect();
  }


  const invalid = connectSocket("invalid.jwt.token");

  try {
    const result = await waitForConnection(invalid);

    check(
      "Invalid JWT is rejected",
      !result.connected &&
        result.message ===
          "Invalid or expired authentication token",
      result.message
    );
  } finally {
    invalid.disconnect();
  }


  const member = connectSocket(memberToken);

  try {
    const connection = await waitForConnection(member);

    check(
      "Hyderabad member connects with valid JWT",
      connection.connected,
      connection.message
    );

    if (!connection.connected) {
      return;
    }

    const hyderabadResult = await joinBoard(
      member,
      HYDERABAD_TENANT,
      HYDERABAD_BOARD
    );

    check(
      "Hyderabad member joins Hyderabad board",
      hyderabadResult.success === true,
      hyderabadResult.message
    );

    
    const bangaloreResult = await joinBoard(
      member,
      BANGALORE_TENANT,
      BANGALORE_BOARD
    );

    check(
      "Hyderabad member cannot join Bangalore board",
      bangaloreResult.success === false &&
        bangaloreResult.message ===
          "Access denied to this tenant",
      bangaloreResult.message
    );

    const mismatchedResult = await joinBoard(
      member,
      HYDERABAD_TENANT,
      BANGALORE_BOARD
    );

    check(
      "Board and tenant mismatch is rejected",
      mismatchedResult.success === false &&
        mismatchedResult.message ===
          "Board not found in this tenant",
      mismatchedResult.message
    );

   
    const rejoinResult = await joinBoard(
      member,
      HYDERABAD_TENANT,
      HYDERABAD_BOARD
    );

    check(
      "Member can rejoin authorized board",
      rejoinResult.success === true,
      rejoinResult.message
    );
  } finally {
    member.disconnect();
  }
}

main()
  .catch((error) => {
    failures++;
    console.error("Test execution error:", error);
  })
  .finally(() => {
    console.log("\nTEST SUMMARY");
    console.log(`Failed checks: ${failures}`);
    process.exitCode = failures > 0 ? 1 : 0;
  });
