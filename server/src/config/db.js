const mongoose = require('mongoose');
const dns = require('node:dns');

let reconnectTimer = null;
let reconnectInProgress = false;
let connectionMonitoringInstalled = false;

// Escape hatch for the Atlas "tlsv1 alert internal error" handshake failure.
// Set MONGODB_TLS_INSECURE=true in .env only if that error comes back. Unlike
// NODE_TLS_REJECT_UNAUTHORIZED=0, this is scoped to the MongoDB connection and
// does not disable certificate checks for Razorpay, SMTP or Twilio.
const buildConnectOptions = () => ({
  // Fail fast rather than the driver's 30s default. On a network where the
  // handshake fails intermittently, a long timeout only delays the diagnostic.
  serverSelectionTimeoutMS: 10000,
  ...(process.env.MONGODB_TLS_INSECURE === 'true' ? { tlsInsecure: true } : {}),
});

const getMongoHost = (mongoUri) => {
  try {
    const match = String(mongoUri).match(/@([^/?]+)/);
    if (match) return match[1];
    const parsedUri = new URL(mongoUri);
    return parsedUri.hostname || null;
  } catch {
    return null;
  }
};

const redactSensitiveText = (value) => String(value || '')
  .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://***:***@');

const isSrvDnsRefusal = (error) => (
  error?.code === 'ECONNREFUSED' &&
  /^querySrv\s/i.test(error.message || '')
);

const logConnectionError = (error) => {
  const reason = error.reason?.message || error.cause?.message || error.reason;
  const serverDetails = error.reason?.servers instanceof Map
    ? [...error.reason.servers.entries()].map(([address, server]) => ({
      address,
      type: server.type,
      errorName: server.error?.name,
      errorCode: server.error?.code,
      errorMessage: redactSensitiveText(server.error?.message || ''),
    }))
    : null;

  console.error('========== MONGODB CONNECTION ERROR ==========');
  console.error('Name:', error.name);
  console.error('Message:', redactSensitiveText(error.message));
  console.error('Code:', error.code || 'none');
  console.error('Reason:', redactSensitiveText(reason || 'none'));

  // Atlas returns the same opaque "bad auth" for every credential problem, and
  // Mongoose's default text blames IP whitelisting, which sends you the wrong way.
  if (error.code === 8000 || /bad auth/i.test(error.message || '')) {
    console.error('--- "bad auth" is a credentials problem, NOT an IP whitelist problem. Check, in order:');
    console.error('  1. Atlas\'s <> placeholder brackets left around the password in MONGODB_URI.');
    console.error('  2. A database name in the URI path without &authSource=admin.');
    console.error('     authSource defaults to the path database; Atlas users live in "admin".');
    console.error('  3. Unencoded special characters in the password: $ = %24, @ = %40, : = %3A, / = %2F, ? = %3F, # = %23, % = %25.');
    console.error('  4. The user is missing or the password was rotated (Atlas > Database Access).');
  }

  if (/alert number 80|tlsv1 alert internal error/i.test(error.message || '')) {
    console.error('--- TLS handshake rejected by Atlas ("SSL alert number 80"). This is a transport');
    console.error('    problem, so the credentials were never even sent. Try in this order:');
    console.error('  1. Set MONGODB_TLS_INSECURE=true in .env (scoped to MongoDB only).');
    console.error('  2. Run "npm run dev:tls12" to cap the handshake at TLS 1.2 — some antivirus');
    console.error('     and ISP middleboxes mangle TLS 1.3 to *.mongodb.net.');
    console.error('  3. Retry on a phone hotspot. If it works there, your network or antivirus');
    console.error('     HTTPS/SSL scanning is intercepting the connection, not your code.');
    console.error('  4. Confirm the cluster is not paused in the Atlas dashboard.');
  }

  if (serverDetails) {
    console.error('Server details:', JSON.stringify(serverDetails, null, 2));
  }
  console.error('==============================================');
};

