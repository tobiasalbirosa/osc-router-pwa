/**
 * Exit non-zero if TCP port is already in use (e.g. another Metro).
 * Prevents `expo run:android` from skipping the bundler and exiting with no logs.
 */
import net from "net";

const port = Number(process.argv[2] || process.env.RCT_METRO_PORT || 8081);

await new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      reject(
        new Error(
          `Port ${port} is already in use. Run: npm run free:8081\n(or stop Metro / Expo / another packager manually)`
        )
      );
    } else {
      reject(err);
    }
  });
  srv.listen(port, () => {
    srv.close(() => resolve());
  });
});
