const http = require("http");

const port = Number(process.env.PORT || 8080);

function isHubRunning() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.setTimeout(1200, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

isHubRunning().then((running) => {
  if (running) {
    console.log(`VitalsGrid Hub is already running at http://localhost:${port}`);
    process.exit(0);
  }

  require("./server.js");
});