const connectDatabase = async ({ logFailure = true } = {}) => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  console.log('[MongoDB] URI configured:', Boolean(mongoUri));
  const host = getMongoHost(mongoUri);
  console.log(host ? `[MongoDB] Host: ${host}` : '[MongoDB] URI format could not be parsed');

  if (mongoUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['1.1.1.1', '8.8.8.8']);
    } catch (e) {
      // Ignore if setServers is not permitted or already set
    }
  }

  try {
    await mongoose.connect(mongoUri, buildConnectOptions());
    console.log(`MongoDB connected to ${mongoose.connection.name}`);
  } catch (error) {
    if (logFailure) {
      logConnectionError(error);
    }
    throw error;
  }
};

// The Atlas handshake from this machine fails intermittently (see the alert-80
// notes above), so a single bad attempt must not be fatal. Retries quietly and
// only prints the full diagnostic block on the final attempt.
const connectWithRetry = async ({ attempts = 5, delayMs = 3000 } = {}) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Full diagnostics on the first failure, so the alert-80 checklist appears
      // within seconds instead of after every retry has been exhausted.
      await connectDatabase({ logFailure: attempt === 1 });
      return true;
    } catch {
      if (attempt === attempts) {
        console.error(
          `[MongoDB] Gave up after ${attempts} attempts. The HTTP server stays up, and`
          + ' /api routes answer 503 until a connection succeeds.',
        );
        return false;
      }

      console.warn(
        `[MongoDB] Attempt ${attempt} of ${attempts} failed. Retrying in ${delayMs / 1000}s...`,
      );

      await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    }
  }

  return false;
};

// Atlas and a few network security products can reset an established TLS socket
// after startup. Mongoose will usually recover by itself, but a failed recovery
// previously left the API running permanently disconnected. Keep retrying in the
// background, without making HTTP requests wait for a new server process.
const scheduleReconnect = () => {
  if (
    reconnectTimer
    || reconnectInProgress
    || mongoose.connection.readyState === 1
    || mongoose.connection.readyState === 2
  ) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    // The MongoDB driver may have already recovered while the timer was waiting.
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      return;
    }

    reconnectInProgress = true;

    try {
      await connectWithRetry();
    } finally {
      reconnectInProgress = false;

      if (mongoose.connection.readyState !== 1) {
        scheduleReconnect();
      }
    }
  }, 3000);
};

const installConnectionMonitoring = () => {
  if (connectionMonitoringInstalled) {
    return;
  }

  connectionMonitoringInstalled = true;

  mongoose.connection.on('error', (error) => {
    console.error('========== MONGODB RUNTIME ERROR ==========');
    console.error('Name:', error?.name);
    console.error('Code:', error?.code);
    console.error('Message:', error?.message);
    console.error('Stack:', error?.stack);
    console.error('============================================');
  });

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB DRIVER] Mongoose connected event fired');

    try {
      const client = mongoose.connection.getClient();

      client.on('serverDescriptionChanged', (event) => {
        console.log('[MongoDB DRIVER] Server description changed:', {
          address: event.address,
          previousType: event.previousDescription?.type,
          newType: event.newDescription?.type,
          error: event.newDescription?.error?.message,
        });
      });

      client.on('topologyDescriptionChanged', (event) => {
        console.log('[MongoDB DRIVER] Topology changed:', {
          previousType: event.previousDescription?.type,
          newType: event.newDescription?.type,
        });
      });

      console.log('[MongoDB DRIVER] Diagnostic listeners installed');
    } catch (error) {
      console.error(
        '[MongoDB DRIVER] Could not install diagnostics:',
        error.message,
      );
    }
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost. Reconnecting in the background...');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    console.log(`MongoDB reconnected to ${mongoose.connection.name}`);
  });
};

// Kept as the default export for backwards compatibility with existing requires.
module.exports = connectDatabase;
module.exports.connectDatabase = connectDatabase;
module.exports.connectWithRetry = connectWithRetry;
module.exports.installConnectionMonitoring = installConnectionMonitoring;
