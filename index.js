const { NgrokClient, NgrokClientError } = require("./src/client");
const uuid = require("uuid");
const {
  getProcess,
  getActiveProcess,
  killProcess,
  setAuthtoken,
  getVersion,
} = require("./src/process");
const fs = require("fs");
const { defaults, validate, isRetriable } = require("./src/utils");
const { dirname } = require("path");

// require("/Users/mohammadbagherabiyat/oss/ngrok-go/examples/wasm/static/");
console.log('before ngrokGoWasm')
const ngrokGoWasm = dirname(require.resolve("ngrok-go-wasm/package.json"))
console.log('after', ngrokGoWasm)
require(`${ngrokGoWasm}/static/wasm_exec.js`);
console.log('after wasm_exec.js')
const wasmPath = `${ngrokGoWasm}/static/ngrok.wasm`;
const go = new Go();
const wasmPromise = (async () => {
    const wasmBuffer = await fs.promises.readFile(wasmPath);
    const result = await WebAssembly.instantiate(wasmBuffer, go.importObject);
    go.run(result.instance);
})()
// .then(async () => {
//   const authtoken = "1XoV8Waji8VfVfAmKxW9sdV8jqB_x9GH3hgsF6CiKSUztAfn";
//   const backendURL = "http://localhost:8000";

//   try {
//       const url = await ngrokListenAndForward({ authtoken, backendURL });
//       console.log("result1", result);

//       if (result.error) {
//           console.error("Error:", result.error);
//           return;
//       }
//       console.log("result", result);
//   } catch (err) {
//       console.error("Error:", err);
//   }
// }).catch((e) => {
//   console.log("error", e);
// });

let processUrl = null;
let ngrokClient = null;

async function connect(opts) {
  opts = defaults(opts);
  validate(opts);
  await wasmPromise;
  return ngrokListenAndForward({ authtoken: opts.authtoken, addr: `http://localhost:${opts.port}`, hostname: opts.hostname })
}

async function connectRetry(opts, retryCount = 0) {
  opts.name = String(opts.name || uuid.v4());
  try {
    const response = await ngrokClient.startTunnel(opts);
    console.log("response", response);
    return response.public_url;
  } catch (err) {
    if (!isRetriable(err) || retryCount >= 100) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return connectRetry(opts, ++retryCount);
  }
}

async function disconnect(publicUrl) {
  if (!ngrokClient) return;
  const tunnels = (await ngrokClient.listTunnels()).tunnels;
  if (!publicUrl) {
    const disconnectAll = tunnels.map((tunnel) =>
      disconnect(tunnel.public_url)
    );
    return Promise.all(disconnectAll);
  }
  const tunnelDetails = tunnels.find(
    (tunnel) => tunnel.public_url === publicUrl
  );
  if (!tunnelDetails) {
    throw new Error(`there is no tunnel with url: ${publicUrl}`);
  }
  return ngrokClient.stopTunnel(tunnelDetails.name);
}

async function kill() {
  if (!ngrokClient) return;
  await killProcess();
  ngrokClient = null;
  tunnels = {};
}

function getUrl() {
  return processUrl;
}

function getApi() {
  return ngrokClient;
}

module.exports = {
  connect,
  disconnect,
  authtoken: setAuthtoken,
  kill,
  getUrl,
  getApi,
  getVersion,
  getActiveProcess,
  NgrokClientError
};
