const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

async function run() {
  const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-sandbox",
    "--disable-gpu",
    "http://127.0.0.1:8082/home"
  ]);

  await new Promise(r => setTimeout(r, 2000));

  http.get("http://127.0.0.1:9222/json", (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", async () => {
      try {
        const tabs = JSON.parse(data);
        const pageTab = tabs.find(t => t.url.includes("8082"));
        if (!pageTab) {
          console.error("No 8082 tab found", tabs.map(t=>t.url));
          chrome.kill();
          return;
        }

        const WebSocket = require("../server/node_modules/ws");
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let id = 1;
        function send(method, params = {}) {
          return new Promise((resolve) => {
            const msgId = id++;
            const handler = (msg) => {
              const res = JSON.parse(msg);
              if (res.id === msgId) {
                ws.off("message", handler);
                resolve(res.result);
              }
            };
            ws.on("message", handler);
            ws.send(JSON.stringify({ id: msgId, method, params }));
          });
        }

        ws.on("open", async () => {
          await send("Page.enable");
          await send("Runtime.enable");
          await new Promise(r => setTimeout(r, 2000));
          await send("Runtime.evaluate", { expression: "window.scrollTo(0, 240);" });
          await new Promise(r => setTimeout(r, 800));
          const screenshot = await send("Page.captureScreenshot", { format: "png" });
          if (screenshot && screenshot.data) {
            fs.writeFileSync("d:\\devoxa technologies\\malikse\\scratch\\cards_scroll.png", Buffer.from(screenshot.data, "base64"));
            console.log("Saved screenshot to scratch/cards_scroll.png!");
          }
          ws.close();
          chrome.kill();
        });

      } catch (e) {
        console.error(e);
        chrome.kill();
      }
    });
  }).on("error", (e) => {
    console.error("HTTP error:", e.message);
    chrome.kill();
  });
}

run();
